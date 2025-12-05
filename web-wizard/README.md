# Web Map Wizard

A modern web-based wizard for generating map geopolygons, based on the `qt-python-wizard` concept.

## Features

- **Step-by-Step Wizard**: Guide through creating Objectives, Geofences, Home, Roads, Transit Roads, and Obstacles.
- **Map Interface**: Interactive map using Leaflet and OpenStreetMap.
- **Drawing Tools**: Draw Points, Lines, and Polygons.
- **UTM Conversion**: Automatically converts drawn geometries to UTM coordinates.
- **GeoJSON Export**: Save each step as a GeoJSON file.
- **Rich UI**: Modern, responsive interface built with React and Tailwind CSS.

## Prerequisites

- Node.js (v18+)
- npm

## Installation

1. Navigate to the project directory:
   ```bash
   cd web-wizard
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

## Usage

1. Start the development server:
   ```bash
   npm run dev
   ```

2. Open your browser at `http://localhost:5173`.

3. Follow the wizard steps:
   - Draw the required elements on the map.
   - Click "Next" to save the current step (downloads a .geojson file) and proceed.
   - Use "Back" to review previous steps.

## Project Structure

- `src/components`: React components (Wizard, MapComponent).
- `src/utils`: Utility functions (UTM conversion).
- `src/types.ts`: Type definitions.

## Technologies

- React
- TypeScript
- Vite
- Tailwind CSS
- Leaflet / React-Leaflet
- Leaflet Draw
- Proj4 (for UTM conversion)
