import React, { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, GeoJSON, useMap, ScaleControl, useMapEvents } from 'react-leaflet';
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

const DefaultIcon = createCustomIcon('#64748b');

// Custom Icon for drawing holes (matches CircleMarker style)
const ObjectiveDrawIcon = L.divIcon({
    className: 'custom-div-icon',
    html: `<div style="background-color: #000000; width: 16px; height: 16px; border-radius: 50%; border: 2px solid #0077ffff; opacity: 0.5; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8]
});

// Override default marker icon for Leaflet Draw if needed
L.Marker.prototype.options.icon = DefaultIcon;

interface MapComponentProps {
    currentStepKey: string;
    drawMode: 'marker' | 'polygon' | 'polyline' | 'any' | 'none';
    existingData: Record<string, any>;
    onUpdate: (geojson: any) => void;
    centerTrigger: number;
}

interface EditControlProps {
    drawMode: 'marker' | 'polygon' | 'polyline' | 'any' | 'none';
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
            if (initialData && initialData.type) {
                let holeIndex = 0;
                const geoJsonLayer = L.geoJSON(initialData, {
                    pointToLayer: (_feature, latlng) => {
                        // Use transparent black circles for objective (holes)
                        if (currentStepKey === 'objective') {
                            holeIndex++;
                            const marker = L.circleMarker(latlng, {
                                radius: 8,
                                fillColor: '#000000',
                                color: '#0077ffff',
                                weight: 2,
                                opacity: 0.5,
                                fillOpacity: 0.3
                            });

                            const drillholeId = _feature.properties?.drillhole_id !== undefined ? _feature.properties.drillhole_id : holeIndex;

                            marker.bindTooltip(String(drillholeId), {
                                permanent: true,
                                direction: 'top',
                                className: 'drillhole-tooltip-square',
                                offset: [0, -10]
                            });

                            return marker;
                        }
                        // Use icons for other types
                        let icon = DefaultIcon;
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
        if (currentStepKey === 'objective') markerIcon = ObjectiveDrawIcon;

        const options: L.Control.DrawConstructorOptions = {
            position: 'topleft',
            draw: {
                polyline: (drawMode === 'polyline' || drawMode === 'any') ? {
                    shapeOptions: {
                        color: currentStepKey === 'home' ? '#9333ea' : '#3388ff',
                        weight: 4
                    }
                } : false,
                polygon: (drawMode === 'polygon' || drawMode === 'any') ? {
                    allowIntersection: true,
                    showArea: true,
                    shapeOptions: {
                        color: currentStepKey === 'tall_obstacle' ? '#ef4444' : '#3388ff'
                    }
                } : false,
                rectangle: (drawMode === 'polygon' || drawMode === 'any') ? {
                    showArea: false, // Disable area to prevent cursor issues
                    shapeOptions: {
                        color: currentStepKey === 'tall_obstacle' ? '#ef4444' : '#3388ff'
                    }
                } : false,
                circle: false,
                marker: (drawMode === 'marker' || drawMode === 'any') ? {
                    icon: markerIcon
                } : false,
                circlemarker: false,
            },
            edit: (drawMode === 'none') ? undefined : {
                featureGroup: editableLayers,
                remove: true,
            },
        };

        const drawControl = new L.Control.Draw(options);
        map.addControl(drawControl);
        drawControlRef.current = drawControl;

        const handleCreated = (e: any) => {
            let layer = e.layer;

            // If we are drawing holes (objective), replace the marker with a circle marker
            if (currentStepKey === 'objective' && layer instanceof L.Marker) {
                const latlng = layer.getLatLng();
                const nextId = editableLayers.getLayers().length + 1;

                layer = L.circleMarker(latlng, {
                    radius: 8,
                    fillColor: '#000000',
                    color: '#0077ffff',
                    weight: 2,
                    opacity: 0.5,
                    fillOpacity: 0.3
                });

                layer.bindTooltip(String(nextId), {
                    permanent: true,
                    direction: 'top',
                    className: 'drillhole-tooltip-square',
                    offset: [0, -10]
                });

                // Attach properties so they persist
                // @ts-ignore
                layer.feature = {
                    type: 'Feature',
                    properties: {
                        drillhole_id: nextId
                    },
                    geometry: {
                        type: 'Point',
                        coordinates: [latlng.lng, latlng.lat]
                    }
                };
            }

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

const MousePosition = () => {
    const [position, setPosition] = useState<{ lat: number; lng: number } | null>(null);
    useMapEvents({
        mousemove(e) {
            setPosition(e.latlng);
        },
    });

    if (!position) return null;

    return (
        <div className="leaflet-bottom leaflet-right">
            <div className="leaflet-control leaflet-bar" style={{
                backgroundColor: 'rgba(255, 255, 255, 0.8)',
                padding: '4px 8px',
                margin: '0 10px 10px 0',
                fontSize: '12px',
                fontWeight: 'bold',
                color: '#333',
                border: '2px solid rgba(0,0,0,0.2)',
                borderRadius: '4px'
            }}>
                Lat: {position.lat.toFixed(5)}, Lng: {position.lng.toFixed(5)}
            </div>
        </div>
    );
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
        let color = '#3388ff';
        if (key === 'holes') color = '#000000';
        else if (key === 'geofence') color = '#22c55e';
        else if (key === 'home') color = '#9333ea';
        else if (key === 'streets') color = '#3b82f6';
        else if (key === 'fitted_streets') color = '#2563eb'; // Darker blue for fitted
        else if (key === 'transit_streets') color = '#22c55e'; // Green for transit (matching notebook)
        else if (key === 'fitted_transit_streets') color = '#16a34a'; // Darker green for fitted transit
        else if (key === 'obstacles') color = '#9333ea'; // Purple for normal obstacles
        else if (key === 'high_obstacles' || key === 'tall_obstacle') color = '#ef4444'; // Red for high obstacles
        else if (key === 'routes') color = '#eab308';
        else if (key === 'global_plan_points') color = '#eab308';
        else {
            // Generate a consistent color based on the key string
            let hash = 0;
            for (let i = 0; i < key.length; i++) {
                hash = key.charCodeAt(i) + ((hash << 5) - hash);
            }
            const c = (hash & 0x00FFFFFF).toString(16).toUpperCase();
            color = '#' + '00000'.substring(0, 6 - c.length) + c;
        }

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
                <ScaleControl position="bottomleft" />
                <MousePosition />

                {/* Static Layers from other steps */}
                {Object.entries(existingData).map(([key, data]) => {
                    if (key === currentStepKey) return null; // Don't show current as static
                    if (!data || !data.type || !data.features || data.features.length === 0) return null;

                    return (
                        <GeoJSON
                            key={key}
                            data={data}
                            style={() => getStyle(key)}
                            pointToLayer={(_feature, latlng) => {
                                let icon = DefaultIcon;
                                if (key === 'objective') {
                                    // Get drillhole_id from feature properties
                                    const drillholeId = _feature.properties?.drillhole_id;
                                    const marker = L.circleMarker(latlng, {
                                        radius: 8,
                                        fillColor: '#000000',
                                        color: '#0077ffff',
                                        weight: 2,
                                        opacity: 0.5,
                                        fillOpacity: 0.3
                                    });

                                    // Add label if drillhole_id exists
                                    if (drillholeId !== undefined && drillholeId !== null) {
                                        marker.bindTooltip(String(drillholeId), {
                                            permanent: true,
                                            direction: 'top',
                                            className: 'drillhole-tooltip-square',
                                            offset: [0, -10],
                                        });
                                    }

                                    return marker;
                                }
                                if (key === 'home') icon = HomeIcon;
                                if (key === 'global_plan_points') {
                                    const poseType = _feature.properties?.pose_type; // Use pose_type instead of type
                                    const graphPose = _feature.properties?.graph_pose;
                                    let rotation = 0;

                                    // Parse rotation from graph_pose if available
                                    if (graphPose) {
                                        try {
                                            let pose = graphPose;
                                            if (typeof pose === 'string') {
                                                pose = JSON.parse(pose.replace(/'/g, '"'));
                                            }
                                            if (Array.isArray(pose) && pose.length > 2) {
                                                rotation = pose[2]; // Assuming theta is at index 2
                                            }
                                        } catch (e) {
                                            console.warn('Error parsing graph_pose for rotation', e);
                                        }
                                    }

                                    // Custom Icons based on pose_type from global_plan.csv
                                    if (poseType === 'hole') {
                                        // Use yellow arrow for holes
                                        const degrees = (rotation * 180) / Math.PI;
                                        const marker = L.marker(latlng, {
                                            icon: L.divIcon({
                                                className: 'custom-icon-arrow',
                                                html: `<div style="transform: rotate(${-degrees}deg); font-weight: bold; font-size: 16px; color: yellow; text-align: center; line-height: 1;">&gt;</div>`,
                                                iconSize: [20, 20],
                                                iconAnchor: [10, 10]
                                            })
                                        });

                                        return marker;
                                    } else if (poseType === 'transit_street') {
                                        return L.marker(latlng, {
                                            icon: L.divIcon({
                                                className: 'custom-icon-transit',
                                                html: `<div style="font-weight: bold; font-size: 16px; color: yellow; text-align: center; line-height: 1;">z</div>`,
                                                iconSize: [20, 20],
                                                iconAnchor: [10, 10]
                                            })
                                        });
                                    } else if (poseType === 'street') {
                                        // Convert rotation to degrees for CSS
                                        const degrees = (rotation * 180) / Math.PI;
                                        return L.marker(latlng, {
                                            icon: L.divIcon({
                                                className: 'custom-icon-arrow',
                                                html: `<div style="transform: rotate(${-degrees}deg); font-weight: bold; font-size: 16px; color: yellow; text-align: center; line-height: 1;">&gt;</div>`,
                                                iconSize: [20, 20],
                                                iconAnchor: [10, 10]
                                            })
                                        });
                                    } else if (poseType === 'home_pose') {
                                        // Convert rotation to degrees for CSS
                                        const degrees = (rotation * 180) / Math.PI;
                                        return L.marker(latlng, {
                                            icon: L.divIcon({
                                                className: 'custom-icon-arrow',
                                                html: `<div style="transform: rotate(${-degrees}deg); font-weight: bold; font-size: 16px; color: blue; text-align: center; line-height: 1;">&gt;</div>`,
                                                iconSize: [20, 20],
                                                iconAnchor: [10, 10]
                                            })
                                        });
                                    }

                                    // Fallback for unknown types
                                    return L.circleMarker(latlng, {
                                        radius: 4,
                                        fillColor: '#ea0808ff',
                                        color: '#fff',
                                        weight: 1,
                                        opacity: 1,
                                        fillOpacity: 0.8
                                    });
                                }
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
