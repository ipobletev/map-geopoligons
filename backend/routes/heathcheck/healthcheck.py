from fastapi import APIRouter
from fastapi.responses import JSONResponse

healthcheck_bp = APIRouter()

@healthcheck_bp.get("/healthcheck")
def healthcheck():
    return JSONResponse(content={"status": "ok"})