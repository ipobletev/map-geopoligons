import React, { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, GeoJSON, useMap, ScaleControl, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw/dist/leaflet.draw.css';
import 'leaflet-draw';
import proj4 from 'proj4';

// Define UTM Zone 19S
proj4.defs("EPSG:32719", "+proj=utm +zone=19 +south +datum=WGS84 +units=m +no_defs");

// Custom Icons
const createCustomIcon = (color: string, label?: string) => {
    return L.divIcon({
        className: 'custom-div-icon',
        html: `<div style="background-color: ${color}; width: 24px; height: 24px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 12px;">${label || ''}</div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12]
    });
};

const DefaultIcon = L.icon({
    iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});

// Custom Icon for drawing holes (matches CircleMarker style)
const ObjectiveDrawIcon = L.divIcon({
    className: 'custom-div-icon',
    html: `<div style="background-color: #000000; width: 16px; height: 16px; border-radius: 50%; border: 2px solid #0077ffff; opacity: 0.5; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8]
});

// Custom styles for tooltips
const tooltipStyles = `
    .hole-tooltip-small, .node-tooltip {
        background: transparent !important;
        border: none !important;
        box-shadow: none !important;
        font-size: 10px !important;
        font-weight: bold;
        color: #333;
        padding: 0 !important;
    }
    .hole-tooltip-small {
        color: #b45309; /* Dark yellow/orange for holes */
    }
`;

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
        let markerIcon: L.Icon | L.DivIcon = DefaultIcon;
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
                    icon: markerIcon as L.Icon
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

const MousePosition = ({ localOrigin }: { localOrigin: { x: number, y: number } | null }) => {
    const [position, setPosition] = useState<{ lat: number; lng: number } | null>(null);
    useMapEvents({
        mousemove(e) {
            setPosition(e.latlng);
        },
    });

    if (!position) return null;

    // Calculate UTM
    const utmCoords = proj4('EPSG:4326', 'EPSG:32719', [position.lng, position.lat]);
    const utmX = utmCoords[0];
    const utmY = utmCoords[1];

    let localInfo = "";
    if (localOrigin) {
        const localX = utmX - localOrigin.x;
        const localY = utmY - localOrigin.y;
        localInfo = `, Local X: ${localX.toFixed(2)}, Y: ${localY.toFixed(2)}`;
    }

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
                <div>Lat: {position.lat.toFixed(5)}, Lng: {position.lng.toFixed(5)}</div>
                <div>UTM X: {utmX.toFixed(2)}, Y: {utmY.toFixed(2)}{localInfo}</div>
            </div>
        </div>
    );
};

const MapComponent: React.FC<MapComponentProps> = ({ currentStepKey, drawMode, existingData, onUpdate, centerTrigger }) => {
    const [map, setMap] = useState<L.Map | null>(null);
    const featureGroupRef = useRef<L.FeatureGroup | null>(null);
    const [localOrigin, setLocalOrigin] = useState<{ x: number, y: number } | null>(null);

    // Calculate local origin from loaded data if available
    useEffect(() => {
        if (existingData['global_plan_points'] && existingData['global_plan_points'].features && existingData['global_plan_points'].features.length > 0) {
            // Find a point with graph_pose and graph_pose_local to calculate offset
            // We can pick specific one or just infer from the first valid one
            // We know: graph_pose_local = graph_pose - origin
            // So: origin = graph_pose - graph_pose_local

            for (const feature of existingData['global_plan_points'].features) {
                const props = feature.properties;
                // graph_pose is usually [x, y, yaw] or string "[x, y, yaw]"
                // graph_pose_local is [x_loc, y_loc, yaw] or string

                if (props.graph_pose && props.graph_pose_local) {
                    try {
                        let gp = props.graph_pose;
                        if (typeof gp === 'string') gp = JSON.parse(gp.replace(/'/g, '"'));

                        let gpl = props.graph_pose_local;
                        if (typeof gpl === 'string') gpl = JSON.parse(gpl.replace(/'/g, '"'));

                        if (Array.isArray(gp) && gp.length >= 2 && Array.isArray(gpl) && gpl.length >= 2) {
                            const originX = gp[0] - gpl[0];
                            const originY = gp[1] - gpl[1];
                            setLocalOrigin({ x: originX, y: originY });
                            console.log("Calculated Local Origin (UTM):", originX, originY);
                            break;
                        }
                    } catch (e) {
                        console.warn("Error parsing poses for origin calc:", e);
                    }
                }
            }
        } else {
            setLocalOrigin(null);
        }
    }, [existingData]);

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
    }, [map, currentStepKey, centerTrigger]);

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
        else if (key === 'interactive_path') {
            return {
                color: '#2563eb', // Mobile-blue / Primary
                weight: 5,
                opacity: 0.8,
                dashArray: '10, 10',
                lineCap: 'round' as 'round'
            };
        }
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
        <>
            <style>{tooltipStyles}</style>
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
                    <MousePosition localOrigin={localOrigin} />

                    {/* Static Layers from other steps */}
                    {Object.entries(existingData).map(([key, layerData]) => {
                        if (key === currentStepKey) return null; // Don't show current as static
                        if (!layerData || !layerData.type || !layerData.features || layerData.features.length === 0) return null;

                        return (
                            <GeoJSON
                                key={(layerData as any)._updateId ? `${key}-${(layerData as any)._updateId}` : key}
                                data={layerData}
                                style={() => getStyle(key)}
                                pointToLayer={(_feature, latlng) => {
                                    let icon = DefaultIcon;
                                    if (key === 'objective') {
                                        // Get drillhole_id from feature properties
                                        const drillholeId = _feature.properties?.drillhole_id;
                                        const marker = L.circleMarker(latlng, {
                                            radius: 3,
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
                                                className: 'hole-tooltip-small',
                                                offset: [0, -5],
                                            });
                                        }

                                        return marker;
                                    }
                                    if (key === 'global_plan_points') {
                                        const poseType = _feature.properties?.pose_type;
                                        const graphPose = _feature.properties?.graph_pose;
                                        let rotation = 0;

                                        // Parse rotation
                                        if (graphPose) {
                                            try {
                                                let pose = graphPose;
                                                if (typeof pose === 'string') pose = JSON.parse(pose.replace(/'/g, '"'));
                                                if (Array.isArray(pose) && pose.length > 2) rotation = pose[2];
                                            } catch (e) { /* ignore */ }
                                        }

                                        let marker;
                                        const degrees = (rotation * 180) / Math.PI;

                                        if (poseType === 'hole') {
                                            marker = L.marker(latlng, {
                                                icon: L.divIcon({
                                                    className: 'custom-icon-arrow',
                                                    html: `<div style="transform: rotate(${-degrees}deg); font-weight: bold; font-size: 16px; color: yellow; text-align: center; line-height: 1;">&gt;</div>`,
                                                    iconSize: [20, 20],
                                                    iconAnchor: [10, 10]
                                                })
                                            });
                                        } else if (_feature.properties?.type === 'hole') {
                                            const drillholeId = _feature.properties?.drillhole_id;
                                            marker = L.circleMarker(latlng, {
                                                radius: 3,
                                                fillColor: '#000000',
                                                color: '#0077ffff',
                                                weight: 2,
                                                opacity: 0.5,
                                                fillOpacity: 0.3
                                            });
                                            if (drillholeId) {
                                                marker.bindTooltip(String(drillholeId), {
                                                    permanent: true, direction: 'top', className: 'hole-tooltip-small', offset: [0, -5]
                                                });
                                            }
                                        } else if (poseType === 'transit_street') {
                                            marker = L.marker(latlng, {
                                                icon: L.divIcon({
                                                    className: 'custom-icon-transit',
                                                    html: `<div style="font-weight: bold; font-size: 16px; color: yellow; text-align: center; line-height: 1;">z</div>`,
                                                    iconSize: [20, 20],
                                                    iconAnchor: [10, 10]
                                                })
                                            });
                                        } else if (poseType === 'street') {
                                            marker = L.marker(latlng, {
                                                icon: L.divIcon({
                                                    className: 'custom-icon-arrow',
                                                    html: `<div style="transform: rotate(${-degrees}deg); font-weight: bold; font-size: 16px; color: yellow; text-align: center; line-height: 1;">&gt;</div>`,
                                                    iconSize: [20, 20],
                                                    iconAnchor: [10, 10]
                                                })
                                            });
                                        } else if (poseType === 'home_pose') {
                                            marker = L.marker(latlng, {
                                                icon: L.divIcon({
                                                    className: 'custom-icon-arrow',
                                                    html: `<div style="transform: rotate(${-degrees}deg); font-weight: bold; font-size: 16px; color: blue; text-align: center; line-height: 1;">&gt;</div>`,
                                                    iconSize: [20, 20],
                                                    iconAnchor: [10, 10]
                                                })
                                            });
                                        } else if (poseType === 'nearest_pose' || poseType === 'nearest-pose') {
                                            marker = L.marker(latlng, {
                                                icon: L.divIcon({
                                                    className: 'custom-icon-nearest',
                                                    html: `<div style="background-color: #06b6d4; width: 14px; height: 14px; border-radius: 2px; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>`,
                                                    iconSize: [18, 18],
                                                    iconAnchor: [9, 9]
                                                })
                                            });
                                        } else if (poseType === 'recovery_pose' || poseType === 'street_recovery_pose' || poseType === 'recovery-pose') {
                                            marker = L.marker(latlng, {
                                                icon: L.divIcon({
                                                    className: 'custom-icon-recovery',
                                                    html: `<div style="background-color: #f97316; width: 14px; height: 14px; border-radius: 2px; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>`,
                                                    iconSize: [18, 18],
                                                    iconAnchor: [9, 9]
                                                })
                                            });
                                        } else {
                                            // Fallback
                                            marker = L.circleMarker(latlng, {
                                                radius: 4,
                                                fillColor: '#ea0808ff',
                                                color: '#fff',
                                                weight: 1,
                                                opacity: 1,
                                                fillOpacity: 0.8
                                            });
                                        }

                                        // Add local coords tooltip
                                        if (_feature.properties?.graph_pose_local) {
                                            try {
                                                let gpl = _feature.properties.graph_pose_local;
                                                if (typeof gpl === 'string') gpl = JSON.parse(gpl.replace(/'/g, '"'));
                                                if (Array.isArray(gpl) && gpl.length >= 2) {
                                                    marker.bindTooltip(`Local: ${gpl[0].toFixed(2)}, ${gpl[1].toFixed(2)}`, {
                                                        direction: 'top', className: 'node-tooltip'
                                                    });
                                                }
                                            } catch (e) { /* ignore */ }
                                        }
                                        return marker;
                                    }

                                    // Interactive Path Markers (Start, End, Robot)
                                    if (key === 'interactive_path') {
                                        if (_feature.properties?.style === 'path-start') {
                                            return L.marker(latlng, {
                                                icon: L.divIcon({
                                                    className: 'custom-icon-start',
                                                    html: `<div style="background-color: #22c55e; width: 10px; height: 10px; border-radius: 50%; border: 2px solid white; box-shadow: 0 1px 2px rgba(0,0,0,0.3);"></div>`,
                                                    iconSize: [14, 14],
                                                    iconAnchor: [7, 7]
                                                })
                                            });
                                        } else if (_feature.properties?.style === 'path-end') {
                                            return L.marker(latlng, {
                                                icon: L.divIcon({
                                                    className: 'custom-icon-end',
                                                    html: `<div style="background-color: #9333ea; width: 10px; height: 10px; border-radius: 50%; border: 2px solid white; box-shadow: 0 1px 2px rgba(0,0,0,0.3);"></div>`,
                                                    iconSize: [14, 14],
                                                    iconAnchor: [7, 7]
                                                })
                                            });
                                        } else if (_feature.properties?.style === 'robot-pose') {
                                            return L.marker(latlng, {
                                                icon: L.divIcon({
                                                    className: 'custom-icon-robot',
                                                    html: `<div style="background-color: #3b82f6; width: 20px; height: 20px; border-radius: 2px; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3); transform: rotate(45deg);"></div>`,
                                                    iconSize: [24, 24],
                                                    iconAnchor: [12, 12]
                                                }),
                                                zIndexOffset: 1000 // Ensure robot is on top
                                            });
                                        } else if (_feature.properties?.style === 'nearest-pose' || _feature.properties?.style === 'nearest_pose') {
                                            const marker = L.marker(latlng, {
                                                icon: L.divIcon({
                                                    className: 'custom-icon-nearest',
                                                    html: `<div style="background-color: #06b6d4; width: 14px; height: 14px; border-radius: 2px; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>`,
                                                    iconSize: [18, 18],
                                                    iconAnchor: [9, 9]
                                                })
                                            });
                                            // Add local coords if available
                                            return marker;
                                        } else if (_feature.properties?.style === 'recovery-pose' || _feature.properties?.style === 'recovery_pose' || _feature.properties?.style === 'street_recovery_pose') {
                                            const marker = L.marker(latlng, {
                                                icon: L.divIcon({
                                                    className: 'custom-icon-recovery',
                                                    html: `<div style="background-color: #f97316; width: 14px; height: 14px; border-radius: 2px; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>`,
                                                    iconSize: [18, 18],
                                                    iconAnchor: [9, 9]
                                                })
                                            });
                                            return marker;
                                        } else if (_feature.properties?.style === 'path-node') {
                                            const marker = L.circleMarker(latlng, {
                                                radius: 2,
                                                fillColor: '#334155',
                                                color: '#ffffff',
                                                weight: 1,
                                                opacity: 0.8,
                                                fillOpacity: 0.8
                                            });
                                            if (_feature.properties?.id) {
                                                marker.bindTooltip(String(_feature.properties.id), {
                                                    permanent: true,
                                                    direction: 'top',
                                                    className: 'node-tooltip',
                                                    offset: [0, -5]
                                                });
                                            }
                                            return marker;
                                        }
                                    }

                                    return L.marker(latlng, { icon: icon });
                                }
                                }
                                onEachFeature={(_feature, layer) => {
                                    layer.bindPopup(`<b>${key}</b><br/>Saved step`);
                                }}
                            />
                        );
                    })}

                    {/* Editable Layer for current step */}
                    <EditControl
                        key={`${currentStepKey}-${centerTrigger}`} // Force remount on step change or data load
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
        </>
    );
};

export default MapComponent;
