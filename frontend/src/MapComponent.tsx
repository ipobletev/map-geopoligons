import React, { useRef, useState } from 'react';
import { MapContainer, TileLayer, FeatureGroup } from 'react-leaflet';
import { EditControl } from 'react-leaflet-draw';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw/dist/leaflet.draw.css';
import { toUtm } from './utils/utm';

// Fix Leaflet icon issues
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

const MapComponent = () => {
    const [map, setMap] = useState<L.Map | null>(null);
    const featureGroupRef = useRef<L.FeatureGroup>(null);

    const handleCreated = (e: any) => {
        console.log("Created", e);
    };

    const savePolygons = () => {
        if (!featureGroupRef.current) return;

        const layers = featureGroupRef.current.getLayers();
        if (layers.length === 0) {
            alert("No shapes to save.");
            return;
        }

        const geoJson = featureGroupRef.current.toGeoJSON();

        // Enrich with UTM
        // @ts-ignore
        geoJson.features.forEach((feature: any) => {
            const geometry = feature.geometry;
            let utmCoords = null;

            if (geometry.type === 'Point') {
                const [lon, lat] = geometry.coordinates;
                utmCoords = toUtm(lat, lon);
            } else if (geometry.type === 'LineString') {
                utmCoords = geometry.coordinates.map((p: number[]) => toUtm(p[1], p[0])).filter(Boolean);
            } else if (geometry.type === 'Polygon') {
                utmCoords = geometry.coordinates.map((ring: number[][]) =>
                    ring.map(p => toUtm(p[1], p[0])).filter(Boolean)
                );
            }

            if (utmCoords) {
                feature.properties = feature.properties || {};
                feature.properties.utm_coordinates = utmCoords;
            }
        });

        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(geoJson, null, 2));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        downloadAnchorNode.setAttribute("download", `drawing_${timestamp}.geojson`);
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
    };

    const loadGeoJSON = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const content = e.target?.result as string;
                const geoJson = JSON.parse(content);

                if (featureGroupRef.current) {
                    const layer = L.geoJSON(geoJson);
                    layer.eachLayer((l) => {
                        // @ts-ignore
                        featureGroupRef.current?.addLayer(l);
                    });

                    // Zoom to bounds
                    if (map && layer.getLayers().length > 0) {
                        map.fitBounds(layer.getBounds());
                    }
                }
            } catch (err) {
                console.error("Error parsing GeoJSON", err);
                alert("Invalid GeoJSON file");
            }
        };
        reader.readAsText(file);
        // Reset input
        event.target.value = '';
    };

    const clearMap = () => {
        featureGroupRef.current?.clearLayers();
    };

    return (
        <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '10px', background: '#f0f0f0', display: 'flex', gap: '10px', alignItems: 'center' }}>
                <h3 style={{ margin: '0 10px 0 0' }}>Map Geopoligons</h3>
                <button onClick={savePolygons} className="btn">Save Polygons</button>
                <button onClick={clearMap} className="btn">Clear Map</button>
                <label className="btn" style={{ cursor: 'pointer', display: 'inline-block' }}>
                    Load GeoJSON
                    <input type="file" accept=".geojson,.json" onChange={loadGeoJSON} style={{ display: 'none' }} />
                </label>
            </div>
            <div style={{ flex: 1 }}>
                <MapContainer
                    center={[-33.4489, -70.6693]}
                    zoom={13}
                    style={{ height: '100%', width: '100%' }}
                    ref={setMap}
                >
                    <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    <FeatureGroup ref={featureGroupRef}>
                        <EditControl
                            position="topright"
                            onCreated={handleCreated}
                            draw={{
                                rectangle: true,
                                polyline: true,
                                polygon: true,
                                circle: true,
                                marker: true,
                                circlemarker: false
                            }}
                        />
                    </FeatureGroup>
                </MapContainer>
            </div>
        </div>
    );
};

export default MapComponent;
