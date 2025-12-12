from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse, StreamingResponse
import uvicorn
import os
import shutil
import tempfile
import pandas as pd
import geopandas as gpd
import matplotlib
import matplotlib.pyplot as plt
import io
import base64
import json
from typing import Optional
import math
import threading
import queue
import time

# Import local modules
import route_gen_logic
import utils
import transfer_logic
from pydantic import BaseModel

class TransferRequest(BaseModel):
    host: str
    port: int
    username: str
    password: str
    files: dict # filename -> remote_path

@app.post("/api/transfer-files")
async def transfer_files(req: TransferRequest):
    try:
        # Map requested filenames to actual local paths in GENERATED_DIR
        files_map = {}
        
        for filename, remote_path in req.files.items():
            local_path = os.path.join(GENERATED_DIR, filename)
            # Only include if file exists
            if os.path.exists(local_path):
                files_map[local_path] = remote_path
        
        if not files_map:
             return JSONResponse(content={"status": "error", "message": "No valid files found to transfer"}, status_code=400)

        result = transfer_logic.transfer_multiple_files_scp(
            req.host,
            req.port,
            req.username,
            req.password,
            files_map
        )
        
        # Check for partial errors? The function returns a results list.
        # Let's return the full result object so frontend can show details.
        if result["status"] == "error":
             return JSONResponse(content=result, status_code=500)
             
        return result

    except Exception as e:
        import traceback
        traceback.print_exc()
        return JSONResponse(content={"status": "error", "message": str(e)}, status_code=500)

class PathRequest(BaseModel):
    start_node: int
    end_node: int

@app.post("/api/calculate-path")
async def calculate_path(req: PathRequest):
    import path_finding
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

@app.get("/api/graph-nodes")
async def get_graph_nodes():
    import path_finding
    if not path_finding.graph_manager.G:
        csv_path = os.path.join(GENERATED_DIR, 'global_plan.csv')
        if os.path.exists(csv_path):
            path_finding.graph_manager.load_graph_from_csv(csv_path)
    
    nodes = path_finding.graph_manager.get_nodes_list()
    return {"nodes": nodes}
