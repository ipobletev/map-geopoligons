from fastapi import APIRouter
from fastapi.responses import JSONResponse
import os
from config import GENERATED_DIR
from pydantic import BaseModel
from modules.poses_geometry import path_finding

class PathRequest(BaseModel):
    start_node: int
    end_node: int

calculate_path_bp = APIRouter()

@calculate_path_bp.post("/api/v1/calculate-path")
async def calculate_path(req: PathRequest):
    if not path_finding.graph_manager.G:
        # Try to load default if not loaded
        csv_path = os.path.join(GENERATED_DIR, 'global_plan.csv')
        if os.path.exists(csv_path):
            path_finding.graph_manager.load_graph_from_csv(csv_path)
        else:
             return JSONResponse(content={"status": "error", "message": "Graph not loaded and no global_plan.csv found"}, status_code=400)
    
    try:
        path = path_finding.graph_manager.find_path(req.start_node, req.end_node)
        if path is None:
             return JSONResponse(content={"status": "error", "message": "No path found"}, status_code=404)
        
        return {"status": "success", "path": path}
    except Exception as e:
        return JSONResponse(content={"status": "error", "message": str(e)}, status_code=500)
