import sys
import io
import os
import json
from datetime import datetime
import folium
from folium.plugins import Draw
from PyQt5.QtWidgets import QApplication, QMainWindow, QVBoxLayout, QHBoxLayout, QWidget, QPushButton, QMessageBox
from PyQt5.QtWebEngineWidgets import QWebEngineView
from PyQt5.QtCore import QUrl
from gps_converter import GPSConverter

class MapWindow(QMainWindow):
    def __init__(self, location, save_folder, resize):
        super().__init__()
        self.setWindowTitle("Folium Map with Drawing & Saving")
        self.resize(*resize)
        self.save_folder = save_folder

        # Create the map with Folium
        m = folium.Map(location=location, zoom_start=13)

        # Add drawing tool using the official plugin
        draw = Draw(
            export=False,
            position='topleft',
            draw_options={
                'polyline': True,
                'rectangle': True,
                'polygon': True,
                'circle': True,
                'marker': True,
                'circlemarker': False
            },
            edit_options={'poly': {'allowIntersection': False}}
        )
        draw.add_to(m)

        # Save the base map to HTML
        data = io.BytesIO()
        m.save(data, close_file=False)
        html_content = data.getvalue().decode()

        # More robust custom script
        # Load custom JS from external file
        js_file_path = os.path.join(os.path.dirname(__file__), 'map_interactions.js')
        try:
            with open(js_file_path, 'r', encoding='utf-8') as f:
                js_content = f.read()
            custom_js = f"<script>{js_content}</script>"
        except Exception as e:
            print(f"Error loading external JS file: {e}")
            custom_js = ""

        # Insert the script at the end of the body
        if '</body>' in html_content:
            html_content = html_content.replace('</body>', custom_js + '</body>')
        else:
            html_content += custom_js

        # Configure UI
        central_widget = QWidget()
        self.setCentralWidget(central_widget)
        main_layout = QVBoxLayout(central_widget)

        # Buttons
        button_layout = QHBoxLayout()
        
        self.btn_save = QPushButton("Save Polygons")
        self.btn_save.clicked.connect(self.save_polygons)
        button_layout.addWidget(self.btn_save)

        self.btn_clear = QPushButton("Clear Map")
        self.btn_clear.clicked.connect(self.clear_map)
        button_layout.addWidget(self.btn_clear)

        main_layout.addLayout(button_layout)

        # Browser
        self.browser = QWebEngineView()
        # Using baseUrl helps resolve security issues and relative paths
        self.browser.setHtml(html_content, baseUrl=QUrl.fromLocalFile(os.getcwd() + os.path.sep))
        main_layout.addWidget(self.browser)

    def save_polygons(self):
        self.browser.page().runJavaScript("window.getGeoJSON()", self.handle_geojson)

    def handle_geojson(self, geojson_str):
        if not geojson_str:
            print("GeoJSON empty or null")
            return

        try:
            data = json.loads(geojson_str)
            if not data.get('features'):
                QMessageBox.warning(self, "Warning", "No shapes to save.")
                return

            # Enrich features with UTM coordinates
            for feature in data['features']:
                geometry = feature.get('geometry')
                if not geometry:
                    continue
                
                coords = geometry.get('coordinates')
                geom_type = geometry.get('type')
                
                utm_coords = None
                
                if geom_type == 'Point':
                    # Point: [lon, lat]
                    if len(coords) >= 2:
                        lon, lat = coords[0], coords[1]
                        utm_coords = GPSConverter.to_utm(lat, lon)
                        
                elif geom_type == 'LineString':
                    # LineString: [[lon, lat], ...]
                    utm_coords = []
                    for point in coords:
                        if len(point) >= 2:
                            lon, lat = point[0], point[1]
                            utm = GPSConverter.to_utm(lat, lon)
                            if utm:
                                utm_coords.append(utm)
                                
                elif geom_type == 'Polygon':
                    # Polygon: [[[lon, lat], ...]] (list of rings)
                    utm_coords = []
                    for ring in coords:
                        ring_utm = []
                        for point in ring:
                            if len(point) >= 2:
                                lon, lat = point[0], point[1]
                                utm = GPSConverter.to_utm(lat, lon)
                                if utm:
                                    ring_utm.append(utm)
                        utm_coords.append(ring_utm)
                
                if utm_coords:
                    if 'properties' not in feature:
                        feature['properties'] = {}
                    feature['properties']['utm_coordinates'] = utm_coords

            folder = self.save_folder
            if not os.path.exists(folder):
                os.makedirs(folder)

            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = os.path.join(folder, f"drawing_{timestamp}.geojson")

            with open(filename, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=4)

            QMessageBox.information(self, "Success", f"File saved: {filename}")

        except Exception as e:
            print(f"Error processing GeoJSON: {e}")
            QMessageBox.critical(self, "Error", f"Error saving: {str(e)}")

    def clear_map(self):
        self.browser.page().runJavaScript("window.clearMap()")
        # Reloading the page might be a cleaner option if JS fails, but let's try JS first
        # self.browser.setHtml(self.html_content, ...)
