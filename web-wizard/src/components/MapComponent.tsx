import React, { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, GeoJSON, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw/dist/leaflet.draw.css';
import 'leaflet-draw';

// Custom Icons
const createCustomIcon = (color: string, label?: string) => {
    return L.divIcon({
        className: 'custom-div-icon',
        html: `<div style="background-color: ${color}; width: 24px; height: 24px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 12px;">${label || ''}</div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12]
    });
};

const ObjectiveIcon = createCustomIcon('#ef4444', 'O'); // Red for Objective
const HomeIcon = createCustomIcon('#3b82f6', 'H'); // Blue for Home
const DefaultIcon = createCustomIcon('#64748b');

// Override default marker icon for Leaflet Draw if needed
L.Marker.prototype.options.icon = DefaultIcon;

interface MapComponentProps {
    currentStepKey: string;
    drawMode: 'marker' | 'polygon' | 'polyline' | 'any';
    existingData: Record<string, any>;
    onUpdate: (geojson: any) => void;
    centerTrigger: number;
}

interface EditControlProps {
    drawMode: 'marker' | 'polygon' | 'polyline' | 'any';
    currentStepKey: string;
    initialData: any;
    onCreated: () => void;
    onEdited: () => void;
    onDeleted: () => void;
    featureGroupRef: React.MutableRefObject<L.FeatureGroup | null>;
}

const EditControl = ({ drawMode, currentStepKey, initialData, onCreated, onEdited, onDeleted, featureGroupRef }: EditControlProps) => {
    const map = useMap();
    const drawControlRef = useRef<L.Control.Draw | null>(null);

    useEffect(() => {
        // Create FeatureGroup
        const editableLayers = new L.FeatureGroup();
        map.addLayer(editableLayers);
        featureGroupRef.current = editableLayers;

        // Load Initial Data
        const loadData = () => {
            editableLayers.clearLayers();
            if (initialData) {
                const geoJsonLayer = L.geoJSON(initialData, {
                    pointToLayer: (_feature, latlng) => {
                        let icon = DefaultIcon;
                        if (currentStepKey === 'objective') icon = ObjectiveIcon;
                        if (currentStepKey === 'home') icon = HomeIcon;
                        return L.marker(latlng, { icon: icon });
                    }
                });
                geoJsonLayer.eachLayer((layer) => {
                    editableLayers.addLayer(layer);
                });
            }
        };

        loadData();

        // Determine icon based on step
        let markerIcon = DefaultIcon;
        if (currentStepKey === 'objective') markerIcon = ObjectiveIcon;
        if (currentStepKey === 'home') markerIcon = HomeIcon;

        const options: L.Control.DrawConstructorOptions = {
            position: 'topleft',
            draw: {
                polyline: (drawMode === 'polyline' || drawMode === 'any') ? {
                    shapeOptions: { color: '#3388ff', weight: 4 }
                } : false,
                polygon: (drawMode === 'polygon' || drawMode === 'any') ? {
                    allowIntersection: true,
                    showArea: true,
                    shapeOptions: { color: '#3388ff' }
                } : false,
                rectangle: (drawMode === 'polygon' || drawMode === 'any') ? {
                    showArea: false, // Disable area to prevent cursor issues
                    shapeOptions: { color: '#3388ff' }
                } : false,
                circle: false,
                marker: (drawMode === 'marker' || drawMode === 'any') ? {
                    icon: markerIcon
                } : false,
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

        // Event handlers
        map.on(L.Draw.Event.CREATED, handleCreated);
        map.on(L.Draw.Event.EDITED, onEdited);
        map.on(L.Draw.Event.DELETED, onDeleted);

        return () => {
            map.removeControl(drawControl);
            map.removeLayer(editableLayers);
            map.off(L.Draw.Event.CREATED, handleCreated);
            map.off(L.Draw.Event.EDITED, onEdited);
            map.off(L.Draw.Event.DELETED, onDeleted);
            featureGroupRef.current = null;
        };
    }, [map, drawMode, currentStepKey, initialData]); // Re-run when these change

    return null;
};

const MapComponent: React.FC<MapComponentProps> = ({ currentStepKey, drawMode, existingData, onUpdate, centerTrigger }) => {
    const [map, setMap] = useState<L.Map | null>(null);
    const featureGroupRef = useRef<L.FeatureGroup | null>(null);

    // Force map resize on mount/update to prevent rendering issues
    useEffect(() => {
        if (map) {
            setTimeout(() => {
                map.invalidateSize();
            }, 100);
        }
    }, [map, currentStepKey]);

    // Auto-center when centerTrigger changes
    useEffect(() => {
        if (!map) return;

        const layers: L.Layer[] = [];

        // Collect all static layers
        Object.values(existingData).forEach(data => {
            if (data && data.features && data.features.length > 0) {
                const layer = L.geoJSON(data);
                layers.push(layer);
            }
        });

        // Collect current editable layer if it has data
        if (featureGroupRef.current) {
            // We can't easily get the bounds of the FeatureGroup if it's empty, 
            // but if it has layers, we can.
            // However, featureGroupRef.current might not be fully populated with the *initialData* 
            // if this runs before EditControl mounts/populates. 
            // But existingData[currentStepKey] is passed to EditControl.
            // So we can just use existingData[currentStepKey] to calculate bounds.
            const currentData = existingData[currentStepKey];
            if (currentData && currentData.features && currentData.features.length > 0) {
                const layer = L.geoJSON(currentData);
                layers.push(layer);
            }
        }

        if (layers.length > 0) {
            const group = L.featureGroup(layers);
            const bounds = group.getBounds();
            if (bounds.isValid()) {
                map.fitBounds(bounds, { padding: [50, 50], maxZoom: 22 });
            }
        }
    }, [map, existingData, currentStepKey, centerTrigger]);

    const handleChange = () => {
        if (featureGroupRef.current) {
            const geojson = featureGroupRef.current.toGeoJSON();
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
            opacity: 0.6,
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
                maxZoom={22}
            >
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                {/* Static Layers from other steps */}
                {Object.entries(existingData).map(([key, data]) => {
                    if (key === currentStepKey) return null; // Don't show current as static
                    if (!data || !data.features || data.features.length === 0) return null;

                    return (
                        <GeoJSON
                            key={key}
                            data={data}
                            style={() => getStyle(key)}
                            pointToLayer={(_feature, latlng) => {
                                let icon = DefaultIcon;
                                if (key === 'objective') icon = ObjectiveIcon;
                                if (key === 'home') icon = HomeIcon;
                                return L.marker(latlng, { icon: icon });
                            }}
                            onEachFeature={(_feature, layer) => {
                                layer.bindPopup(`<b>${key}</b><br/>Saved step`);
                            }}
                        />
                    );
                })}

                {/* Editable Layer for current step */}
                <EditControl
                    key={currentStepKey} // Force remount on step change
                    drawMode={drawMode}
                    currentStepKey={currentStepKey}
                    initialData={existingData[currentStepKey]}
                    onCreated={handleChange}
                    onEdited={handleChange}
                    onDeleted={handleChange}
                    featureGroupRef={featureGroupRef}
                />
            </MapContainer>
        </div>
    );
};

export default MapComponent;
