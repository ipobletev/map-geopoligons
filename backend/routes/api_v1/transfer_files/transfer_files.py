from fastapi import APIRouter
from fastapi.responses import JSONResponse
import os
from pydantic import BaseModel
from config import GENERATED_DIR

from typing import Dict
from . import transfer_logic
import glob

class TransferRequest(BaseModel):
    host: str
    port: int
    username: str
    password: str
    files: Dict[str, str]  # filename -> remote_path

transfer_files_bp = APIRouter()

@transfer_files_bp.post("/api/v1/transfer-files")
async def transfer_files(req: TransferRequest):
    try:
        # Construct a map of absolute local path -> remote path
        files_map = {}
        
        # We need to map filenames to actual local paths in GENERATED_DIR
        # Files available: global_plan.csv, map.png, maze_peld.yaml, latlon.yaml
        # For generated files, we should look in the last generated folder or just use the known structure if flat?
        # The previous logic walked GENERATED_DIR. Let's find files by name in GENERATED_DIR recursively.
        
        # Helper to find file path
        def find_file(name):
             # Search recursively in GENERATED_DIR
             for root, dirs, files in os.walk(GENERATED_DIR):
                 if name in files:
                     return os.path.join(root, name)
             return None

        for filename, remote_path in req.files.items():
            local_path = find_file(filename)
            if local_path:
                files_map[local_path] = remote_path
            else:
                # If checking specifically for files that might not exist yet, handle gracefully or skip
                # But for now let's skip/warn
                pass

        if not files_map:
             return JSONResponse(content={"status": "error", "message": "No files found to transfer"}, status_code=404)

        result = transfer_logic.transfer_multiple_files_scp(
            req.host,
            req.port,
            req.username,
            req.password,
            files_map
        )
        
        if result["status"] == "error":
            return JSONResponse(content=result, status_code=500)
        return result

    except Exception as e:
        return JSONResponse(content={"status": "error", "message": str(e)}, status_code=500)
