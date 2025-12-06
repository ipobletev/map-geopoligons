import matplotlib
#matplotlib.use('TkAgg')
# from python_qt_binding import QtCore, QtWidgets
# from python_qt_binding import QtGui
# from python_qt_binding.QtCore import Qt, QObject, QRunnable, QObject, Signal, Slot, QThreadPool
# from python_qt_binding.QtGui import QPen
# from python_qt_binding.QtWidgets import QMessageBox

import geopandas as gpd
import matplotlib.pyplot as plt
import sys
import traceback
import numpy as np

import pandas as pd

import shapely
from shapely.geometry import LineString, MultiLineString, Point, Polygon
from shapely.ops import  linemerge, nearest_points
import math

import networkx as nx

from gui_text_exception import GuiTextException


connect_holes = False
del_colliding_poses = True

# QRoundProgressBar, WorkerSignals, and Worker classes removed for backend compatibility


def plotPose(pose):
    start = (pose[0], pose[1])
    end = (pose[0] + .5*math.cos(pose[2]), pose[1] + 0.5*math.sin(pose[2]))
    arrow = mpatch.FancyArrowPatch( start , end  , transform=plt.gca().transData, arrowstyle='->', mutation_scale=10.0)
    plt.gca().add_patch(arrow)

def generatePoseCandidate(pose, hole,  blocked, turning_radius, hole_distance, dont_go_back = True):
 
    start = shapely.geometry.Point(pose[0],pose[1])
    hole = hole
    turning_points =  shapely.geometry.Point(pose[0] + turning_radius*math.cos(pose[2]+math.pi/2.0),
                               pose[1] + turning_radius*math.sin(pose[2]+math.pi/2.0)).union(
        shapely.geometry.Point(pose[0] + turning_radius*math.cos(pose[2]-math.pi/2.0),
                               pose[1] + turning_radius*math.sin(pose[2]-math.pi/2.0)))
    turning_point,_ = nearest_points(turning_points,hole)
    if turning_point.distance(hole) < turning_radius:
        return None ,None ,None
    envelope = turning_point.buffer(turning_radius).union(hole).convex_hull.boundary



    buffered_hole = hole.buffer(hole_distance).boundary

    splitter = turning_points.convex_hull.union(buffered_hole)
    split_trajectory = split_ring(envelope, splitter)
    #print('split_traj:' , split_trajectory  )

    for traj  in split_trajectory :
        start_point = traj.interpolate(0)
        end_point = traj.interpolate(traj.length)
        #print(start_point.distance(start.geometry[0]))
        if start_point.distance(start) < 0.01:
            diff = traj.interpolate(0.1)
            start_angle = math.atan2(diff.y - start_point.y, diff.x - start_point.x)
            angle_error = start_angle-pose[2]
            while angle_error > math.pi:
                angle_error -= 2*math.pi
            while angle_error < -math.pi:
                angle_error += 2*math.pi
            if abs(angle_error) < math.pi/4:
                trajectory = traj
                break
        if end_point.distance(start) < 0.01:
            diff = traj.interpolate(traj.length-0.1)
            start_angle = math.atan2(diff.y - end_point.y, diff.x - end_point.x)
            angle_error = start_angle-pose[2]
            while angle_error > math.pi:
                angle_error -= 2*math.pi
            while angle_error < -math.pi:
                angle_error += 2*math.pi
            if abs(angle_error) < math.pi/4:
                trajectory = traj.reverse()
                break
    


    end_point = trajectory.interpolate(trajectory.length)

    if  turning_point.buffer(turning_radius+0.001).intersects(end_point):
        return None ,None ,None
    
    if dont_go_back:
        end_diff = trajectory.interpolate(trajectory.length-0.1)

        end_angle = math.atan2(end_point.y - end_diff.y, end_point.x - end_diff.x)
        end_angle_error = end_angle - pose[2]

        while end_angle_error > math.pi:
            end_angle_error -= 2*math.pi
        while end_angle_error < -math.pi:
            end_angle_error += 2*math.pi

        if abs(end_angle_error) > math.pi/2:
            return None, None, None

    pose_candidate = [end_point.x, end_point.y, math.atan2( hole.y - end_point.y, hole.x - end_point.x)]
    if trajectory.intersects(blocked):
        return None ,None ,None
    pose_candidates = []
    l=3.0
    while l < trajectory.length:
        point = trajectory.interpolate(l)
        diff = trajectory.interpolate(l+0.1)
        angle = math.atan2(diff.y - point.y, diff.x - point.x)
        pose_candidates.append([point.x, point.y, angle])

        l += 3.0
    pose_candidates.append(pose_candidate)




    # plt.Figure()
    # start.plot( ax=plt.gca()     ,color='green')
    # hole.plot(  ax=plt.gca()      ,color='red')
    # buffered_hole.plot( ax=plt.gca()     ,color='k')
    # # envelope.plot(ax=plt.gca()  ,color='k')
    # gpd.GeoDataFrame(geometry=gpd.GeoSeries(turning_point.buffer(turning_radius)) ).plot(ax=plt.gca()  ,color='lightblue')
    # blocked.plot(ax=plt.gca()  ,color='orange')
    # trajectory.plot( ax=plt.gca()     ,color='blue')
    # #plt.pause(0.01)


    return pose_candidates, trajectory.distance(blocked) , trajectory.length

def generateLoadingPoses(streets, holes, blocked, prev_poses, obstacle_buffer_distance, turning_radius, hole_distance, progress_callback):
    print ('generating loading poses')
    plt.close('all')
    poses_field = []
    all_poses = []
    drillhole_order = []
    extra_connections = []
    pose_types = []
    hole_num = 0

    for index, row in holes.iterrows():
        poses = []
        order = 10000000000
        # print ('row')
        if row['type'] == 'hole' :
            print ('hole' , hole_num)
            # print (row)
            closest_street_idx = row['closest_street']
            
            if closest_street_idx == -1:
                 print(f"Warning: No closest street found for hole {row['drillhole_id']}")
                 # Do not continue, let it fall through to 'no poses found' check
            
            max_ditance = 0
            min_length = 100000000
            blocked_without_pose = blocked.difference(row['geometry'].buffer(obstacle_buffer_distance+0.01) )
            min_length_pose = None
            min_idx = None
            min_length_idx = None
            
            if closest_street_idx != -1:
                for pose_num ,  pose_street in enumerate(streets['poses'].iloc[closest_street_idx]):
                    # print ('pose')
                    pose_candidates , distance , length = generatePoseCandidate(pose_street, row['geometry'], blocked_without_pose, turning_radius, hole_distance)
                    # print('distance: ' , distance)
                    if pose_candidates != None :
                        if distance > max_ditance:
                            max_ditance = distance
                            poses = pose_candidates
                            min_idx = pose_num
                        if distance > 2.0:
                            if length < min_length:
                                min_length = length
                                min_length_pose = pose_candidates
                                min_length_idx = pose_num

                    pass
            if min_length_pose != None:
                poses = min_length_pose
                min_idx = min_length_idx
            if min_idx != None:
                order = 1+len(sum(streets['poses'][0:closest_street_idx],[])) + min_idx
                extra_connections.append([order, len(prev_poses) +len(all_poses)])
                for i in range(1,len(poses)):
                    extra_connections.append([len(prev_poses) +len(all_poses) + i-1 , len(prev_poses) +len(all_poses) + i ])

            hole_num += 1
            #plt.show()
            if len(poses) == 0:
                print ('no poses found')
                print('pozo no encontrado: ', row['drillhole_id'])
                raise GuiTextException('No se encontró una ruta al pozo '+str(str(row['drillhole_id']) + ', revisar calles, geofence y/o obstaculos') )
            if progress_callback: progress_callback(10+20*hole_num/len(holes))
        drillhole_order.append(order)


        poses_field.append(poses)
        for pose in poses:
            all_poses.append(pose)
        poses

    holes['drillhole_order'] = np.argsort(np.argsort(drillhole_order))
    holes['poses'] = poses_field
    return poses_field, extra_connections


def gen_footprint_obstacle(x,y,angle):
    back = -3.5
    front = 3.5  #front = 6.5
    left = 1.8 
    right = -1.8
    c = math.cos(angle)
    s = math.sin(angle)

    footprint = shapely.Polygon([
        [x+c*back -s*left,  y+s*back +c*left],
        [x+c*front-s*left,  y+s*front+c*left],
        [x+c*front-s*right, y+s*front+c*right],
        [x+c*back -s*right, y+s*back +c*right],
        [x+c*back -s*left,  y+s*back +c*left]
    ])    
    return footprint

def gen_footprint_high_obstacle(x,y,angle):
    back = -3.5
    front = 6.5
    left = 1.8 
    right = -1.8
    c = math.cos(angle)
    s = math.sin(angle)

    footprint = shapely.Polygon([
        [x+c*back -s*left,  y+s*back +c*left],
        [x+c*front-s*left,  y+s*front+c*left],
        [x+c*front-s*right, y+s*front+c*right],
        [x+c*back -s*right, y+s*back +c*right],
        [x+c*back -s*left,  y+s*back +c*left]
    ])    
    return footprint


def posesFromGeoDataFrame(gdf, blocked = None, low_obs = None, high_obs = None, geofence = None):
    all_poses = []
    poses_field = []

    if low_obs is not None and low_obs.geometry.shape[0] > 0:
        all_low_obs = shapely.unary_union(low_obs.geometry)
    if high_obs is not None and high_obs.geometry.shape[0] > 0:
        all_high_obs = shapely.unary_union(high_obs.geometry)
    all_geofence = geofence.geometry.iloc[0]


    for index, row in gdf.iterrows():

        poses = []
        if row['type'] == 'streets' or row['type'] == 'transit_streets':

            for i in range(len(row['geometry'].coords[:])-1):

                angle = math.atan2(row['geometry'].coords[i+1][1] - row['geometry'].coords[i][1], row['geometry'].coords[i+1][0] - row['geometry'].coords[i][0])
                point = [row['geometry'].coords[i][0], row['geometry'].coords[i][1], angle]

                dist = math.sqrt((point[1] - row['geometry'].coords[i+1][1])**2 + (point[0] - row['geometry'].coords[i+1][0])**2)

                while dist > .510:
                    # Eval intermediate points
                    foot = gen_footprint_obstacle(point[0], point[1], angle)
                    foot_high = gen_footprint_high_obstacle(point[0], point[1], angle)
                    ok = True

                    if del_colliding_poses:
                        if low_obs is not None and low_obs.geometry.shape[0] > 0:
                            if foot.intersects(all_low_obs) or foot.contains(all_low_obs) or all_low_obs.contains(foot):
                                ok = False
                        if high_obs is not None and high_obs.geometry.shape[0] > 0:
                            if foot_high.intersects(all_high_obs) or foot_high.contains(all_high_obs) or all_high_obs.contains(foot_high):
                                ok = False
                        if not all_geofence.contains(foot_high):
                            ok = False

                    if ok:
                        poses.append(point.copy())

                        if row['type'] == 'transit_streets':
                            p = point.copy()
                            p[0] = p[0] + 0.1*math.cos(angle + math.pi/2)
                            p[1] = p[1] + 0.1*math.sin(angle + math.pi/2)
                            p[2] = p[2] + math.pi
                            poses.append(p)

                    point[0] = point[0] + 0.50*math.cos(angle)
                    point[1] = point[1] + .50*math.sin(angle)

                    dist = math.sqrt((point[1] - row['geometry'].coords[i+1][1])**2 + (point[0] - row['geometry'].coords[i+1][0])**2)

                # Eval last point
                point = [row['geometry'].coords[-1][0], row['geometry'].coords[-1][1], angle]
                foot = gen_footprint_obstacle(point[0], point[1], angle)
                foot_high = gen_footprint_high_obstacle(point[0], point[1], angle)
                ok = True

                if del_colliding_poses:
                    if low_obs is not None and low_obs.geometry.shape[0] > 0:
                        if foot.intersects(all_low_obs) or foot.contains(all_low_obs) or all_low_obs.contains(foot):
                            ok = False
                    if high_obs is not None and high_obs.geometry.shape[0] > 0:
                        if foot_high.intersects(all_high_obs) or foot_high.contains(all_high_obs) or all_high_obs.contains(foot_high):
                            ok = False
                    if not all_geofence.contains(foot_high):
                        ok = False

                if ok:
                    poses.append(point.copy())

                    if row['type'] == 'transit_streets':
                        p = point.copy()
                        p[0] = p[0] + 0.1*math.cos(angle + math.pi/2)
                        p[1] = p[1] + 0.1*math.sin(angle + math.pi/2)
                        p[2] = p[2] + math.pi
                        poses.append(p)

        all_poses = all_poses + poses
        poses_field.append(poses)
    gdf['poses'] = poses_field
    return all_poses




def shouldConnect(pose_i, pose_j, turning_radius, blocked, type_i, type_j):
    if pose_i[0] == pose_j[0] and pose_i[1] == pose_j[1] and pose_i[2] == pose_j[2]:
        return True
 
    if not connect_holes and type_i == 'hole' and type_j == 'hole':
        #print("Skip")
        return False
   
    line =  LineString([pose_i[0:2], pose_j[0:2]])
    #print(line.length[0])
    #warning PL PRUEBA Cambiando restricciones para generar waypoints en gui!!!!
    if line.length > 8.0:         # Condición original
        return False
    #if line.length > 9.0:     # Condición modificada
    #    return False
    #if line.length < 5.0:     # Condición modificada
    #    return False

    angle_diff = pose_i[2] - pose_j[2]
    while angle_diff > math.pi:
        angle_diff = angle_diff - 2*math.pi
    while angle_diff < -math.pi:
        angle_diff = angle_diff + 2*math.pi
    if abs(angle_diff) > math.pi*0.6:
        return False
    if line.length < 2*turning_radius*math.sin(abs(angle_diff)/2):
        return False
    pi=Point(pose_i[0], pose_i[1])
    pj=Point(pose_j[0], pose_j[1])
    pi_left=Point(pose_i[0]+turning_radius*math.cos(pose_i[2]+math.pi/2), pose_i[1]+turning_radius*math.sin(pose_i[2]+math.pi/2))
    pi_right=Point(pose_i[0]+turning_radius*math.cos(pose_i[2]-math.pi/2), pose_i[1]+turning_radius*math.sin(pose_i[2]-math.pi/2))
    if pj.distance(pi_left) < turning_radius:
        return False
    if pj.distance(pi_right) < turning_radius:
        return False
    pj_left = Point(pose_j[0]+turning_radius*math.cos(pose_j[2]+math.pi/2), pose_j[1]+turning_radius*math.sin(pose_j[2]+math.pi/2))
    pj_right = Point(pose_j[0]+turning_radius*math.cos(pose_j[2]-math.pi/2), pose_j[1]+turning_radius*math.sin(pose_j[2]-math.pi/2))
    if pi.distance(pj_left) < turning_radius:
        return False
    if pi.distance(pj_right) < turning_radius:
        return False
    if pj_left.distance(pi_right) < 2*turning_radius:
        return False
    if pj_right.distance(pi_left) < 2*turning_radius:
        return False

    xdiff = pose_i[0] - pose_j[0]
    ydiff = pose_i[1] - pose_j[1]
    pj_i = shapely.affinity.rotate(Point(xdiff, ydiff), -pose_j[2] , origin=(0, 0), use_radians=True)
    if abs(pj_i.y) > turning_radius and abs(pj_i.x) < turning_radius:
        return False
    if (pj_i.y*pj_i.x > 0 and angle_diff < -15*math.pi/180.0) or (pj_i.y*pj_i.x < 0 and angle_diff > 15*math.pi/180.0):
        return False
    # if pj_i.y*pj_i.x > 0 and angle_diff < 5*math.pi/180.0:
    #     continue



    p2 = [ xdiff*math.cos(pose_j[2])+ydiff*math.sin(pose_j[2]), xdiff*math.sin(pose_j[2])+ydiff*math.cos(pose_j[2]), angle_diff]
    if not line.intersects(blocked) :
        #print('connect  '+str(i)+'  '+str(j))
        return True
    else:
        return False

def createPosesDataframe(poses, pose_type, connections):
    type_field = ['graph_pose']*len(poses)
    connection_field = [[]]*len(poses)
    for i,j in connections:
        connection_field[i].append(j)
        connection_field[j].append(i)
    gdf = gpd.GeoDataFrame({'type': type_field, 'poses': poses,'pose_type': pose_type, 'connections': connection_field})



    return gdf

def createGraphDataframe_without_transit(home_pose, streets, holes, blocked, obstacles, high_obstacles, geofence, obstacle_buffer_distance, turning_radius, hole_distance, progress_callback):
    home_pose_0 = home_pose['poses'][0]
    poses_street = posesFromGeoDataFrame(streets, blocked, obstacles, high_obstacles, geofence)
    prev_poses= home_pose_0 + poses_street
    poses_holes, extra_connections = generateLoadingPoses(streets, holes, blocked, prev_poses, obstacle_buffer_distance, turning_radius, hole_distance, progress_callback)
    all_poses = prev_poses
    drillhole_ids = [None]*(1+len(poses_street))
    pose_type = ['home_pose'] + ['street']*len(poses_street)

    for i,poses_hole in enumerate(poses_holes):
        all_poses += poses_hole
        drillhole_ids += [None]*(len(poses_hole)-1)+[holes['drillhole_id'][i]]
        pose_type += ['street']*(len(poses_hole)-1)+['hole']



    if progress_callback: progress_callback(30)

    #connections, lines = makeConnections(all_poses, blocked, extra_connections, turning_radius, progress_callback)
    connections, lines = makeConnections(all_poses, blocked, extra_connections, turning_radius, progress_callback, pose_type)
    if progress_callback: progress_callback(95)
    checkConnections(all_poses, connections, pose_type)

    connections_field = []
    for i in range(0, len(all_poses)):
        connections_field.append([])
    for i,j in connections:
        connections_field[i].append(j)
        connections_field[j].append(i)
    # plt.Figure()
    # blocked.plot(ax=plt.gca(),color='red')
    # lines.plot(ax=plt.gca(),color='k')
    # plt.show()

    # Create geometry column from poses
    geometry = [Point(pose[0], pose[1]) for pose in all_poses]
    
    gdf = gpd.GeoDataFrame({
        'type': ['graph_pose']*len(all_poses), 
        'graph_pose': all_poses,
        'pose_type': pose_type, 
        'drillhole_id': drillhole_ids, 
        'graph_id': range(0, len(all_poses)), 
        'connections': connections_field,
        'geometry': geometry
    })
    
    # Set CRS
    if hasattr(home_pose, 'crs'):
        gdf.set_crs(home_pose.crs, inplace=True)

    return gdf


def createGraphDataframe(home_pose, streets, transit_streets, holes, blocked, obstacles, high_obstacles, geofence, obstacle_buffer_distance, turning_radius, hole_distance, progress_callback):

    home_pose_0 = home_pose['poses'][0]
    poses_street = posesFromGeoDataFrame(streets, blocked, obstacles, high_obstacles, geofence)
    poses_transit = posesFromGeoDataFrame(transit_streets, blocked, obstacles, high_obstacles, geofence)

    prev_poses= home_pose_0 + poses_street + poses_transit
    poses_holes, extra_connections = generateLoadingPoses(streets, holes, blocked, prev_poses, obstacle_buffer_distance, turning_radius, hole_distance, progress_callback)
    all_poses = prev_poses
    drillhole_ids = [None]*(1+len(poses_street)+len(poses_transit))
    pose_type = ['home_pose'] + ['street']*len(poses_street) + ['transit_street']*len(poses_transit)

    for i,poses_hole in enumerate(poses_holes):
        all_poses += poses_hole
        drillhole_ids += [None]*(len(poses_hole)-1)+[holes['drillhole_id'][i]]
        pose_type += ['street']*(len(poses_hole)-1)+['hole']



    if progress_callback: progress_callback(30)

    #connections, lines = makeConnections(all_poses, blocked, extra_connections, turning_radius, progress_callback) old
    connections, lines = makeConnections(all_poses, blocked, extra_connections,turning_radius, progress_callback, pose_type)
    if progress_callback: progress_callback(95)
    checkConnections(all_poses, connections, pose_type)

    connections_field = []
    for i in range(0, len(all_poses)):
        connections_field.append([])
    for i,j in connections:
        connections_field[i].append(j)
        connections_field[j].append(i)
    # plt.Figure()
    # blocked.plot(ax=plt.gca(),color='red')
    # lines.plot(ax=plt.gca(),color='k')
    # plt.show()

    # Create geometry column from poses
    geometry = [Point(pose[0], pose[1]) for pose in all_poses]

    gdf = gpd.GeoDataFrame({
        'type': ['graph_pose']*len(all_poses), 
        'graph_pose': all_poses,
        'pose_type': pose_type, 
        'drillhole_id': drillhole_ids, 
        'graph_id': range(0, len(all_poses)), 
        'connections': connections_field,
        'geometry': geometry
    })
    
    # Set CRS
    if hasattr(home_pose, 'crs'):
        gdf.set_crs(home_pose.crs, inplace=True)

    return gdf



def makeConnections(poses, blocked, extra_connections, turning_radius, progress_callback, pose_type):
    connections = extra_connections
    lines = []
    for i in range(0, len(connections)):
        line =  LineString([poses[connections[i][0]][0:2], poses[connections[i][1]][0:2]])
        lines.append(line)
    iter = 0
    for i in range(0, len(poses)):

        for j in range(0, i):
            if i != j:
                if shouldConnect(poses[i], poses[j], turning_radius, blocked, pose_type[i], pose_type[j]):
                    connections.append([i, j])
                    line =  LineString([poses[i][0:2], poses[j][0:2]])
                    lines.append(line)
            if progress_callback: progress_callback(30+int(60*(iter)*2/(len(poses)*(len(poses)+1))))
            iter += 1

    if len(lines) == 0:
        return connections, gpd.GeoDataFrame(geometry=gpd.GeoSeries(LineString([])) )
    lines =gpd.GeoDataFrame(geometry=gpd.GeoSeries(lines) )
    return connections, lines

def checkConnections(poses : list, connections : list, pose_type : list) -> bool:
    """ Checks if home and holes are connected in an unique subgraph (shows a warning when failing) """
    nodes = [i for i in range(len(poses))]
    edges = connections

    G = nx.Graph()
    G.add_nodes_from(nodes)
    G.add_edges_from(edges)

    home_ids = []
    hole_ids = []

    for i in range(len(pose_type)):
        if pose_type[i] == 'home' or pose_type[i] == 'home_pose':
            home_ids.append(i)
        if pose_type[i] == 'hole':
            hole_ids.append(i)

    graphs = nx.connected_components(G)

    home_graph_set = set()
    hole_graph_set = set()

    u = 0
    for g in graphs:
        for home in home_ids:
            if home in g:
                home_graph_set.add(u)
        for hole in hole_ids:
            if hole in g:
                hole_graph_set.add(u)
        u += 1

    print("Hay", u, "subgrafos conectados")

    home_graph_list = list(home_graph_set)
    hole_graph_list = list(hole_graph_set)

    is_ok = False

    if len(home_ids) != 1:
        # msgBox = QMessageBox ()
        # msgBox.setWindowTitle("Advertencia!")
        # msgBox.setText("%d waypoints home (debe haber sólo uno)" % len(home_ids))
        # msgBox.exec()
        raise ValueError("Advertencia waypoints home")
    elif len(home_graph_list) != 1:
        # msgBox = QMessageBox ()
        # msgBox.setWindowTitle("Advertencia!")
        # msgBox.setText("%d nodos home (debe haber sólo uno)" % len(home_graph_list))
        # msgBox.exec()
        raise ValueError("Advertencia nodos home")
    elif len(hole_graph_list) != 1:
        # msgBox = QMessageBox ()
        # msgBox.setWindowTitle("Advertencia!")
        # msgBox.setText("Agujeros desconectados")
        # msgBox.exec()
        raise ValueError("Pozos desconectados")
    else:
        if hole_graph_list[0] != home_graph_list[0]:
            # msgBox = QMessageBox ()
            # msgBox.setWindowTitle("Advertencia!")
            # msgBox.setText("Home no está conectado con los agujeros")
            # msgBox.exec()
            raise ValueError("Home no está conectado con los pozos")
        else:
            is_ok = True

    #nx.draw(G, with_labels=True, font_weight='bold')
    #plt.show()
    return is_ok


def readHolFile(filename : str, WGS84):
    if filename.endswith(".hol"):
        with open(filename, 'r') as f:
            lines = f.readlines()
            lines = [ line.strip() for line in lines]
            lines = [list(filter(None,line.split(' ') )) for line in lines]
            #print(lines )
            #         x                    y                z            z_hole         unkown0          unkown1        unkown2          unkown3         drillhole_id    mesh
            lines = [[float(line[0]), float(line[1]) ,float(line[2]) ,float(line[3]) ,float(line[4]) ,float(line[5]) , float(line[6]) , float(line[7]) , int(line[8]) , line[9]   ] for line in lines]
        gdf = gpd.GeoDataFrame(lines, columns=['x', 'y', 'z', 'z_hole', 'unkown0', 'unkown1', 'unkown2', 'unkown3', 'drillhole_id', 'mesh'])
    elif filename.endswith(".csv"):
        df = pd.read_csv(filename)
        df['x'] = df['Drill collar X (m)']
        df['y'] = df['Drill collar Y (m)']
        df['z'] = df['Drill collar Z (m)']
        df['z_hole'] = df['Drill collar Z (m)'] - df['Drill depth (m)']
        df['unkown0'] = 270
        df['unkown1'] = 0.0
        df['unkown2'] = 0
        df['unkown3'] = -90
        df['drillhole_id'] = df['Hole ID']
        df['mesh'] = df['BENCH NIMBER']
        gdf = gpd.GeoDataFrame({'x':df['x'], 'y':df['y'], 'z':df['z'], 'z_hole': df['z_hole'], 'unkown0': df['unkown0'],
            'unkown1': df['unkown1'], 'unkown2': df['unkown2'], 'unkown3': df['unkown3'], 'drillhole_id': df['drillhole_id'], 'mesh': df['mesh']})
    elif filename.endswith(".geojson") or filename.endswith(".json"):
        gdf = gpd.read_file(filename)
        # Ensure we have the necessary columns. If x/y are missing, try to get them from geometry (assuming UTM or converting)
        if 'x' not in gdf.columns or 'y' not in gdf.columns:
            # If CRS is missing, assume 4326 (common for GeoJSON)
            if gdf.crs is None:
                gdf.set_crs('EPSG:4326', inplace=True)
            
            # Convert to UTM 19S (EPSG:32719) to get metric coordinates
            gdf_utm = gdf.to_crs('EPSG:32719')
            gdf['x'] = gdf_utm.geometry.x
            gdf['y'] = gdf_utm.geometry.y
        
        # Fill missing columns with defaults
        if 'z' not in gdf.columns: gdf['z'] = 0.0
        if 'z_hole' not in gdf.columns: gdf['z_hole'] = 0.0
        if 'drillhole_id' not in gdf.columns: gdf['drillhole_id'] = range(len(gdf))
        if 'mesh' not in gdf.columns: gdf['mesh'] = 'default'
        
        gdf['unkown0'] = 270
        gdf['unkown1'] = 0.0
        gdf['unkown2'] = 0
        gdf['unkown3'] = -90
    else:
        print("Unsupported format");

    gdf = gdf.set_geometry( list(gpd.points_from_xy(gdf.x, gdf.y)) )    #gdf['geometry'] = gpd.points_from_xy(gdf.x, gdf.y)
    gdf['drillhole_depth'] = gdf['z']-gdf['z_hole']
    gdf['type'] = 'hole'
    gdf.set_geometry('geometry')
    if(WGS84):
        gdf.crs = 'EPSG:32719'
    else:
        gdf.crs = 'EPSG:4326'
        gdf = gdf.to_crs('EPSG:32719')
        gdf.crs = 'EPSG:32719'
    return gdf

def split_ring(ring, split):
    """Split a linear ring geometry, returns a [Multi]LineString

    See my PostGIS function on scigen named ST_SplitRing
    """
    valid_types = ('MultiLineString', 'LineString', 'GeometryCollection')
    if not hasattr(ring, 'geom_type'):
        raise ValueError('expected ring as a geometry')
    elif not hasattr(split, 'geom_type'):
        raise ValueError('expected split as a geometry')
    if ring.geom_type == 'LinearRing':
        ring = LineString(ring)
    if ring.geom_type != 'LineString':
        raise ValueError(
            'ring is not a LinearRing or LineString, found '
            + str(ring.geom_type))
    elif not ring.is_closed:
        raise ValueError('ring is not closed')
    elif split.is_empty:
        return ring
    elif not split.intersects(ring):
        # split does not intersect ring
        return ring
    if split.geom_type == 'LinearRing':
        split = LineString(split)
    if split.geom_type not in valid_types:
        raise ValueError(
            'split is not a LineString-like or GeometryCollection geometry, '
            'found ' + str(split.geom_type))

    intersections = ring.intersection(split)
    if intersections.is_empty:
        # no intersections, returning same ring
        return ring
    elif intersections.geom_type == 'Point':
        # Simple case, where there is only one line intersecting the ring
        result = Polygon(ring).difference(split).exterior
        # If it is a coordinate of the ring, then the ring needs to be rotated
        coords = result.coords[:-1]
        found_i = 0
        for i, c in enumerate(coords):
            if Point(c).almost_equals(intersections):
                found_i = i
                break
        if found_i > 0:
            result = Polygon(coords[i:] + coords[:i]).exterior
        if result.interpolate(0).distance(intersections) > 0:
            raise Exception(
                'result start point %s to intersection %s is %s' %
                (result.interpolate(0), intersections,
                 result.distance(intersections)))
        elif result.geom_type != 'LinearRing':
            raise Exception(
                'result is not a LinearRing, found ' + result.geom_type)
        elif not result.is_closed:
            raise Exception('result is not closed')
        return LineString(result)

    difference = ring.difference(split)
    if difference.geom_type != 'MultiLineString':
        raise ValueError(
            'expected MultiLineString difference, found '
            + difference.geom_type)

    start_point = ring.interpolate(0)
    if start_point.distance(intersections) == 0:
        # special case: start point is the same as an intersection
        return difference

    # Otherwise the line where the close meets needs to be fused
    fuse = []
    parts = list(difference.geoms)
    for ipart, part in enumerate(parts):
        if part.intersects(start_point):
            fuse.append(ipart)
    if len(fuse) != 2:
        raise ValueError('expected 2 geometries, found ' + str(len(fuse)))
    # glue the last to the first
    popped_part = parts.pop(fuse[1])
    parts[fuse[0]] = linemerge([parts[fuse[0]], popped_part])
    return parts

def generate_arrow_geojson(graph_dataframe, crs):
    """
    Generates a GeoJSON-compatible dictionary of arrow geometries from the graph dataframe.
    """
    if graph_dataframe is None or graph_dataframe.empty:
        return None

    geometries = []

    for idx, row in graph_dataframe.iterrows():
        pose = row['graph_pose']
        x0 = pose[0]
        y0 = pose[1]
        theta = pose[2]
        
        # Arrow head calculation
        x1 = x0 + 0.3 * math.cos(20 * math.pi / 180) * math.cos(theta) * 0.5
        y1 = y0 + 0.3 * math.cos(20 * math.pi / 180) * math.sin(theta) * 0.5
        
        x2_left = x1 - 0.3 * math.cos(theta + 20 * math.pi / 180)
        y2_left = y1 - 0.3 * math.sin(theta + 20 * math.pi / 180)
        
        x2_right = x1 - 0.3 * math.cos(theta - 20 * math.pi / 180)
        y2_right = y1 - 0.3 * math.sin(theta - 20 * math.pi / 180)
        
        # Add left wing
        geometries.append(LineString([(x1, y1), (x2_left, y2_left)]))
        # Add right wing
        geometries.append(LineString([(x1, y1), (x2_right, y2_right)]))

    graph_draw = gpd.GeoDataFrame(geometry=geometries)
    graph_draw.crs = crs

    if graph_draw.crs != 'EPSG:4326':
        graph_draw = graph_draw.to_crs('EPSG:4326')

    return graph_draw.to_json()
