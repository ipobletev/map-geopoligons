import pandas as pd
import geopandas as gpd
from modules.poses_geometry import utils
from modules.poses_geometry.utils import GuiTextException
from .algorithm.fit_streets import fit_all_streets

# Global constants (can be overridden or passed as args if needed)
HOLE_DISTANCE = 2.5 + 1.3
OBSTACLE_BUFFER_DISTANCE = 0.75
TURNING_RADIUS = 3.0
MAX_HOLES_PER_PLAN = 500
STREET_BUFFER_DISTANCE = 5.0

def generate_routes_logic(
    holes,
    geofence,
    home_pose,
    streets,
    transit_streets=None,
    obstacles=None,
    high_obstacles=None,
    use_obstacles=False,
    use_high_obstacles=False,
    use_transit_streets=False,
    fit_streets_enabled=False,
    fit_twice=False,
    progress_callback=None
):
    """
    Core logic for generating routes.
    
    Args:
        holes (GeoDataFrame): Drill holes.
        geofence (GeoDataFrame): Geofence polygon.
        home_pose (GeoDataFrame): Home pose line.
        streets (GeoDataFrame): Streets lines.
        transit_streets (GeoDataFrame, optional): Transit streets lines.
        obstacles (GeoDataFrame, optional): Obstacles polygons.
        high_obstacles (GeoDataFrame, optional): High obstacles polygons.
        use_obstacles (bool): Whether to use obstacles.
        use_high_obstacles (bool): Whether to use high obstacles.
        use_transit_streets (bool): Whether to use transit streets.
        fit_streets_enabled (bool): Whether to fit streets.
        fit_twice (bool): Whether to fit streets twice.
        progress_callback (function, optional): Callback for progress updates.
        
    Returns:
        dict: A dictionary containing the results:
            - holes_filtered
            - streets_fitted
            - buffered_street
            - blocked
            - graph_dataframe
            - all_together
    """
    
    # Check geometries (basic checks should be done before calling this, but we can add safeguards)
    if geofence is None or home_pose is None or streets is None:
        raise ValueError("Essential geometries (geofence, home_pose, streets) must be provided.")

    # Fit streets
    streets_fitted = streets.copy()
    if fit_streets_enabled:
        if progress_callback: progress_callback(1)
        streets_fitted = fit_all_streets(streets, holes, geofence, obstacles, high_obstacles, fit_twice, progress_callback)

    # Filter holes and define blocked areas
    blocked_now = holes
    holes_filtered_now = holes
    
    if use_obstacles and obstacles is not None:
        blocked_now = pd.concat([blocked_now, obstacles])
        holes_filtered_now = holes_filtered_now[holes_filtered_now.within(geofence.unary_union - obstacles.unary_union)].reset_index(drop=True)
        
    if use_high_obstacles and high_obstacles is not None:
        blocked_now = pd.concat([blocked_now, high_obstacles])
        holes_filtered_now = holes_filtered_now[holes_filtered_now.within(geofence.unary_union - high_obstacles.unary_union)].reset_index(drop=True)

    blocked = gpd.GeoDataFrame(geometry=gpd.GeoSeries(pd.concat([blocked_now, gpd.GeoDataFrame(geometry=geofence.boundary)]).buffer(OBSTACLE_BUFFER_DISTANCE))).unary_union
    holes_filtered = holes_filtered_now

    print("holes after filter")
    print(holes_filtered)

    if len(holes_filtered) > MAX_HOLES_PER_PLAN:
        raise GuiTextException("Demasiados pozos a cargar ("+ str(len(holes_filtered))+"), el número máximo de pozos es " + str(MAX_HOLES_PER_PLAN))

    # Calculate closest streets
    closest_streets = []
    if progress_callback:
        progress_callback(10)
        
    print(f"DEBUG: Finding closest streets. Holes: {len(holes_filtered)}, Streets: {len(streets_fitted)}")
    if hasattr(holes_filtered, 'crs'): print(f"DEBUG: Holes CRS: {holes_filtered.crs}")
    if hasattr(streets_fitted, 'crs'): print(f"DEBUG: Streets CRS: {streets_fitted.crs}")

    for i in range(0, len(holes_filtered)):
        distance = 10000.0
        closest_street = -1
        for j in range(0, len(streets_fitted)):
            dist = holes_filtered.geometry.iloc[i].distance(streets_fitted.geometry.iloc[j])
            if dist < distance:
                distance = dist
                closest_street = j
        closest_streets.append(closest_street)
        
    holes_filtered['closest_street'] = closest_streets
    
    # Buffer streets
    streets_fitted['buffered_street'] = streets_fitted.buffer(STREET_BUFFER_DISTANCE).simplify(0.4)
    buffered_street = streets_fitted.buffer(STREET_BUFFER_DISTANCE).simplify(0.4)

    # Create Graph Dataframe
    if use_transit_streets and transit_streets is not None:
        graph_dataframe = utils.createGraphDataframe(
            home_pose, streets_fitted, transit_streets, holes_filtered, blocked, 
            obstacles, high_obstacles, geofence, OBSTACLE_BUFFER_DISTANCE, 
            TURNING_RADIUS, HOLE_DISTANCE, progress_callback
        )
    else:
        graph_dataframe = utils.createGraphDataframe_without_transit(
            home_pose, streets_fitted, holes_filtered, blocked, 
            obstacles, high_obstacles, geofence, OBSTACLE_BUFFER_DISTANCE, 
            TURNING_RADIUS, HOLE_DISTANCE, progress_callback
        )

    print(graph_dataframe)
    print("finished graph dataframe")

    # Concatenate all together
    dfs_to_concat = [holes_filtered.drop(['x', 'y'], axis=1, errors='ignore'), home_pose]
    
    if use_obstacles and obstacles is not None:
        dfs_to_concat.append(obstacles)
    if use_high_obstacles and high_obstacles is not None:
        dfs_to_concat.append(high_obstacles)
        
    dfs_to_concat.append(streets_fitted)
    
    if use_transit_streets and transit_streets is not None:
        dfs_to_concat.append(transit_streets)
        
    dfs_to_concat.append(geofence)
    dfs_to_concat.append(graph_dataframe)
    
    all_together = pd.concat(dfs_to_concat, ignore_index=True)
    print("finished all together")

    if progress_callback:
        progress_callback(100)

    return {
        'holes_filtered': holes_filtered,
        'streets_fitted': streets_fitted,
        'buffered_street': buffered_street,
        'blocked': blocked,
        'graph_dataframe': graph_dataframe,
        'all_together': all_together
    }
