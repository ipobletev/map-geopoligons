import os
import shutil
import tempfile
import json
import queue
import threading
from typing import Optional
from fastapi import APIRouter, File, UploadFile, Form
from fastapi.responses import StreamingResponse, JSONResponse
from .algorithm.route_generation import run_route_generation
from config import GENERATED_DIR

generate_routes_bp = APIRouter()

@generate_routes_bp.post("/api/v1/generate-routes")
async def generate_routes(
    holes: UploadFile = File(...),
    geofence: UploadFile = File(...),
    streets: UploadFile = File(...),
    home_pose: UploadFile = File(...),
    obstacles: Optional[UploadFile] = File(None),
    high_obstacles: Optional[UploadFile] = File(None),
    transit_streets: Optional[UploadFile] = File(None),
    fit_streets: bool = Form(True),
    fit_twice: bool = Form(True),
    wgs84: bool = Form(True),
    use_obstacles: bool = Form(False),
    use_high_obstacles: bool = Form(False),
    use_transit_streets: bool = Form(False)
):
    # Create a temporary directory for processing
    temp_dir = tempfile.mkdtemp()
    
    try:
        # Save uploaded files
        holes_path = os.path.join(temp_dir, os.path.basename(holes.filename))
        with open(holes_path, "wb") as f:
            shutil.copyfileobj(holes.file, f)
        
        geofence_path = os.path.join(temp_dir, os.path.basename(geofence.filename))
        with open(geofence_path, "wb") as f:
            shutil.copyfileobj(geofence.file, f)
            
        streets_path = os.path.join(temp_dir, os.path.basename(streets.filename))
        with open(streets_path, "wb") as f:
            shutil.copyfileobj(streets.file, f)
            
        home_pose_path = os.path.join(temp_dir, os.path.basename(home_pose.filename))
        with open(home_pose_path, "wb") as f:
            shutil.copyfileobj(home_pose.file, f)

        transit_streets_path = None
        if transit_streets:
            transit_streets_path = os.path.join(temp_dir, os.path.basename(transit_streets.filename))
            with open(transit_streets_path, "wb") as f:
                shutil.copyfileobj(transit_streets.file, f)
            use_transit_streets = True
            
        obstacles_path = None
        if obstacles and use_obstacles:
            obstacles_path = os.path.join(temp_dir, os.path.basename(obstacles.filename))
            with open(obstacles_path, "wb") as f:
                shutil.copyfileobj(obstacles.file, f)
            
        high_obstacles_path = None
        if high_obstacles and use_high_obstacles:
            high_obstacles_path = os.path.join(temp_dir, os.path.basename(high_obstacles.filename))
            with open(high_obstacles_path, "wb") as f:
                shutil.copyfileobj(high_obstacles.file, f)

        progress_queue = queue.Queue()
        
        thread = threading.Thread(
            target=run_route_generation,
            args=(
                progress_queue,
                holes_path, geofence_path, streets_path, home_pose_path,
                transit_streets_path, obstacles_path, high_obstacles_path,
                wgs84, use_transit_streets, use_obstacles, use_high_obstacles,
                fit_streets, fit_twice
            )
        )
        thread.start()

        def event_generator():
            while True:
                try:
                    # Wait for an item in the queue
                    item = progress_queue.get(timeout=1)
                    yield json.dumps(item) + "\n"
                    
                    if item["type"] == "result":
                        # Auto-load graph after success
                        csv_path = os.path.join(GENERATED_DIR, 'global_plan.csv')
                        if os.path.exists(csv_path):
                            print("Auto-loading Global Plan Graph...")
                            try:
                                import path_finding
                                path_finding.graph_manager.load_graph_from_csv(csv_path)
                            except Exception as e:
                                print(f"Error auto-loading graph: {e}")
                        break
                    elif item["type"] == "error":
                        break
                except queue.Empty:
                    if not thread.is_alive():
                        break
                    continue
            
            # Clean up temp dir after processing
            shutil.rmtree(temp_dir)

        return StreamingResponse(event_generator(), media_type="application/x-ndjson")

    except Exception as e:
        import traceback
        traceback.print_exc()
        shutil.rmtree(temp_dir)
        return JSONResponse(content={"status": "error", "message": str(e)}, status_code=500)
