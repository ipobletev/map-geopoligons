import React, { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, GeoJSON, useMap, FeatureGroup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw/dist/leaflet.draw.css';
import 'leaflet-draw';

// Fix Leaflet icon issues
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

const DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

interface MapComponentProps {
    currentStepKey: string;
    drawMode: 'marker' | 'polygon' | 'polyline' | 'any';
    existingData: Record<string, any>;
    onUpdate: (geojson: any) => void;
}

const EditControl = ({ drawMode, onCreated, onEdited, onDeleted }: any) => {
    const map = useMap();
    const drawControlRef = useRef<L.Control.Draw | null>(null);

    useEffect(() => {
        // @ts-ignore
        const editableLayers = new L.FeatureGroup();
        map.addLayer(editableLayers);

        // @ts-ignore
        window.editableLayers = editableLayers; // Hack to access from outside if needed, but better to use events

        const options: L.Control.DrawConstructorOptions = {
            position: 'topleft',
            draw: {
                polyline: (drawMode === 'polyline' || drawMode === 'any') ? {} : false,
                polygon: (drawMode === 'polygon' || drawMode === 'any') ? {} : false,
                rectangle: (drawMode === 'polygon' || drawMode === 'any') ? {} : false,
                circle: false,
                marker: (drawMode === 'marker' || drawMode === 'any') ? {} : false,
                circlemarker: false,
            },
            edit: {
                featureGroup: editableLayers,
                remove: true,
            },
        };

        const drawControl = new L.Control.Draw(options);
        map.addControl(drawControl);
        drawControlRef.current = drawControl;

        const handleCreated = (e: any) => {
            const layer = e.layer;
            editableLayers.addLayer(layer);
            onCreated();
        };

        const handleEdited = () => {
            onEdited();
        };

        const handleDeleted = () => {
            onDeleted();
        };

        map.on(L.Draw.Event.CREATED, handleCreated);
        map.on(L.Draw.Event.EDITED, handleEdited);
        map.on(L.Draw.Event.DELETED, handleDeleted);

        return () => {
            map.removeControl(drawControl);
            map.removeLayer(editableLayers);
            map.off(L.Draw.Event.CREATED, handleCreated);
            map.off(L.Draw.Event.EDITED, handleEdited);
            map.off(L.Draw.Event.DELETED, handleDeleted);
        };
    }, [map, drawMode]);

    return null;
};

const MapComponent: React.FC<MapComponentProps> = ({ currentStepKey, drawMode, existingData, onUpdate }) => {
    const [map, setMap] = useState<L.Map | null>(null);

    // Clear editable layers when step changes
    useEffect(() => {
        if (map) {
            // @ts-ignore
            const layers = window.editableLayers;
            if (layers) {
                layers.clearLayers();
            }
        }
    }, [currentStepKey, map]);

    const handleChange = () => {
        if (!map) return;
        // @ts-ignore
        const layers = window.editableLayers;
        if (layers) {
            const geojson = layers.toGeoJSON();
            onUpdate(geojson);
        }
    };

    const getStyle = (key: string) => {
        // Generate a consistent color based on the key string
        let hash = 0;
        for (let i = 0; i < key.length; i++) {
            hash = key.charCodeAt(i) + ((hash << 5) - hash);
        }
        const c = (hash & 0x00FFFFFF).toString(16).toUpperCase();
        const color = '#' + '00000'.substring(0, 6 - c.length) + c;

        return {
            color: color,
            weight: 3,
            opacity: 0.8,
            fillOpacity: 0.2
        };
    };

    return (
        <div className="h-full w-full rounded-lg overflow-hidden shadow-xl border border-slate-200">
            <MapContainer
                center={[-33.4489, -70.6693]}
                zoom={15}
                style={{ height: '100%', width: '100%' }}
                ref={setMap}
            >
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                {/* Static Layers from previous steps */}
                {Object.entries(existingData).map(([key, data]) => {
                    if (key === currentStepKey) return null; // Don't show current as static
                    if (!data || !data.features || data.features.length === 0) return null;

                    return (
                        <GeoJSON
                            key={key} // Keep key stable
                            data={data}
                            style={() => getStyle(key)}
                            onEachFeature={(feature, layer) => {
                                if (feature.properties && feature.properties.utm_coordinates) {
                                    layer.bindPopup(`<b>${key}</b><br/>Saved step`);
                                }
                            }}
                        />
                    );
                })}

                {/* Remount EditControl when drawMode or step changes to update tools and clear buffer */}
                <FeatureGroup>
                    <EditControl
                        key={currentStepKey}
                        drawMode={drawMode}
                        onCreated={handleChange}
                        onEdited={handleChange}
                        onDeleted={handleChange}
                    />
                </FeatureGroup>
            </MapContainer>
        </div>
    );
};

export default MapComponent;
