# Map Geopoligons Frontend

This is a modern web application built with **React**, **TypeScript**, and **Vite** for managing and drawing geographical polygons on an interactive map. It replicates and enhances the functionality of the original Python/Qt application, running entirely in the browser.

## Features

-   **Interactive Map**: Powered by [React Leaflet](https://react-leaflet.js.org/).
-   **Drawing Tools**: Draw Polygons, Lines, Rectangles, Circles, and Markers using `leaflet-draw`.
-   **GeoJSON Support**:
    -   **Save**: Export your drawings as GeoJSON files.
    -   **Load**: Import existing GeoJSON files to view and edit on the map.
-   **Automatic UTM Conversion**: When saving, the application automatically calculates and adds **UTM coordinates** (Easting, Northing, Zone) to the GeoJSON properties for each feature, using `proj4`.
-   **Responsive Design**: Full-screen map interface.

## Tech Stack

-   **Framework**: React 18+
-   **Language**: TypeScript
-   **Build Tool**: Vite
-   **Map Library**: Leaflet & React-Leaflet
-   **Projections**: Proj4js (for GPS <-> UTM conversion)

## Prerequisites

-   **Node.js**: Version 20.19+ or 22.12+ (Recommended)
-   **npm**: Installed with Node.js

## Installation

1.  Navigate to the frontend directory:
    ```bash
    cd frontend
    ```

2.  Install dependencies:
    ```bash
    npm install
    ```

## Usage

### Development Server
To start the application in development mode:

```bash
npm run dev
```
Open your browser and navigate to `http://localhost:5173`.

### Production Build
To build the application for production:

```bash
npm run build
```
The build artifacts will be stored in the `dist/` directory.

### Preview Production Build
To preview the production build locally:

```bash
npm run preview
```

## Project Structure

```
frontend/
├── public/             # Static assets
├── src/
│   ├── assets/         # Images and icons
│   ├── utils/
│   │   └── utm.ts      # GPS to UTM conversion logic
│   ├── App.css         # Global styles
│   ├── App.tsx         # Main application wrapper
│   ├── MapComponent.tsx # Core map logic (Drawing, Saving, Loading)
│   ├── main.tsx        # Entry point
│   └── vite-env.d.ts   # Vite type definitions
├── index.html          # HTML template
├── package.json        # Dependencies and scripts
├── tsconfig.json       # TypeScript configuration
└── vite.config.ts      # Vite configuration
```

## How to Use

1.  **Draw**: Use the toolbar on the top-right of the map to select a drawing tool (Polygon, Rectangle, etc.) and draw on the map.
2.  **Save**: Click the **"Save Polygons"** button at the top. This will download a `.geojson` file containing your shapes. Open the file to see the added `utm_coordinates` property.
3.  **Load**: Click **"Load GeoJSON"** and select a valid `.geojson` file to display it on the map.
4.  **Clear**: Click **"Clear Map"** to remove all current shapes.
