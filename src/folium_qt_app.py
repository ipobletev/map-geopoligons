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
        custom_js = """
        <script>
            // Define global variables immediately
            window.myDrawnItems = new L.FeatureGroup();
            
            window.getGeoJSON = function() {
                return JSON.stringify(window.myDrawnItems.toGeoJSON());
            };

            window.clearMap = function() {
                window.myDrawnItems.clearLayers();
                // Also try to clear map layers if they were added directly
                // This depends on how the Draw plugin handles layers, but myDrawnItems is our tracker
            };

            // Initialization function
            function initMapInteractions() {
                var map = null;
                // Find the map instance
                for (var key in window) {
                    if (window[key] instanceof L.Map) {
                        map = window[key];
                        break;
                    }
                }

                if (map) {
                    console.log("Map found, initializing interactions.");
                    map.addLayer(window.myDrawnItems);

                    // Listen for creation events
                    map.on('draw:created', function(e) {
                        var layer = e.layer;
                        window.myDrawnItems.addLayer(layer);
                        map.addLayer(layer); // Ensure it is visible if the plugin does not do it
                    });
                    
                    // Handle deletion if the user uses the edit tool to delete
                    map.on('draw:deleted', function(e) {
                        var layers = e.layers;
                        layers.eachLayer(function(layer) {
                            window.myDrawnItems.removeLayer(layer);
                        });
                    });
                } else {
                    console.log("Map not found yet, retrying...");
                    setTimeout(initMapInteractions, 500);
                }
            }

            // Start when the document is ready
            if (document.readyState === 'complete') {
                initMapInteractions();
            } else {
                window.addEventListener('load', initMapInteractions);
            }
        </script>
        """

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

if __name__ == "__main__":

    LOCATION = [-33.4489, -70.6693]
    SAVE_FOLDER = "draws" 
    RESIZE = (1000, 800)

    app = QApplication(sys.argv)
    window = MapWindow(LOCATION, SAVE_FOLDER, RESIZE)
    window.show()
    sys.exit(app.exec_())
