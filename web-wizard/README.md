# Web Map Wizard

A modern, interactive web application for generating and managing map geopolygons. This tool guides users through a structured workflow to define various map elements required for robot navigation, such as objectives, geofences, and obstacles.

## 🚀 Features

- **Step-by-Step Workflow**: Structured wizard interface for creating:
  - **Objetivo**: Target locations (Points).
  - **Geofence**: Operational boundaries (Polygons).
  - **Home**: Robot starting position (Points/Markers).
  - **Calle**: Navigation paths (Polylines).
  - **Calle de Tránsito**: Transit-only paths (Polylines).
  - **Obstáculos**: Restricted areas (Polygons/Rectangles).
  - **Obstáculos Altos**: High vertical obstacles (Polygons/Rectangles).

- **Advanced Map Interface**:
  - Built with **Leaflet** and **React-Leaflet**.
  - **Drawing Tools**: Intuitive tools for placing markers, drawing lines, polygons, and rectangles.
  - **Editable Layers**: Modify existing geometries (edit/delete) before saving.

- **Data Management**:
  - **GeoJSON Support**: Native import and export of GeoJSON data.
  - **UTM Conversion**: Automatic enrichment of geographical coordinates (Lat/Lon) with UTM (Universal Transverse Mercator) data for robotic precision.
  - **Bulk Export**: Download all generated steps as a single ZIP archive.
  - **Load Existing Data**: Import previously saved GeoJSON files to view or edit.

- **Modern UI/UX**:
  - Responsive design using **Tailwind CSS**.
  - Clear visual feedback and progress tracking.

## 🛠️ Tech Stack

- **Framework**: React 18 + TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **Maps**: Leaflet, React-Leaflet, Leaflet-Draw
- **Utilities**: Proj4 (Coordinate conversion), JSZip (Archiving), File-Saver

## 📦 Installation

1. **Prerequisites**: Ensure you have Node.js (v18 or higher) installed.

2. **Navigate to the project**:
   ```bash
   cd web-wizard
   ```

3. **Install dependencies**:
   ```bash
   npm install
   ```

## 🏃‍♂️ Usage

1. **Start the development server**:
   ```bash
   npm run dev
   ```

2. **Open the application**:
   Navigate to `http://localhost:5173` (or the port shown in your terminal).

3. **Using the Wizard**:
   - Select a step from the sidebar or use the **Next/Back** buttons.
   - Use the toolbar on the map to draw the required element for that step.
   - **Markers**: Click to place.
   - **Polygons**: Click to place points, click the first point to close.
   - **Rectangles**: Click and drag to create.
   - **Polylines**: Click to place points, click the last point again to finish.
   - Click **Next** to save the current step's data locally in the session.

4. **Exporting Data**:
   - Click **Download All (ZIP)** at any time to download the complete set of generated GeoJSON files.

5. **Importing Data**:
   - Use the **Load JSON** button to import an existing GeoJSON file into the current view.

## 📁 Project Structure

```
web-wizard/
├── src/
│   ├── components/
│   │   ├── MapComponent.tsx  # Map logic and drawing handlers
│   │   └── Wizard.tsx        # Main application layout and state management
│   ├── utils/
│   │   └── utm.ts            # GPS to UTM coordinate conversion
│   ├── types.ts              # TypeScript definitions
│   ├── App.tsx               # Root component
│   └── main.tsx              # Entry point
├── public/
└── package.json
```

## 🤝 Contributing

1. Fork the repository.
2. Create a feature branch.
3. Commit your changes.
4. Push to the branch.
5. Open a Pull Request.
