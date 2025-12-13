from fastapi import APIRouter
from fastapi.responses import JSONResponse
import os
from pydantic import BaseModel
from config import GENERATED_DIR

class TransferRequest(BaseModel):
    host: str
    port: int
    username: str
    password: str
    remote_path: str
    file_type: str = "zip" # 'zip' or specific file key

transfer_files_bp = APIRouter()

@transfer_files_bp.post("/api/v1/transfer-files")
async def transfer_files(req: TransferRequest):
    try:
        # We need to find the latest generated files or specific ones.
        # For simplicity, let's assume we zip everything currently in generated/ or re-generate a zip?
        # Or better: The frontend triggers a download, but here we want to transfer.
        # Let's zip the 'generated' folder content into a temporary zip or use the existing logic if possible.
        
        # Re-using zip logic might be hard without refactoring.
        # Let's create a zip of the GENERATED_DIR content.
        
        timestamp = int(time.time())
        zip_filename = f"route_results_{timestamp}.zip"
        zip_path = os.path.join(tempfile.gettempdir(), zip_filename)
        
        import zipfile
        with zipfile.ZipFile(zip_path, 'w') as zipf:
            for root, dirs, files in os.walk(GENERATED_DIR):
                for file in files:
                    zipf.write(os.path.join(root, file), file)
        
        result = transfer_logic.transfer_files_scp(
            req.host,
            req.port,
            req.username,
            req.password,
            zip_path,
            req.remote_path
        )
        
        os.remove(zip_path)
        
        if result["status"] == "error":
            return JSONResponse(content=result, status_code=500)
        return result

    except Exception as e:
        return JSONResponse(content={"status": "error", "message": str(e)}, status_code=500)
