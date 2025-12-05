# Folium Map with Drawing & Saving

A simple desktop application built with Python, PyQt5, and Folium that allows you to visualize a map, draw polygons on it, and save them as GeoJSON files.

## Features

- Interactive map visualization using Folium.
- Drawing tools to create polygons, rectangles, circles, and markers.
- Save drawings in GeoJSON format with a timestamp in the filename.
- GUI based on Qt (PyQt5).

## Prerequisites

- Python 3.x installed on your system.

## Quick Start

You can use the provided scripts to automatically set up the environment and run the application.

### Windows
Double-click `run.bat` or run in terminal:
```bash
.\run.bat
```

### Linux
Run in terminal:
```bash
chmod +x run.sh
./run.sh
```

## Environment Setup

Follow these steps to set up the project and its virtual environment.

### 1. Create a Virtual Environment (.venv)

It is recommended to use a virtual environment to isolate project dependencies.

```bash
python -m venv .venv
```

### 2. Activate the Virtual Environment

```bash
source .venv/Scripts/activate
```

### 3. Install Dependencies

```bash
pip install -r requirements.txt
```

## Execution

To start the application, run the main script located in the `src` folder:

```bash
python src/folium_qt_app.py
```

## Usage

1.  **Draw**: Use the controls in the top-left corner of the map to draw shapes.
2.  **Save**: Click the "Save Polygons" button to save your drawings to the `draws` folder. Files will be saved with the format `drawing_YYYYMMDD_HHMMSS.geojson`.
3.  **Clear**: Use the "Clear Map" button to erase current drawings.

## Project Structure

```
map-geopoligons/
├── .venv/              # Virtual environment (created by you)
├── draws/              # Folder where GeoJSON files are saved
├── src/
│   └── folium_qt_app.py # Main source code
├── requirements.txt    # List of dependencies
├── run.bat             # Windows execution script
├── run.sh              # Linux execution script
└── README.md           # This file
```
