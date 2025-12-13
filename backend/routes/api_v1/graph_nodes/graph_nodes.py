from fastapi import APIRouter
import os
from config import GENERATED_DIR
from modules.poses_geometry import path_finding

graph_nodes_bp = APIRouter()

@graph_nodes_bp.get("/api/v1/graph-nodes")
async def get_graph_nodes():
    if not path_finding.graph_manager.G:
        csv_path = os.path.join(GENERATED_DIR, 'global_plan.csv')
        if os.path.exists(csv_path):
            path_finding.graph_manager.load_graph_from_csv(csv_path)
    
    nodes = path_finding.graph_manager.get_nodes_list()
    return {"nodes": nodes}
