# Map Wizard Generator

This project is a Qt and Python-based tool for step-by-step generation of GeoJSON files to configure robot navigation.

## Steps
The tool guides the user through the following steps:
1. **Objective**: Locations the robot must reach.
2. **Geofence**: The robot's operating area.
3. **Home**: Initial position of the robot.
4. **Road**: Main routes.
5. **Transit Road**: Routes for transit only.
6. **Obstacles**: Forbidden/prohibited zones.
7. **Tall Obstacles**: Tall, forbidden zones.

## Usage
Run `run_wizard.bat` to start the application.
Choose a folder where the generated GeoJSON files will be saved.
Follow the on-screen instructions to draw each element on the map and save it.
