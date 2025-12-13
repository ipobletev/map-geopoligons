import networkx as nx
import pandas as pd
import math
import io
import heapq

from pyproj import Transformer

class GraphManager:
    def __init__(self):
        self.G = None
        self.node_data = {}
        self.pos = {}
        self.drillhole_to_node = {}
        # Transformer for UTM 19S to WGS84
        try:
            self.transformer = Transformer.from_crs("EPSG:32719", "EPSG:4326", always_xy=True)
        except Exception as e:
            print(f"Warning: Could not initialize transformer: {e}")
            self.transformer = None
        
    def load_graph_from_csv(self, csv_path):
        """
        Loads the graph from the global_plan.csv file.
        This mirrors the logic in the notebook.
        """
        try:
            df = pd.read_csv(csv_path)
            self.G = nx.DiGraph()
            self.node_data = {}
            self.pos = {}
            self.drillhole_to_node = {}
            
            # First pass: Create nodes
            for index, row in df.iterrows():
                row_type = row.get('type')
                
                if row_type == 'graph_pose':
                    # Parse graph_pose_local "x,y,theta" if available, else try graph_pose
                    # The notebook uses 'graph_pose_local' primarily for construction
                    pose_str = str(row.get('graph_pose_local', ''))
                    
                    if not pose_str or pose_str == 'nan':
                         continue

                    try:
                        pose_str = pose_str.replace('[', '').replace(']', '')
                        parts = [float(x) for x in pose_str.split(',')]
                        if len(parts) >= 3:
                            x, y, theta = parts[0], parts[1], parts[2]
                            
                            if pd.isna(row.get('graph_id')): 
                                continue
                            
                            node_id = int(row['graph_id'])
                            
                            # Try to get Global Coordinates (UTM) from graph_pose column if available
                            # This is usually what we want for the map
                            lat, lon = y, x # Default fallback
                            
                            # Try parsing global pose
                            global_pose_str = str(row.get('graph_pose', ''))
                            if global_pose_str and global_pose_str != 'nan' and self.transformer:
                                try:
                                    g_pose_str = global_pose_str.replace('[', '').replace(']', '').replace("'", "")
                                    g_parts = [float(val) for val in g_pose_str.split(',')]
                                    if len(g_parts) >= 2:
                                        utm_x, utm_y = g_parts[0], g_parts[1]
                                        # Convert to Lat/Lon
                                        lon, lat = self.transformer.transform(utm_x, utm_y)
                                except Exception as e2:
                                    # print(f"Error parsing global pose: {e2}")
                                    pass

                            # Add node
                            self.G.add_node(node_id, x=x, y=y, theta=theta, lat=lat, lon=lon, type=row.get('pose_type'))
                            self.pos[node_id] = (x, y)
                            self.node_data[node_id] = {'x': x, 'y': y, 'theta': theta, 'lat': lat, 'lon': lon}

                            # Mappings
                            pose_type = str(row.get('pose_type'))
                            if pose_type == 'home_pose':
                                self.drillhole_to_node['Home'] = node_id
                            
                            drill_id = row.get('drillhole_id')
                            if pd.notna(drill_id) and drill_id != -1:
                                self.drillhole_to_node[int(drill_id)] = node_id
                    except Exception as e:
                        print(f"Error parsing node row {index}: {e}")
                        continue

            # Second pass: Create edges
            angle_weight = 1.0
            
            def calculate_weight(n1, n2):
                dx = n1['x'] - n2['x']
                dy = n1['y'] - n2['y']
                dpos = math.sqrt(dx*dx + dy*dy)
                
                z1 = math.sin(n1['theta'] / 2)
                w1 = math.cos(n1['theta'] / 2)
                z2 = math.sin(n2['theta'] / 2)
                w2 = math.cos(n2['theta'] / 2)
                
                dot_prod = z1*z2 + w1*w2
                if dot_prod > 1.0: dot_prod = 0.9999
                if dot_prod < -1.0: dot_prod = -0.9999
                
                dangle = 2 * math.acos(abs(dot_prod))
                return dpos + dangle * angle_weight + 1.1

            for index, row in df.iterrows():
                if row.get('type') == 'graph_pose':
                    try:
                        source_id = int(row['graph_id'])
                        connections_str = str(row.get('connections', '')).replace('[', '').replace(']', '')
                        
                        if connections_str and connections_str != 'nan':
                            conn_parts = connections_str.split(',')
                            for conn in conn_parts:
                                if conn.strip():
                                    target_id = int(conn)
                                    if source_id in self.node_data and target_id in self.node_data:
                                        weight = calculate_weight(self.node_data[source_id], self.node_data[target_id])
                                        self.G.add_edge(source_id, target_id, weight=weight)
                    except Exception as e:
                        print(f"Error parsing connections row {index}: {e}")
                        continue
                        
            print(f"Graph loaded: {self.G.number_of_nodes()} nodes, {self.G.number_of_edges()} edges")
            return True
        except Exception as e:
            print(f"Error loading graph from CSV: {e}")
            return False

    def find_path(self, start_id, goal_id):
        if self.G is None:
            raise ValueError("Graph not loaded")
            
        start_id = int(start_id)
        goal_id = int(goal_id)

        if start_id not in self.G or goal_id not in self.G:
            raise ValueError(f"Start ({start_id}) or Goal ({goal_id}) node not in graph")

        def heuristic(u, v):
            n1 = self.node_data[u]
            n2 = self.node_data[v]
            return math.sqrt((n1['x'] - n2['x'])**2 + (n1['y'] - n2['y'])**2)

        try:
            path = nx.astar_path(self.G, start_id, goal_id, heuristic=heuristic, weight='weight')
            
            # Build output path with coordinates
            result_path = []
            for node_id in path:
                d = self.node_data[node_id]
                result_path.append({
                    'id': node_id,
                    'x': d['x'],
                    'y': d['y'],
                    'theta': d['theta'],
                    'lat': d.get('lat', d['y']),
                    'lon': d.get('lon', d['x'])
                })
            
            return result_path
        except nx.NetworkXNoPath:
            return None
        except Exception as e:
            print(f"A* Error: {e}")
            raise e

    def get_nodes_list(self):
        """Returns a list of interesting nodes (Home and Drillholes) for dropdowns"""
        if not self.G: return []
        nodes = []
        
        # Invert the map to sort by Label/Drillhole ID is tricky, but let's just iterate items
        # drillhole_to_node maps { 'Home': 0, 101: 5, ... }
        
        # Sort keys so list is stable. 'Home' first, then numbers.
        keys = list(self.drillhole_to_node.keys())
        
        def sort_key(k):
            if k == 'Home': return -1
            try:
                return int(k)
            except:
                return 999999
                
        keys.sort(key=sort_key)
        
        for k in keys:
            nid = self.drillhole_to_node[k]
            label = f"{k} (Node {nid})"
            nodes.append({
                'id': nid,
                'label': label,
                'type': "Drillhole/Home"
            })
            
        return nodes

# Singleton instance
graph_manager = GraphManager()
