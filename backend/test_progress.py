
import sys
import os
import pandas as pd
import geopandas as gpd
from shapely.geometry import Point, LineString, Polygon

# Add current directory to sys.path
sys.path.append(os.getcwd())

from route_gen_logic import generate_routes_logic
import utils

# Mock utils functions to avoid geometry errors
def mock_create_graph(*args, **kwargs):
    return pd.DataFrame()

utils.createGraphDataframe_without_transit = mock_create_graph
utils.createGraphDataframe = mock_create_graph

def mock_progress_callback(value):
    print(f"PROGRESS: {value}")

def test_progress():
    # Create dummy data
    holes = gpd.GeoDataFrame({'drillhole_id': [1], 'type': ['hole'], 'geometry': [Point(10, 10)]})
    geofence = gpd.GeoDataFrame({'geometry': [Polygon([(0, 0), (20, 0), (20, 20), (0, 20)])]})
    home_pose = gpd.GeoDataFrame({'poses': [[(1, 1, 0)]], 'type': ['home_pose'], 'geometry': [Point(1, 1)]})
    streets = gpd.GeoDataFrame({'poses': [[(5, 5, 0)]], 'type': ['streets'], 'geometry': [LineString([(5, 5), (15, 5)])]})
    
    # Run generation
    try:
        generate_routes_logic(
            holes=holes,
            geofence=geofence,
            home_pose=home_pose,
            streets=streets,
            progress_callback=mock_progress_callback
        )
    except Exception as e:
        print(f"Error during generation: {e}")

if __name__ == "__main__":
    test_progress()
