

import sys
import os
import math
import base64
import geopandas as gpd
import pandas as pd
import matplotlib
import matplotlib.pyplot as plt

# Add the backend directory to sys.path to resolve 'modules'
from config import BACKEND_DIR
if BACKEND_DIR not in sys.path:
    sys.path.append(BACKEND_DIR)

from modules.poses_geometry import utils
from routes.api_v1.generate_routes import route_gen_logic
from config import GENERATED_DIR

def run_route_generation(
    progress_queue,
    holes_path, geofence_path, streets_path, home_pose_path,
    transit_streets_path, obstacles_path, high_obstacles_path,
    wgs84, use_transit_streets, use_obstacles, use_high_obstacles,
    fit_streets, fit_twice
):
    try:
        # Load Data
        holes_df = utils.readHolFile(holes_path, wgs84)
        
        geofence_df = gpd.read_file(geofence_path).to_crs(holes_df.crs)
        geofence_df['type'] = 'geofence'
        
        home_pose_df = gpd.read_file(home_pose_path).to_crs(holes_df.crs)
        home_pose_df['poses'] = [ [[home_pose_df.geometry[0].coords[0][0], home_pose_df.geometry[0].coords[0][1], math.atan2(home_pose_df.geometry[0].coords[1][1]-home_pose_df.geometry[0].coords[0][1],home_pose_df.geometry[0].coords[1][0]-home_pose_df.geometry[0].coords[0][0])]] ]
        home_pose_df['type'] = 'home_pose'
        
        streets_df = gpd.read_file(streets_path).to_crs(holes_df.crs)
        streets_df['type'] = 'streets'
        
        transit_streets_df = None
        if transit_streets_path:
            transit_streets_df = gpd.read_file(transit_streets_path).to_crs(holes_df.crs)
            transit_streets_df['type'] = 'transit_streets'
            
        obstacles_df = None
        if obstacles_path:
            obstacles_df = gpd.read_file(obstacles_path).to_crs(holes_df.crs)
            obstacles_df['type'] = 'obstacles'
            
        high_obstacles_df = None
        if high_obstacles_path:
            high_obstacles_df = gpd.read_file(high_obstacles_path).to_crs(holes_df.crs)
            high_obstacles_df['type'] = 'high_obstacles'

        def progress_callback(value):
            progress_queue.put({"type": "progress", "value": value})

        # Execute Logic
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
        
        # Generate Outputs
        all_together = results['all_together']
        all_together = results['all_together']
        holes_filtered = results['holes_filtered']
        graph_dataframe = results['graph_dataframe']
        
        # Plotting
        matplotlib.use('agg')
        bounding_box = all_together.unary_union.bounds
        fig = plt.figure(figsize=(10, 10), dpi=300)
        ax = plt.Axes(fig, [0., 0., 1., 1.])
        ax.set_axis_off()
        fig.add_axes(ax)
        
        holes_filtered.buffer(0.2).plot(ax=ax, color='k')
        geofence_df.boundary.plot(ax=ax, color='k')
        progress_queue.put({"type": "progress", "value": 96})
        
        margin = 30.0
        min_x = bounding_box[0]-margin
        min_y = bounding_box[1]-margin
        max_x = bounding_box[2]+margin
        max_y = bounding_box[3]+margin
        range_x = max_x-min_x
        range_y = max_y-min_y
        if(range_x > range_y):
            range_y = range_x
            max_y = min_y+range_y
        if (range_y > range_x):
            range_x = range_y
            max_x = min_x+range_x

        ax.set_xlim(min_x, max_x)
        ax.set_ylim(min_y, max_y)
        
        dpi = max(range_x, range_y)/(10.0*0.15)
        
        csv_filename = os.path.join(GENERATED_DIR, 'global_plan.csv')
        map_png_filename = os.path.join(GENERATED_DIR, 'map.png')
        map_yaml_filename = os.path.join(GENERATED_DIR, 'maze_peld.yaml')
        latlon_filename = os.path.join(GENERATED_DIR, 'latlon.yaml')
        
        # Save CSV
        all_together.to_csv(csv_filename)
        
        all_together['local_geometry'] = all_together['geometry'].affine_transform([1.0, 0.0, 0.0, 1.0, -min_x, -min_y])
        all_together['local_buffered_street'] = all_together['buffered_street'].affine_transform([1.0, 0.0, 0.0, 1.0, -min_x, -min_y])
        all_together['graph_pose_local'] = all_together.apply(lambda row:  [row['graph_pose'][0]-min_x, row['graph_pose'][1]- min_y, row['graph_pose'][2]] if isinstance(row['graph_pose'], list) else None, axis=1)
        all_together['local_poses']= all_together.apply(lambda row: [ [e[0]- min_x, e[1]-min_y, e[2]] for e in row['poses']] if isinstance(row['poses'], list) else None  , axis=1)
        
        all_together.to_csv(csv_filename)
        progress_queue.put({"type": "progress", "value": 97})
        
        plt.savefig(map_png_filename, dpi=dpi)
        plt.close(fig)
        progress_queue.put({"type": "progress", "value": 98})
        
        with open(map_yaml_filename, 'w') as file:
            file.write("image: map.png\n")
            file.write("resolution: 0.15\n")
            file.write("origin: [0.0, 0.0, 0.0]\n")
            file.write("negate: 0\n")
            file.write("occupied_thresh: 0.65\n")
            file.write("free_thresh: 0.196\n")

        with open(latlon_filename, 'w') as file:
            file.write("/GPS/latlontoutm:\n")
            file.write("  utm_x_map_zero:                           {}   # REAL\n".format(bounding_box[0]-margin) )
            file.write("  utm_y_map_zero:                           {}   # REAL\n".format(bounding_box[1]-margin) )

        with open(map_png_filename, "rb") as image_file:
            encoded_string = base64.b64encode(image_file.read()).decode('utf-8')
            
        # Generate Arrow GeoJSON
        arrow_geojson = utils.generate_arrow_geojson(graph_dataframe, holes_df.crs)
        progress_queue.put({"type": "progress", "value": 99})
        
        # Extract fitted streets and transit streets
        streets_fitted = results.get('streets_fitted')
        transit_streets_fitted = results.get('transit_streets_fitted')
            
        progress_queue.put({"type": "progress", "value": 100})
        
        progress_queue.put({
            "type": "result",
            "data": {
                "status": "success",
                "map_image": f"data:image/png;base64,{encoded_string}",
                "arrow_geojson": arrow_geojson,
                "holes_geojson": holes_df.to_crs('EPSG:4326').to_json() if holes_df is not None else None,
                "geofence_geojson": geofence_df.to_crs('EPSG:4326').to_json() if geofence_df is not None else None,
                "streets_geojson": streets_df.drop(columns=['buffered_street'], errors='ignore').to_crs('EPSG:4326').to_json() if streets_df is not None else None,
                "fitted_streets_geojson": streets_fitted.drop(columns=['buffered_street'], errors='ignore').to_crs('EPSG:4326').to_json() if streets_fitted is not None else None,
                "home_pose_geojson": home_pose_df.to_crs('EPSG:4326').to_json() if home_pose_df is not None else None,
                "obstacles_geojson": obstacles_df.to_crs('EPSG:4326').to_json() if obstacles_df is not None else None,
                "high_obstacles_geojson": high_obstacles_df.to_crs('EPSG:4326').to_json() if high_obstacles_df is not None else None,
                "transit_streets_geojson": transit_streets_df.to_crs('EPSG:4326').to_json() if transit_streets_df is not None else None,
                "fitted_transit_streets_geojson": transit_streets_fitted.to_crs('EPSG:4326').to_json() if transit_streets_fitted is not None else None,
                "fitted_transit_streets_geojson": transit_streets_fitted.to_crs('EPSG:4326').to_json() if transit_streets_fitted is not None else None,
                "global_plan_data": pd.read_csv(csv_filename).fillna("").to_dict(orient='records'),
                "download_links": {
                    "csv": "/api/v1/generate-routes/download/global_plan.csv",
                    "map_png": "/api/v1/generate-routes/download/map.png",
                    "map_yaml": "/api/v1/generate-routes/download/maze_peld.yaml",
                    "latlon_yaml": "/api/v1/generate-routes/download/latlon.yaml"
                }
            }
        })

    except Exception as e:
        import traceback
        traceback.print_exc()
        progress_queue.put({"type": "error", "message": str(e)})
