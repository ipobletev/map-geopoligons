import sys
import os
import json
import io
from PyQt5.QtWidgets import (
    QApplication, QMainWindow, QVBoxLayout, QHBoxLayout,
    QWidget, QPushButton, QLabel, QMessageBox, QFileDialog
)
from PyQt5.QtWebEngineWidgets import QWebEngineView
from PyQt5.QtCore import QUrl
import folium
from folium.plugins import Draw
from gps_utm_converter import GpsUtmConverter

class WizardWindow(QMainWindow):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("Map Wizard Generator")
        self.resize(1200, 800)

        self.output_dir = ""
        self.steps = [
            {"key": "objective", "label": "Step 1: Objective", "desc": "Draw the locations where the objective must reach (Point/Polygon)."},
            {"key": "geofence", "label": "Step 2: Geofence", "desc": "Draw robot work area (Polygon)."},
            {"key": "home", "label": "Step 3: Home", "desc": "Draw the robot's starting point (Point)."},
            {"key": "road", "label": "Step 4: Road", "desc": "Draw the roads the robot should use (LineString/Polygon)."},
            {"key": "transit_road", "label": "Step 5: Transit Road", "desc": "Draw roads for transit only (LineString/Polygon)."},
            {"key": "obstacles", "label": "Step 6: Obstacles", "desc": "Draw obstacles that restrict passage (Polygon)."},
            {"key": "tall_obstacle", "label": "Step 7: Tall Obstacles", "desc": "Draw tall obstacles (Polygon)."}
        ]
        self.current_step = 0

        # Select output directory first
        self.base_output_dir = os.path.join(os.getcwd(), "geojson")
        self.setup_output_directory()

        # UI Setup
        central_widget = QWidget()
        self.setCentralWidget(central_widget)
        layout = QVBoxLayout(central_widget)

        # Info Panel
        info_layout = QHBoxLayout()
        self.lbl_step = QLabel("Step: -")
        self.lbl_desc = QLabel("Description: -")
        self.lbl_step.setStyleSheet("font-weight: bold; font-size: 16px; color: #333;")
        self.lbl_desc.setStyleSheet("font-size: 14px; color: #555;")

        info_layout.addWidget(self.lbl_step)
        info_layout.addWidget(self.lbl_desc)
        info_layout.addStretch()

        # Navigation Buttons
        self.btn_prev = QPushButton("Previous")
        self.btn_prev.clicked.connect(self.prev_step)
        self.btn_prev.setStyleSheet("background-color: #6c757d; color: white; font-weight: bold; padding: 8px 20px; border-radius: 4px;")
        info_layout.addWidget(self.btn_prev)

        self.btn_save = QPushButton("Save")
        self.btn_save.clicked.connect(self.save_current_step)
        self.btn_save.setStyleSheet("background-color: #28a745; color: white; font-weight: bold; padding: 8px 20px; border-radius: 4px;")
        info_layout.addWidget(self.btn_save)

        self.btn_next = QPushButton("Next")
        self.btn_next.clicked.connect(self.next_step)
        self.btn_next.setStyleSheet("background-color: #007BFF; color: white; font-weight: bold; padding: 8px 20px; border-radius: 4px;")
        info_layout.addWidget(self.btn_next)

        # Extra controls
        self.btn_load_all = QPushButton("Show All")
        self.btn_load_all.clicked.connect(self.load_all_geojsons)
        info_layout.addWidget(self.btn_load_all)

        self.btn_clear_all = QPushButton("Clear Map")
        self.btn_clear_all.clicked.connect(self.clear_all_layers)
        info_layout.addWidget(self.btn_clear_all)

        layout.addLayout(info_layout)

        # Map
        self.browser = QWebEngineView()
        layout.addWidget(self.browser)

        self.init_map()
        self.init_map()
        # self.update_ui_for_step() # Called by on_map_ready

    def setup_output_directory(self):
        from datetime import datetime
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        self.output_dir = os.path.join(self.base_output_dir, timestamp)
        if not os.path.exists(self.output_dir):
            os.makedirs(self.output_dir)
        print(f"Output directory: {self.output_dir}")

    def load_all_geojsons(self):
        options = QFileDialog.Options()
        files, _ = QFileDialog.getOpenFileNames(
            self, "Load GeoJSONs", self.output_dir, "GeoJSON Files (*.geojson);;All Files (*)", options=options
        )
        if files:
            for filename in files:
                self.load_layer_file(filename)

    def clear_all_layers(self):
        self.browser.page().runJavaScript("window.clearStaticLayers(); window.clearMap();")

    def load_layer_file(self, filename):
        if os.path.exists(filename):
            try:
                with open(filename, 'r', encoding='utf-8') as f:
                    content = f.read()
                    if not content.strip():
                        print(f"Skipping empty file: {filename}")
                        return

                    data = json.loads(content)
                    json_str = json.dumps(data)
                    self.browser.page().runJavaScript(
                        f"window.addStaticGeoJSON({json_str}, '#555555')"
                    )
            except Exception as e:
                print(f"Error loading layer {filename}: {e}")

    def init_map(self):
        # Default location: Santiago, Chile
        m = folium.Map(location=[-33.4489, -70.6693], zoom_start=15)

        draw = Draw(
            export=False,
            position='topleft',
            draw_options={
                'polyline': True,
                'rectangle': True,
                'polygon': True,
                'circle': False,
                'marker': True,
                'circlemarker': False
            },
            edit_options={'poly': {'allowIntersection': False}}
        )
        draw.add_to(m)

        data = io.BytesIO()
        m.save(data, close_file=False)
        html_content = data.getvalue().decode()

        # Inject JS
        js_file_path = os.path.join(os.path.dirname(__file__), 'map_interactions.js')
        if os.path.exists(js_file_path):
            with open(js_file_path, 'r', encoding='utf-8') as f:
                js_content = f.read()
            html_content = html_content.replace('</body>', f'<script>{js_content}</script></body>')
        else:
            print(f"Warning: {js_file_path} not found.")

        self.browser.loadFinished.connect(self.on_map_ready)
        self.browser.setHtml(html_content, baseUrl=QUrl.fromLocalFile(os.getcwd() + os.path.sep))

    def on_map_ready(self, ok):
        if ok:
            self.update_ui_for_step()

    def load_static_layers(self):
        # Clear existing static layers
        self.browser.page().runJavaScript("window.clearStaticLayers()")

        # Load previous steps
        for i in range(self.current_step):
            step = self.steps[i]
            filename = os.path.join(self.output_dir, f"{step['key']}.geojson")
            self.load_layer_file(filename)

    def load_current_step_editable(self):
        # Check if current step has a file
        if self.current_step < len(self.steps):
            step = self.steps[self.current_step]
            filename = os.path.join(self.output_dir, f"{step['key']}.geojson")
            if os.path.exists(filename):
                try:
                    with open(filename, 'r', encoding='utf-8') as f:
                        content = f.read()
                        if content.strip():
                            data = json.loads(content)
                            json_str = json.dumps(data)
                            self.browser.page().runJavaScript(f"window.setEditableGeoJSON({json_str})")
                except Exception as e:
                    print(f"Error loading editable layer {filename}: {e}")
            else:
                self.browser.page().runJavaScript("window.clearMap()")

    def update_ui_for_step(self):
        if self.current_step < len(self.steps):
            step = self.steps[self.current_step]
            self.lbl_step.setText(f"{step['label']} ({step['key']}.geojson)")
            self.lbl_desc.setText(step['desc'])

            self.btn_prev.setEnabled(self.current_step > 0)
            self.btn_next.setText("Next")
            self.btn_next.setEnabled(True)

            # Load layers
            self.load_static_layers()
            self.load_current_step_editable()

        else:
            self.lbl_step.setText("Finished")
            self.lbl_desc.setText("All steps completed.")
            self.btn_prev.setEnabled(True)
            self.btn_save.setEnabled(False)
            self.btn_next.setText("Close")
            self.btn_next.clicked.disconnect()
            self.btn_next.clicked.connect(self.close)

            # Load all as static
            self.load_static_layers()
            self.browser.page().runJavaScript("window.clearMap()")

    def save_current_step(self):
        self.browser.page().runJavaScript("window.getGeoJSON()", lambda data: self.handle_geojson(data, advance=False))

    def prev_step(self):
        self.browser.page().runJavaScript("window.getGeoJSON()", self.handle_geojson_back)

    def next_step(self):
        self.browser.page().runJavaScript("window.getGeoJSON()", lambda data: self.handle_geojson(data, advance=True))

    def handle_geojson_back(self, geojson_str):
        # Save current step then go back
        if geojson_str:
            try:
                data = json.loads(geojson_str)
                # Only save if it has features
                if data.get('features'):
                    self.enrich_with_utm(data)
                    step = self.steps[self.current_step]
                    filename = os.path.join(self.output_dir, f"{step['key']}.geojson")
                    with open(filename, 'w', encoding='utf-8') as f:
                        json.dump(data, f, indent=4)
            except Exception:
                pass

        if self.current_step > 0:
            self.current_step -= 1
            self.update_ui_for_step()

    def handle_geojson(self, geojson_str, advance=True):
        if not geojson_str:
            print("GeoJSON string is empty")
            return

        try:
            data = json.loads(geojson_str)
        except json.JSONDecodeError as e:
            print(f"Error decoding GeoJSON: {e}")
            return

        # Enrich with UTM
        self.enrich_with_utm(data)

        step = self.steps[self.current_step]
        filename = os.path.join(self.output_dir, f"{step['key']}.geojson")

        try:
            # Ensure directory exists
            if not os.path.exists(self.output_dir):
                os.makedirs(self.output_dir)

            with open(filename, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=4)
                f.flush()
                os.fsync(f.fileno())

            print(f"Saved {filename}")
            QMessageBox.information(self, "Saved", f"Saved: {step['key']}.geojson")

            if not advance:
                return

        except Exception as e:
            QMessageBox.critical(self, "Error", f"Error saving file: {e}")
            return

        if advance:
            self.current_step += 1
            self.update_ui_for_step()

    def enrich_with_utm(self, data):
        if not data.get('features'):
            return

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
                    utm_coords = GpsUtmConverter.to_utm(lat, lon)

            elif geom_type == 'LineString':
                # LineString: [[lon, lat], ...]
                utm_coords = []
                for point in coords:
                    if len(point) >= 2:
                        lon, lat = point[0], point[1]
                        utm = GpsUtmConverter.to_utm(lat, lon)
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
                            utm = GpsUtmConverter.to_utm(lat, lon)
                            if utm:
                                ring_utm.append(utm)
                    utm_coords.append(ring_utm)

            if utm_coords:
                if 'properties' not in feature:
                    feature['properties'] = {}
                feature['properties']['utm_coordinates'] = utm_coords
