from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import uvicorn
from config import GENERATED_DIR

# Import routers
from routes import generate_routes_bp, calculate_path_bp, graph_nodes_bp, transfer_files_bp, healthcheck_bp

app = FastAPI()

app.mount("/api/v1/generate-routes/download", StaticFiles(directory=GENERATED_DIR), name="generated")

app.include_router(generate_routes_bp)
app.include_router(calculate_path_bp)
app.include_router(graph_nodes_bp)
app.include_router(transfer_files_bp)
app.include_router(healthcheck_bp)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for dev
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)