# Map Geopoligons (Desktop Version)

This is the desktop version of the Map Geopoligons application, built with **Python**, **PyQt5**, and **Folium**. It allows users to visualize a map, draw polygons, and save them as GeoJSON files with automatic UTM coordinate enrichment.

## Features

-   **Interactive Map**: Powered by Folium (Leaflet wrapper for Python).
-   **Desktop GUI**: Built with PyQt5 for a native desktop experience.
-   **Drawing Tools**: Draw Polygons, Rectangles, Circles, and Markers.
-   **GeoJSON Support**:
    -   **Save**: Export drawings to GeoJSON files in the `draws/` directory.
    -   **Load**: Import existing GeoJSON files onto the map.
-   **UTM Conversion**: Automatically calculates and adds UTM coordinates to saved features.

## Prerequisites

-   **Python 3.x** installed on your system.

## Quick Start

You can use the provided scripts to automatically set up the environment and run the application.

### Windows
Double-click `run.bat` or run in terminal:
```bash
./run.bat
```

### Linux
Run in terminal:
```bash
chmod +x run.sh
./run.sh
```

## Manual Setup

If you prefer to set it up manually:

1.  **Create a Virtual Environment**:
    ```bash
    python -m venv .venv
    ```

2.  **Activate the Virtual Environment**:
    -   Windows: `.venv\Scripts\activate`
    -   Linux/Mac: `source .venv/bin/activate`

3.  **Install Dependencies**:
    ```bash
    pip install -r requirements.txt
    ```

4.  **Run the Application**:
    ```bash
    python src/main.py
    ```

## Usage

1.  **Draw**: Use the toolbar on the map to draw shapes.
2.  **Save**: Click "Save Polygons" to save your work. Files are saved to the `draws` folder with a timestamp.
3.  **Load**: Click "Load GeoJSON" to view previously saved files.
4.  **Clear**: Click "Clear Map" to reset the view.

## Project Structure

```
qt-python/
├── .venv/              # Virtual environment
├── draws/              # Default save location for GeoJSON files
├── src/
│   ├── main.py         # Application entry point
│   ├── folium_qt_app.py # Main GUI and Map logic
│   ├── gps_utm_converter.py # Coordinate conversion utility
│   └── map_interactions.js # Custom JavaScript for map behavior
├── requirements.txt    # Python dependencies
├── run.bat             # Windows launcher
├── run.sh              # Linux launcher
└── README.md           # This file
```
