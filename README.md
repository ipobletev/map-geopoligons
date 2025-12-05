# Map Geopoligons

This repository contains tools for mapping, drawing, and managing geographical polygons, with automatic conversion between GPS (Latitude/Longitude) and UTM coordinates.

It includes two different implementations of the application:

## 1. Frontend (Web Version)
A modern, browser-based implementation built with **React**, **TypeScript**, and **Leaflet**.

-   **Location**: [`frontend/`](./frontend)
-   **Tech Stack**: React, Vite, TypeScript, Leaflet, Proj4.
-   **Features**:
    -   Full interactive map in the browser.
    -   Draw and edit shapes (Polygons, Lines, Points).
    -   Save/Load GeoJSON files.
    -   Fast and responsive.
-   **Quick Start**:
    ```bash
    cd frontend
    npm install
    npm run dev
    ```

## 2. Qt-Python (Desktop Version)
The original desktop application built with **Python**, **PyQt5**, and **Folium**.

-   **Location**: [`qt-python/`](./qt-python)
-   **Tech Stack**: Python 3, PyQt5, Folium, Jinja2.
-   **Features**:
    -   Desktop window wrapper around a Leaflet map.
    -   Python-based logic for coordinate conversion.
    -   Generates HTML maps dynamically.
-   **Quick Start**:
    ```bash
    cd qt-python
    # Ensure you have the dependencies installed (see qt-python/README.md)
    python src/main.py
    or
    ./run.bat
    ```

## Shared Features
Both versions share the core functionality:
-   **GeoJSON Export**: Saving drawings produces standard GeoJSON files.
-   **UTM Enrichment**: Both tools calculate and embed UTM coordinates (Easting, Northing, Zone) into the saved GeoJSON properties, useful for engineering and surveying applications.
