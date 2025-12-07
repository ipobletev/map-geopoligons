import sys
import os
import geopandas as gpd
import pandas as pd
import math
import utils
import route_gen_logic

# Set paths
TEST_DATA_DIR = "/home/isma/Desktop/codigo-fuente/src/core/op_blasting_gui/doc/jupyter/generar_rutas/test_input_data/test0"
holes_path = os.path.join(TEST_DATA_DIR, "holes.hol")
geofence_path = os.path.join(TEST_DATA_DIR, "geofence.geojson")
streets_path = os.path.join(TEST_DATA_DIR, "streets.geojson")
home_pose_path = os.path.join(TEST_DATA_DIR, "home_pose.geojson")
transit_streets_path = os.path.join(TEST_DATA_DIR, "transit_streets.geojson")
obstacles_path = os.path.join(TEST_DATA_DIR, "obstacles.geojson")
high_obstacles_path = os.path.join(TEST_DATA_DIR, "high_obstacles.geojson")

wgs84 = True
use_transit_streets = True
use_obstacles = False
use_high_obstacles = False
fit_streets = False
fit_twice = True

print("Loading data...")
holes_df = utils.readHolFile(holes_path, wgs84)

geofence_df = gpd.read_file(geofence_path).to_crs(holes_df.crs)
geofence_df['type'] = 'geofence'

home_pose_df = gpd.read_file(home_pose_path).to_crs(holes_df.crs)
# Logic from main.py
home_pose_df['poses'] = [ [[home_pose_df.geometry[0].coords[0][0], home_pose_df.geometry[0].coords[0][1], math.atan2(home_pose_df.geometry[0].coords[1][1]-home_pose_df.geometry[0].coords[0][1],home_pose_df.geometry[0].coords[1][0]-home_pose_df.geometry[0].coords[0][0])]] ]
home_pose_df['type'] = 'home_pose'

streets_df = gpd.read_file(streets_path).to_crs(holes_df.crs)
streets_df['type'] = 'streets'

transit_streets_df = None
if use_transit_streets:
    transit_streets_df = gpd.read_file(transit_streets_path).to_crs(holes_df.crs)
    transit_streets_df['type'] = 'transit_streets'

obstacles_df = None
if use_obstacles:
    obstacles_df = gpd.read_file(obstacles_path).to_crs(holes_df.crs)
    obstacles_df['type'] = 'obstacles'

high_obstacles_df = None
if use_high_obstacles:
    high_obstacles_df = gpd.read_file(high_obstacles_path).to_crs(holes_df.crs)
    high_obstacles_df['type'] = 'high_obstacles'

def progress_callback(value):
    print(f"Progress: {value}%")

print("Running route generation...")
try:
    results = route_gen_logic.generate_routes_logic(
        holes=holes_df,
        geofence=geofence_df,
        home_pose=home_pose_df,
        streets=streets_df,
        transit_streets=transit_streets_df,
        obstacles=obstacles_df,
        high_obstacles=high_obstacles_df,
        use_obstacles=use_obstacles,
        use_high_obstacles=use_high_obstacles,
        use_transit_streets=use_transit_streets,
        fit_streets_enabled=fit_streets,
        fit_twice=fit_twice,
        progress_callback=progress_callback
    )
    print("Success!")
except Exception as e:
    print(f"Error: {e}")
    import traceback
    traceback.print_exc()
