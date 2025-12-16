import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { WIZARD_STEPS } from '../types';
import MapComponent from '../components/MapComponent';
import { enrichGeoJSONWithUTM } from '../utils/utm';
import { saveAs } from 'file-saver';
import JSZip from 'jszip';
import { ArrowRight, ArrowLeft, CheckCircle, Trash2, Upload, Download, Folder, Play, X, Settings, Send } from 'lucide-react';
import TransferModal from '../components/TransferModal';
import { parseHolFile, generateHolString, UTM_ZONE_19S, WGS84 } from '../utils/holParser';
import proj4 from 'proj4';
import { generateRoutes } from '../routes/generateRoutes';
import { fetchGraphNodes } from '../routes/graphNodes';
import { calculatePath } from '../routes/calculatePath';
import { transferFiles } from '../routes/transferFiles';
import '../styles/components/Wizard.css';

// Helper to parse Global Plan CSV
const parseGlobalPlanCsv = (content: string) => {
    const lines = content.split('\n');
    const headers = lines[0].split(',');
    const data: any[] = [];

    // Helper to safely parse CSV line respecting quotes
    const parseLine = (line: string) => {
        const result = [];
        let current = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                result.push(current);
                current = '';
            } else {
                current += char;
            }
        }
        result.push(current);
        return result;
    };

    for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;
        const values = parseLine(lines[i]);
        const row: any = {};
        headers.forEach((header, index) => {
            row[header.trim()] = values[index]?.trim();
        });
        data.push(row);
    }

    // Extract Points (Graph Nodes)
    const nodes: Record<string, [number, number]> = {};
    const pointsFeatures = data
        .filter((row: any) => row.type === 'graph_pose' || row.type === 'hole')
        .map((row: any) => {
            try {
                // Try to use global coordinates first (UTM)
                let coordsStr = row.graph_pose;
                let isGlobal = true;

                if (!coordsStr || coordsStr === 'nan') {
                    // Fallback to local
                    coordsStr = row.graph_pose_local;
                    isGlobal = false;
                }

                // Fallback for holes: use 'geometry' column (WKT)
                let wktCoords: [number, number] | null = null;
                if ((!coordsStr || coordsStr === 'nan' || coordsStr === '""') && row.geometry && row.geometry.startsWith('POINT')) {
                    try {
                        const parts = row.geometry.replace('POINT (', '').replace(')', '').trim().split(' ');
                        if (parts.length >= 2) {
                            const x = parseFloat(parts[0]);
                            const y = parseFloat(parts[1]);
                            if (!isNaN(x) && !isNaN(y)) {
                                wktCoords = [x, y];
                                isGlobal = true;
                            }
                        }
                    } catch (e) { }
                }

                if (coordsStr || wktCoords) {
                    let lon = 0;
                    let lat = 0;

                    if (wktCoords) {
                        lon = wktCoords[0];
                        lat = wktCoords[1];
                    } else if (coordsStr) {
                        coordsStr = coordsStr.replace(/^"|"$/g, '').replace(/'/g, '"');
                        try {
                            const coords = JSON.parse(coordsStr);
                            if (Array.isArray(coords) && coords.length >= 2) {
                                lon = coords[0];
                                lat = coords[1];
                            } else {
                                return null;
                            }
                        } catch (e) {
                            return null;
                        }
                    }

                    // Convert UTM to WGS84 if using global coordinates
                    if (isGlobal) {
                        [lon, lat] = proj4(UTM_ZONE_19S, WGS84, [lon, lat]);
                    }

                    nodes[row.graph_id] = [lon, lat];
                    return {
                        type: 'Feature',
                        geometry: {
                            type: 'Point',
                            coordinates: [lon, lat]
                        },
                        properties: row
                    };
                }
            } catch (e) { }
            return null;
        })
        .filter(Boolean);

    // Identify Home Poses to exclude from lines
    const homeNodeIds = new Set<string>();
    pointsFeatures.forEach((f: any) => {
        if (f.properties.pose_type === 'home_pose') {
            homeNodeIds.add(f.properties.graph_id);
        }
    });

    // Extract Lines (Routes)
    const lineFeatures: any[] = [];
    for (const row of data) {
        if (row.type === 'graph_pose' && row.connections && nodes[row.graph_id]) {
            if (homeNodeIds.has(row.graph_id)) continue;

            try {
                let connsStr = row.connections.replace(/^"|"$/g, '').replace(/'/g, '"');
                if (connsStr && connsStr !== 'nan' && connsStr !== '[]') {
                    const conns = JSON.parse(connsStr);
                    if (Array.isArray(conns)) {
                        conns.forEach((targetId: any) => {
                            if (homeNodeIds.has(targetId)) return;

                            if (nodes[targetId]) {
                                lineFeatures.push({
                                    type: 'Feature',
                                    geometry: {
                                        type: 'LineString',
                                        coordinates: [nodes[row.graph_id], nodes[targetId]]
                                    },
                                    properties: { source: row.graph_id, target: targetId }
                                });
                            }
                        });
                    }
                }
            } catch (e) { }
        }
    }

    // Extract Obstacles (Polygons)
    const obstacleFeatures: any[] = [];
    const highObstacleFeatures: any[] = [];

    for (const row of data) {
        try {
            const type = row.type ? row.type.trim() : '';
            const isObstacle = type.includes('obstacle');

            if (isObstacle && row.geometry && row.geometry.includes('POLYGON')) {
                let wkt = row.geometry;
                wkt = wkt.replace(/POLYGON\s*\(\(/i, '').replace(/\)\)\s*$/, '').trim();

                const coordPairs = wkt.split(',');
                const coordinates = coordPairs.map((pair: string) => {
                    const parts = pair.trim().split(/\s+/);
                    let x = parseFloat(parts[0]);
                    let y = parseFloat(parts[1]);
                    if (isNaN(x) || isNaN(y)) return null;
                    const [lon, lat] = proj4(UTM_ZONE_19S, WGS84, [x, y]);
                    return [lon, lat];
                }).filter((c: any) => c !== null);

                if (coordinates.length > 0) {
                    const feature = {
                        type: 'Feature',
                        geometry: {
                            type: 'Polygon',
                            coordinates: [coordinates]
                        },
                        properties: row
                    };

                    if (type.includes('tall') || type.includes('high')) {
                        highObstacleFeatures.push(feature);
                    } else {
                        obstacleFeatures.push(feature);
                    }
                }
            }
        } catch (e) { }
    }

    return { pointsFeatures, lineFeatures, obstacleFeatures, highObstacleFeatures };
};

const Wizard = () => {
    const { t } = useTranslation();
    const [currentStepIndex, setCurrentStepIndex] = useState(0);
    const [data, setData] = useState<Record<string, any>>({});
    const [currentStepData, setCurrentStepData] = useState<any>(null);
    const [centerTrigger, setCenterTrigger] = useState(0);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const folderInputRef = useRef<HTMLInputElement>(null);
    const resultInputRef = useRef<HTMLInputElement>(null);
    const sidebarRef = useRef<HTMLDivElement>(null);
    const stepRefs = useRef<(HTMLDivElement | null)[]>([]);

    useEffect(() => {
        if (stepRefs.current[currentStepIndex]) {
            stepRefs.current[currentStepIndex]?.scrollIntoView({
                behavior: 'smooth',
                block: 'center'
            });
        }
    }, [currentStepIndex]);

    const [generating, setGenerating] = useState(false);
    const [genProgress, setGenProgress] = useState(0);
    const [genResult, setGenResult] = useState<any>(null);
    const [showGenModal, setShowGenModal] = useState(false);
    const [showTransferModal, setShowTransferModal] = useState(false);
    const [isTransferring, setIsTransferring] = useState(false);

    // View mode state
    const [viewMode, setViewMode] = useState<'raw' | 'generated'>('raw');

    // Options State
    const [options, setOptions] = useState({
        fit_streets: true,
        fit_twice: true,
        wgs84: true,
        use_obstacles: true,
        use_high_obstacles: true,
        use_transit_streets: true
    });

    // Path Finding State
    const [pathNodes, setPathNodes] = useState<any[]>([]);
    const [pathStart, setPathStart] = useState<string>('');
    const [pathEnd, setPathEnd] = useState<string>('');
    const [calculatedPath, setCalculatedPath] = useState<any[] | null>(null);
    const [pathLoading, setPathLoading] = useState(false);
    const [pathProgress, setPathProgress] = useState(0);
    const [pathRevision, setPathRevision] = useState(0);
    const [activeTab, setActiveTab] = useState<'load' | 'details'>('load');

    // Translate steps dynamically
    const steps = WIZARD_STEPS.map(step => ({
        ...step,
        label: t(`wizard.steps.${step.key === 'transit_road' ? 'transitStreets' : step.key === 'tall_obstacle' ? 'highObstacles' : step.key === 'objective' ? 'holes' : step.key === 'road' ? 'streets' : step.key === 'home' ? 'home' : step.key === 'obstacles' ? 'obstacles' : 'geofence'}.label`),
        description: t(`wizard.steps.${step.key === 'transit_road' ? 'transitStreets' : step.key === 'tall_obstacle' ? 'highObstacles' : step.key === 'objective' ? 'holes' : step.key === 'road' ? 'streets' : step.key === 'home' ? 'home' : step.key === 'obstacles' ? 'obstacles' : 'geofence'}.description`)
    }));

    const currentStep = steps[currentStepIndex];
    const isLastStep = currentStepIndex === steps.length - 1;

    const handleMapUpdate = (geojson: any) => {
        setCurrentStepData(geojson);
    };

    const saveCurrentStepData = () => {
        if (currentStepData && currentStepData.features && currentStepData.features.length > 0) {
            const enriched = enrichGeoJSONWithUTM(currentStepData);
            const newData = { ...data, [currentStep.key]: enriched };
            setData(newData);
            return true;
        }
        return false;
    };

    const handleNext = () => {
        saveCurrentStepData();
        setCurrentStepData(null); // Reset for next step

        if (!isLastStep) {
            setCurrentStepIndex(prev => prev + 1);
        } else {
            handleSaveAll();
        }
    };

    const handlePrev = () => {
        saveCurrentStepData(); // Save before moving back? Or just discard? Let's save.
        if (currentStepIndex > 0) {
            setCurrentStepIndex(prev => prev - 1);
            setCurrentStepData(null);
        }
    };

    const handleStepClick = (index: number) => {
        saveCurrentStepData();
        setCurrentStepIndex(index);
        setCurrentStepData(null);
    };

    const handleClearAll = () => {
        if (confirm(t('wizard.confirmClearAll'))) {
            setData({});
            setCurrentStepData(null);
            setCurrentStepIndex(0);
            setGenResult(null);
            setGenProgress(0);
            setGenerating(false);
            setViewMode('raw');
            setCenterTrigger(prev => prev + 1);
            if (fileInputRef.current) fileInputRef.current.value = '';
            if (folderInputRef.current) folderInputRef.current.value = '';
            if (resultInputRef.current) resultInputRef.current.value = '';
        }
    };

    const handleClearStep = (stepKey: string, e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent step selection
        if (confirm(t('wizard.confirmClearStep'))) {
            const newData = { ...data };
            delete newData[stepKey];
            setData(newData);

            // If clearing current step, also clear currentStepData
            if (currentStep.key === stepKey) {
                setCurrentStepData(null);
            }
        }
    };

    const handleCenterMap = () => {
        setCenterTrigger(prev => prev + 1);
    };

    const handleLoadGeoJSON = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const content = e.target?.result as string;
                let parsed;

                if (file.name.toLowerCase().endsWith('.hol')) {
                    parsed = parseHolFile(content);
                    alert(`Parsed .hol file with ${parsed.features.length} points.`);
                } else {
                    parsed = JSON.parse(content);
                }

                // Check if it has UTM, if not, it will be enriched on save.
                setCurrentStepData(parsed);

                // Actually, a better way for "Load GeoJSON" in this context might be to load it as the *saved* data for this step.
                const enriched = enrichGeoJSONWithUTM(parsed);
                setData(prev => ({ ...prev, [currentStep.key]: enriched }));

                setCenterTrigger(prev => prev + 1); // Auto-center after load
                alert(`Loaded data into step: ${currentStep.label}`);
            } catch (err) {
                console.error(err);
                alert('Error parsing file');
            }
        };
        reader.readAsText(file);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleLoadFolder = (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (!files || files.length === 0) return;

        const promises: Promise<{ key: string, data: any } | null>[] = [];

        Array.from(files).forEach(file => {
            const name = file.name.toLowerCase();
            let key: string | null = null;

            if (name.includes('geofence')) key = 'geofence';
            else if (name.includes('home')) key = 'home';
            else if (name.includes('transit')) key = 'transit_road';
            else if (name.includes('streets') || name.includes('road')) key = 'road';
            else if (name.includes('high') && name.includes('obstacle')) key = 'tall_obstacle';
            else if (name.includes('obstacle')) key = 'obstacles';
            else if (name.endsWith('.hol') || name.includes('objective') || name.includes('holes')) key = 'objective';

            if (key) {
                const promise = new Promise<{ key: string, data: any } | null>((resolve) => {
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        try {
                            const content = e.target?.result as string;
                            let parsed;
                            if (file.name.toLowerCase().endsWith('.hol')) {
                                parsed = parseHolFile(content);
                            } else {
                                parsed = JSON.parse(content);
                            }
                            const enriched = enrichGeoJSONWithUTM(parsed);
                            resolve({ key: key!, data: enriched });
                        } catch (err) {
                            console.error(`Error parsing ${file.name}`, err);
                            resolve(null);
                        }
                    };
                    reader.readAsText(file);
                });
                promises.push(promise);
            }
        });

        Promise.all(promises).then(results => {
            const newData: Record<string, any> = {}; // Start fresh, do not keep old data
            let loadedCount = 0;
            results.forEach(result => {
                if (result) {
                    newData[result.key] = result.data;
                    loadedCount++;
                }
            });
            setData(newData);
            // Clear generated results when loading new data
            setGenResult(null);
            setCurrentStepData(null); // Clear any in-progress edits to prevent overwriting loaded data on next step
            setViewMode('raw');

            if (loadedCount > 0) {
                setCenterTrigger(prev => prev + 1);
                alert(`Loaded ${loadedCount} files from folder.`);
            } else {
                alert('No matching files found in folder.');
            }
        });

        if (folderInputRef.current) folderInputRef.current.value = '';
    };

    const handleLoadResultFile = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const content = e.target?.result as string;
                if (file.name.endsWith('.csv')) {
                    const { pointsFeatures, lineFeatures, obstacleFeatures, highObstacleFeatures } = parseGlobalPlanCsv(content);

                    setGenResult({
                        arrow_geojson: { type: 'FeatureCollection', features: lineFeatures },
                        global_plan_points: { type: 'FeatureCollection', features: pointsFeatures },
                        obstacles_geojson: { type: 'FeatureCollection', features: obstacleFeatures },
                        high_obstacles_geojson: { type: 'FeatureCollection', features: highObstacleFeatures },
                        download_links: {} // Empty links as we just loaded a file
                    });

                    const holeCount = pointsFeatures.filter((f: any) => f.properties.type === 'hole').length;
                    alert(`Loaded result. Found ${holeCount} valid holes.`);

                    setViewMode('generated');
                    setCenterTrigger(prev => prev + 1);

                } else if (file.name.endsWith('.json') || file.name.endsWith('.geojson')) {
                    const parsed = JSON.parse(content);
                    setGenResult({
                        arrow_geojson: parsed,
                        download_links: {}
                    });
                    setViewMode('generated');
                    setCenterTrigger(prev => prev + 1);
                    alert('Loaded GeoJSON result successfully.');
                }
            } catch (err) {
                console.error('Error parsing file', err);
                alert('Error parsing file');
            }
        };
        reader.readAsText(file);
        if (resultInputRef.current) resultInputRef.current.value = '';
    };

    const handleSaveAll = async () => {
        const zip = new JSZip();

        // Create folder structure: map-geopoligons/geojson/{datetime}/
        const now = new Date();
        const timestamp = now.toISOString().replace(/[:.]/g, '-').split('T')[0] + '_' + now.toTimeString().split(' ')[0].replace(/:/g, '');
        const folderName = `${timestamp}`;
        const folder = zip.folder(folderName);

        if (!folder) return;

        const FILE_NAME_MAPPING: Record<string, string> = {
            'objective': 'holes.geojson',
            'geofence': 'geofence.geojson',
            'home': 'home_pose.geojson',
            'road': 'streets.geojson',
            'transit_road': 'transit_streets.geojson',
            'obstacles': 'obstacles.geojson',
            'tall_obstacle': 'high_obstacles.geojson'
        };

        // Add all steps to zip
        WIZARD_STEPS.forEach(step => {
            const stepData = data[step.key];
            if (stepData) {
                const filename = FILE_NAME_MAPPING[step.key] || `${step.key}.geojson`;
                folder.file(filename, JSON.stringify(stepData, null, 4));

                // Save .hol file for objective (holes)
                if (step.key === 'objective' && stepData.features) {
                    const holContent = generateHolString(stepData.features);
                    folder.file('holes.hol', holContent);
                }
            }
        });

        // Also add current step data if not saved yet
        if (currentStepData && currentStepData.features && currentStepData.features.length > 0) {
            const enriched = enrichGeoJSONWithUTM(currentStepData);
            const filename = FILE_NAME_MAPPING[currentStep.key] || `${currentStep.key}.geojson`;
            folder.file(filename, JSON.stringify(enriched, null, 4));

            // Save .hol file if current step is objective
            if (currentStep.key === 'objective') {
                const holContent = generateHolString(enriched.features);
                folder.file('holes.hol', holContent);
            }
        }

        const content = await zip.generateAsync({ type: 'blob' });
        saveAs(content, `map-geopoligons-${timestamp}.zip`);
    };

    const handleGenerateRoute = async () => {
        // Gather all data
        const allData = { ...data };
        if (currentStepData && currentStepData.features && currentStepData.features.length > 0) {
            const enriched = enrichGeoJSONWithUTM(currentStepData);
            allData[currentStep.key] = enriched;
        }

        // Check required
        if (!allData['objective'] || !allData['geofence'] || !allData['road'] || !allData['home']) {
            alert(t('wizard.missingData'));
            return;
        }

        setGenerating(true);
        setGenProgress(0);
        setGenResult(null);

        // Map Wizard keys to backend keys
        const formattedData: Record<string, any> = {};
        if (allData['objective']) formattedData['holes'] = allData['objective'];
        if (allData['road']) formattedData['streets'] = allData['road'];
        if (allData['home']) formattedData['home_pose'] = allData['home'];
        if (allData['geofence']) formattedData['geofence'] = allData['geofence']; // Same key
        if (allData['obstacles']) formattedData['obstacles'] = allData['obstacles']; // Same key
        if (allData['tall_obstacle']) formattedData['high_obstacles'] = allData['tall_obstacle'];
        if (allData['transit_road']) formattedData['transit_streets'] = allData['transit_road'];

        generateRoutes(
            {}, // Files mapping empty as Wizard uses 'allData' JSON blobs mainly
            formattedData, // GeoJSON map with corrected keys
            options,
            (message: any) => {
                if (message.type === 'progress') {
                    setGenProgress(message.value);
                } else if (message.type === 'result') {
                    setGenResult(message.data);
                    // Extract path nodes if generated
                    if (message.data.global_plan_points) {
                        try {
                            const gj = message.data.global_plan_points;
                            const nodes: any[] = [];
                            gj.features.forEach((f: any) => {
                                if (f.properties.type === 'graph_pose') {
                                    nodes.push({
                                        id: f.properties.graph_id,
                                        label: `${f.properties.graph_id} (${f.properties.pose_type})`,
                                        type: f.properties.pose_type
                                    });
                                }
                            });
                            setPathNodes(nodes);
                        } catch (e) { console.error(e); }
                    }

                    setViewMode('generated'); // Switch to generated view automatically
                    alert(t('wizard.successRoute'));

                    // Fetch CSV content to visualize obstacles correctly
                    if (message.data.download_links && message.data.download_links.csv) {
                        fetch(message.data.download_links.csv)
                            .then(res => res.text())
                            .then(csvText => {
                                const { obstacleFeatures, highObstacleFeatures, pointsFeatures } = parseGlobalPlanCsv(csvText);

                                setGenResult((prev: any) => {
                                    const now = Date.now();
                                    return {
                                        ...prev,
                                        obstacles_geojson: { type: 'FeatureCollection', features: obstacleFeatures, _updateId: now },
                                        high_obstacles_geojson: { type: 'FeatureCollection', features: highObstacleFeatures, _updateId: now },
                                        global_plan_points: { type: 'FeatureCollection', features: pointsFeatures, _updateId: now },
                                    };
                                });
                            })
                            .catch(err => console.error('Failed to fetch generated CSV for visualization', err));
                    }
                } else if (message.type === 'error') {
                    alert(`Error: ${message.message}`);
                }
            }
        ).finally(() => {
            setGenerating(false);
        });
    };

    const refreshNodes = async () => {
        try {
            const nodes = await fetchGraphNodes();
            // Map backend nodes structure to UI structure if needed, or if fetchGraphNodes returns GraphNode[]
            // Backend returns { nodes: [{id, x, y, theta, type, label?}, ...] }
            // fetchGraphNodes returns GraphNode[] directly.

            // Adjust to match state type
            const mappedNodes = nodes.map((n: any) => ({
                id: n.id,
                label: n.label || `${n.id} (${n.type})`,
                type: n.type,
                x: n.x, y: n.y, theta: n.theta // Preserve coordinates
            }));
            setPathNodes(mappedNodes);

        } catch (error) {
            console.error('Failed to refresh nodes', error);
        }
    };

    // Fetch nodes when generation succeeds or result loaded
    if (viewMode === 'generated' && pathNodes.length === 0 && genResult) {
        refreshNodes();
    }

    const handleCalculatePath = async () => {
        if (!pathStart || !pathEnd) {
            alert(t('Select start and end nodes'));
            return;
        }
        setPathLoading(true);
        try {
            const result = await calculatePath(parseInt(pathStart), parseInt(pathEnd));

            if (result.path) {
                // Backend returns full list of node objects with coords
                setCalculatedPath(result.path);
                setPathProgress(0);
                setPathRevision(prev => prev + 1); // Trigger map update
                setCenterTrigger(prev => prev + 1);
            }

        } catch (err: any) {
            alert(err.message || 'Error calculating path');
        } finally {
            setPathLoading(false);
        }
    };

    const handleTransfer = async (transferData: any) => {
        setIsTransferring(true);
        try {
            const result = await transferFiles(transferData);

            // Format result message if multiple files
            let msg = result.message;
            if (result.results) {
                const successCount = result.results.filter((r: any) => r.status === 'success').length;
                const failCount = result.results.length - successCount;
                msg = `Transferred ${successCount} files. ${failCount > 0 ? `${failCount} failed.` : ''}`;
            }

            alert(msg || 'Transfer successful!');
            setShowTransferModal(false);
        } catch (error: any) {
            alert(`Transfer failed: ${error.message}`);
        } finally {
            setIsTransferring(false);
        }
    };

    // Prepare data for MapComponent based on viewMode
    const getMapData = () => {
        if (viewMode === 'generated' && genResult) {
            return {
                // Show generated routes
                'routes': genResult.arrow_geojson,
                // Show fitted streets if available
                'fitted_streets': genResult.fitted_streets_geojson ? JSON.parse(genResult.fitted_streets_geojson) : null,
                'fitted_transit_streets': genResult.fitted_transit_streets_geojson ? JSON.parse(genResult.fitted_transit_streets_geojson) : null,
                // Only show generated obstacles if available, otherwise null (clean view)
                'obstacles': genResult.obstacles_geojson ? genResult.obstacles_geojson : null,
                'high_obstacles': genResult.high_obstacles_geojson ? genResult.high_obstacles_geojson : null,
                // Ensure raw inputs are hidden in generated mode
                'objective': null,
                'geofence': null,
                'road': null,
                'transit_road': null,
                'home': null,
                // Interactive Path Overlay
                'interactive_path': calculatedPath ? {
                    type: 'FeatureCollection',
                    _updateId: `${pathProgress}-${pathRevision}`,
                    features: (() => {
                        const features: any[] = [{
                            type: 'Feature',
                            geometry: {
                                type: 'LineString',
                                coordinates: calculatedPath.map((p: any) => [p.lon, p.lat])
                            },
                            properties: { style: 'interactive-path' }
                        }];

                        // Add markers for all path nodes to show IDs
                        calculatedPath.forEach((p: any) => {
                            features.push({
                                type: 'Feature',
                                geometry: { type: 'Point', coordinates: [p.lon, p.lat] },
                                properties: { style: 'path-node', id: p.id }
                            });
                        });

                        // Add markers for all path nodes to show IDs
                        calculatedPath.forEach((p: any) => {
                            features.push({
                                type: 'Feature',
                                geometry: { type: 'Point', coordinates: [p.lon, p.lat] },
                                properties: { style: 'path-node', id: p.id }
                            });
                        });

                        if (calculatedPath.length > 0) {
                            // Start Point
                            const start = calculatedPath[0];
                            features.push({
                                type: 'Feature',
                                geometry: { type: 'Point', coordinates: [start.lon, start.lat] },
                                properties: { style: 'path-start', label: 'Start' }
                            });
                            // End Point
                            const end = calculatedPath[calculatedPath.length - 1];
                            features.push({
                                type: 'Feature',
                                geometry: { type: 'Point', coordinates: [end.lon, end.lat] },
                                properties: { style: 'path-end', label: 'End' }
                            });

                            // Robot Position
                            if (calculatedPath.length >= 2) {
                                const totalSegments = calculatedPath.length - 1;
                                const exactIndex = (pathProgress / 100) * totalSegments;
                                const idx = Math.floor(exactIndex);
                                const t = exactIndex - idx;

                                const p1 = calculatedPath[Math.min(idx, calculatedPath.length - 1)];
                                const p2 = calculatedPath[Math.min(idx + 1, calculatedPath.length - 1)];

                                // Interpolate Lat/Lon
                                const rlon = p1.lon + (p2.lon - p1.lon) * t;
                                const rlat = p1.lat + (p2.lat - p1.lat) * t;

                                features.push({
                                    type: 'Feature',
                                    geometry: { type: 'Point', coordinates: [rlon, rlat] },
                                    properties: { style: 'robot-pose', label: 'Robot' }
                                });

                                // --- Add Nearest & Recovery Poses (Moved from Render) ---
                                // 1. Calculate Robot Pose in WGS84 (Lat/Lon)
                                // We already have rlon, rlat calculated above.

                                // 2. Find Nearest Street Pose
                                // We use local coordinates for DISTANCE CHECK only, assuming path nodes are local-ish (or align with graph local)
                                const rx_local = p1.x + (p2.x - p1.x) * t;
                                const ry_local = p1.y + (p2.y - p1.y) * t;
                                // Interpolate Angle
                                let a1 = p1.theta;
                                let a2 = p2.theta;
                                let da = a2 - a1;
                                while (da > Math.PI) da -= 2 * Math.PI;
                                while (da < -Math.PI) da += 2 * Math.PI;
                                const rtheta = a1 + da * t;

                                let min_dist = Infinity;
                                let nearest_feature: any = null;

                                if (genResult && genResult.global_plan_points && genResult.global_plan_points.features) {
                                    for (const f of genResult.global_plan_points.features) {
                                        const props = f.properties;
                                        if (props.pose_type === 'street' || props.pose_type === 'transit_street' || props.pose_type === 'home_pose') {
                                            // Get Local Coords for distance check
                                            let px = 0, py = 0;
                                            try {
                                                let parts = null;
                                                if (Array.isArray(props.graph_pose_local)) parts = props.graph_pose_local;
                                                else if (typeof props.graph_pose_local === 'string') parts = JSON.parse(props.graph_pose_local);

                                                // Fallback to graph_pose if local not available (assuming dataset might be mixed, 
                                                // but usually if local exists we use it. If rx is local, we must use local)
                                                if (!parts && Array.isArray(props.graph_pose)) parts = props.graph_pose;
                                                // Warning: if rx is local and we compare with UTM, distance will be huge. 
                                                // We assume consistency: path includes local coords if global_plan has them.

                                                if (parts && Array.isArray(parts) && parts.length >= 2) {
                                                    px = parts[0]; py = parts[1];
                                                } else {
                                                    continue;
                                                }
                                            } catch (e) { continue; }

                                            const d = Math.sqrt(Math.pow(px - rx_local, 2) + Math.pow(py - ry_local, 2));
                                            if (d < min_dist) {
                                                min_dist = d;
                                                nearest_feature = f;
                                            }
                                        }
                                    }
                                }

                                // 3. Add Nearest Pose
                                let assigned_theta = rtheta;
                                let assigned_x = 0;
                                let assigned_y = 0;
                                let use_nearest_for_recovery = false;

                                // If found, use the feature's ALREADY CALCULATED WGS84 geometry
                                if (nearest_feature && min_dist < 50.0) { // Safety threshold
                                    // Assuming nearest_feature geometry is Point [lon, lat]
                                    if (nearest_feature.geometry && nearest_feature.geometry.coordinates) {
                                        features.push({
                                            type: 'Feature',
                                            geometry: { type: 'Point', coordinates: nearest_feature.geometry.coordinates },
                                            properties: { style: 'nearest-pose', label: 'Nearest' }
                                        });

                                        if (min_dist < 2.0) {
                                            // We align with the street here
                                            // We need both theta AND position from the graph node (UTM)
                                            try {
                                                let gp = nearest_feature.properties.graph_pose;
                                                if (typeof gp === 'string') gp = JSON.parse(gp.replace(/'/g, '"'));
                                                if (Array.isArray(gp) && gp.length >= 3) {
                                                    assigned_x = gp[0];
                                                    assigned_y = gp[1];
                                                    assigned_theta = gp[2];
                                                    use_nearest_for_recovery = true;
                                                }
                                            } catch (e) { }
                                        }
                                    }
                                }

                                // 4. Add Recovery Pose
                                // Strategy: Use Assigned Pose -> Offset -> WGS84
                                // If min_dist < 2.0, assigned is Nearest Node (UTM).
                                // If min_dist >= 2.0, assigned is Robot (Lat/Lon -> UTM).

                                try {
                                    let start_x, start_y;

                                    if (use_nearest_for_recovery) {
                                        // Use the street node's UTM directly
                                        start_x = assigned_x;
                                        start_y = assigned_y;
                                    } else {
                                        // Use Robot's UTM
                                        const [utm_x, utm_y] = proj4(WGS84, UTM_ZONE_19S, [rlon, rlat]);
                                        start_x = utm_x;
                                        start_y = utm_y;
                                    }

                                    // Calculate Offset in Meters
                                    const rec_dist = -2.0;
                                    const recovery_x = start_x + rec_dist * Math.cos(assigned_theta);
                                    const recovery_y = start_y + rec_dist * Math.sin(assigned_theta);

                                    // Project back to WGS84
                                    const [rec_lon, rec_lat] = proj4(UTM_ZONE_19S, WGS84, [recovery_x, recovery_y]);

                                    features.push({
                                        type: 'Feature',
                                        geometry: { type: 'Point', coordinates: [rec_lon, rec_lat] },
                                        properties: { style: 'recovery-pose', label: 'Recovery' }
                                    });
                                } catch (e) { console.error("Projection error", e); }
                            }
                        }
                        return features;
                    })()
                } : null,
                // Add any other generated layers if available
                'global_plan_points': genResult.global_plan_points ? genResult.global_plan_points : (() => {
                    // If global_plan_points is not pre-calculated (e.g. from fresh generation), calculate it here
                    if (genResult.global_plan_data) {
                        const features = genResult.global_plan_data
                            .filter((row: any) => row.type === 'graph_pose')
                            .map((row: any) => {
                                try {
                                    // The CSV column is 'graph_pose' for global UTM coordinates
                                    let coordsStr = row.graph_pose;
                                    let isGlobal = true;
                                    if (!coordsStr || coordsStr === 'nan') {
                                        coordsStr = row.graph_pose_local;
                                        isGlobal = false;
                                    }
                                    if (coordsStr) {
                                        if (typeof coordsStr === 'string') {
                                            coordsStr = coordsStr.replace(/^"|"$/g, '').replace(/'/g, '"');
                                            const coords = JSON.parse(coordsStr);
                                            if (Array.isArray(coords) && coords.length >= 2) {
                                                let [lon, lat] = [coords[0], coords[1]];
                                                if (isGlobal) {
                                                    [lon, lat] = proj4(UTM_ZONE_19S, WGS84, [coords[0], coords[1]]);
                                                }
                                                return {
                                                    type: 'Feature',
                                                    geometry: { type: 'Point', coordinates: [lon, lat] },
                                                    properties: row
                                                };
                                            }
                                        }
                                    }
                                } catch (e) { }
                                return null;
                            }).filter(Boolean);
                        return { type: 'FeatureCollection', features };
                    }
                    return null;
                })(),
            };
        }
        return data;
    };

    const currentMapData = getMapData();

    return (
        <div className="wizard-container">
            {/* Sidebar */}
            <div className="sidebar" ref={sidebarRef}>
                <div className="sidebar-header">
                    <h1 className="wizard-title">
                        {t('wizard.title')}
                    </h1>
                    <p className="wizard-subtitle">{t('wizard.subtitle')}</p>

                    <div className="flex border-b border-slate-200 mb-4">
                        <button
                            className={`flex-1 py-2 text-sm font-medium ${activeTab === 'load' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                            onClick={() => setActiveTab('load')}
                        >
                            Carga
                        </button>
                        <button
                            className={`flex-1 py-2 text-sm font-medium ${activeTab === 'details' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                            onClick={() => setActiveTab('details')}
                        >
                            Detalles
                        </button>
                    </div>
                </div>

                {activeTab === 'load' && (
                    <>
                        <div className="sidebar-actions-grid p-4 pt-0">
                            <button
                                onClick={handleClearAll}
                                className="btn-action-red"
                                title="Delete all figures"
                            >
                                <Trash2 className="w-3 h-3" /> {t('wizard.clearAll')}
                            </button>
                            <button
                                onClick={handleCenterMap}
                                className="btn-action-blue"
                                title="Center map on data"
                            >
                                <Upload className="w-3 h-3 rotate-90" /> {t('wizard.centerMap')}
                            </button>
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="btn-action-slate"
                                title="Load GeoJSON"
                            >
                                <Upload className="w-3 h-3" /> {t('wizard.loadJson')}
                            </button>
                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleLoadGeoJSON}
                                accept=".geojson,.json,.hol"
                                className="hidden"
                            />
                            <button
                                onClick={() => folderInputRef.current?.click()}
                                className="btn-action-slate"
                                title="Load Folder"
                            >
                                <Folder className="w-3 h-3" /> {t('wizard.loadFolder')}
                            </button>
                            <input
                                type="file"
                                ref={folderInputRef}
                                onChange={handleLoadFolder}
                                // @ts-ignore
                                webkitdirectory=""
                                directory=""
                                multiple
                                className="hidden"
                            />
                            <button
                                onClick={() => resultInputRef.current?.click()}
                                className="btn-action-slate"
                                title="Load Result File"
                            >
                                <Upload className="w-3 h-3" /> {t('Load Result')}
                            </button>
                            <input
                                type="file"
                                ref={resultInputRef}
                                onChange={handleLoadResultFile}
                                accept=".csv,.json,.geojson"
                                className="hidden"
                            />
                        </div>

                        <div className="steps-container">
                            {steps.map((step, index) => {
                                const isActive = index === currentStepIndex;
                                const hasData = !!data[step.key];

                                return (
                                    <div
                                        key={step.key}
                                        ref={(el: HTMLDivElement | null) => {
                                            if (el) {
                                                stepRefs.current[index] = el;
                                            } else {
                                                // Clean up ref when component unmounts
                                                delete stepRefs.current[index];
                                            }
                                        }}
                                        onClick={() => handleStepClick(index)}
                                        className={`step-item ${isActive
                                            ? 'step-item-active'
                                            : hasData
                                                ? 'step-item-completed'
                                                : 'step-item-inactive'
                                            }`}
                                    >
                                        <div className="step-header">
                                            <span className={`step-number ${isActive ? 'step-number-active' : 'step-number-inactive'
                                                }`}>
                                                {t('wizard.step')} {index + 1}
                                            </span>
                                            {hasData && (
                                                <div className="step-status-wrapper">
                                                    <CheckCircle className="w-4 h-4 text-green-500" />
                                                    <button
                                                        onClick={(e) => handleClearStep(step.key, e)}
                                                        className="btn-clear-step"
                                                        title="Clear step data"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                        <h3 className={`step-label ${isActive ? 'step-label-active' : 'step-label-inactive'}`}>
                                            {step.label}
                                        </h3>
                                        <p className="step-desc">
                                            {step.description}
                                        </p>
                                    </div>
                                );
                            })}
                        </div>

                        <div className="sidebar-footer">
                            <div className="footer-actions">
                                <div className="nav-buttons-row">
                                    <button
                                        onClick={handlePrev}
                                        disabled={currentStepIndex === 0}
                                        className="btn-nav-back"
                                    >
                                        <ArrowLeft className="w-4 h-4" />
                                        {t('wizard.back')}
                                    </button>
                                    <button
                                        onClick={handleNext}
                                        disabled={isLastStep}
                                        className="btn-nav-next"
                                    >
                                        {t('wizard.next')}
                                        <ArrowRight className="w-4 h-4" />
                                    </button>
                                </div>
                                <button
                                    onClick={handleGenerateRoute}
                                    disabled={generating}
                                    className="btn-generate-route"
                                >
                                    {generating ? t('wizard.generating', { progress: Math.round(genProgress) }) : <><Play className="w-4 h-4" /> {t('wizard.generateRoute')}</>}
                                </button>

                                <div className="nav-buttons-row">
                                    <button
                                        onClick={handleSaveAll}
                                        disabled={Object.keys(data).length === 0}
                                        className="btn-download-all disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <Download className="w-4 h-4" /> {t('wizard.saveInputs')}
                                    </button>
                                    <button
                                        onClick={() => {
                                            if (!genResult || !genResult.download_links) {
                                                alert(t('wizard.noResultsToDownload'));
                                                return;
                                            }

                                            const now = new Date();
                                            const timestamp = now.toISOString().replace(/[:.]/g, '-').split('T')[0] + '_' + now.toTimeString().split(' ')[0].replace(/:/g, '');
                                            const zip = new JSZip();
                                            const folder = zip.folder(`results_${timestamp}`);

                                            // Helper to fetch and add file
                                            const addFile = async (url: string, name: string) => {
                                                try {
                                                    const res = await fetch(url);
                                                    if (!res.ok) throw new Error('Fetch failed');
                                                    const blob = await res.blob();
                                                    folder?.file(name, blob);
                                                } catch (e) {
                                                    console.warn(`Failed to download ${name}`, e);
                                                }
                                            };

                                            const promises = [];
                                            if (genResult.download_links.csv) promises.push(addFile(genResult.download_links.csv, 'global_plan.csv'));
                                            if (genResult.download_links.map_png) promises.push(addFile(genResult.download_links.map_png, 'map.png'));
                                            if (genResult.download_links.map_yaml) promises.push(addFile(genResult.download_links.map_yaml, 'maze_peld.yaml'));
                                            if (genResult.download_links.latlon_yaml) promises.push(addFile(genResult.download_links.latlon_yaml, 'latlon.yaml'));

                                            Promise.all(promises).then(async () => {
                                                const content = await zip.generateAsync({ type: 'blob' });
                                                saveAs(content, `generated_results_${timestamp}.zip`);
                                            });
                                        }}
                                        disabled={!genResult}
                                        className="btn-download-all bg-green-600 hover:bg-green-600 disabled:bg-slate-300"
                                        title={t('wizard.downloadGeneratedFiles')}
                                    >
                                        <Download className="w-4 h-4" /> {t('wizard.downloadResults')}
                                    </button>
                                </div>
                                <div className="nav-buttons-row">
                                    <button
                                        onClick={() => setShowTransferModal(true)}
                                        className="btn-transfer w-full"
                                        title="Transfer files via SCP"
                                    >
                                        <Send className="w-4 h-4" /> {t('Transfer')}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </>
                )}

                {/* Path Interaction Section - Visible in Details tab */}
                {activeTab === 'details' && (
                    <div className="mt-auto pt-4 border-t border-slate-200 h-full overflow-y-auto">
                        <h3 className="text-sm font-semibold text-slate-700 mb-2">Path Finder</h3>
                        <div className="space-y-3">
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="block text-xs font-medium text-slate-500 mb-1">Start Node</label>
                                    <select
                                        value={pathStart}
                                        onChange={(e) => setPathStart(e.target.value)}
                                        className="w-full text-sm border-slate-300 rounded focus:ring-blue-500 focus:border-blue-500"
                                    >
                                        <option value="">Select Start</option>
                                        {pathNodes.map(node => (
                                            <option key={node.id} value={node.id}>{node.label}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-slate-500 mb-1">End Node</label>
                                    <select
                                        value={pathEnd}
                                        onChange={(e) => setPathEnd(e.target.value)}
                                        className="w-full text-sm border-slate-300 rounded focus:ring-blue-500 focus:border-blue-500"
                                    >
                                        <option value="">Select End</option>
                                        {pathNodes.map(node => (
                                            <option key={node.id} value={node.id}>{node.label}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <button
                                onClick={handleCalculatePath}
                                disabled={pathLoading}
                                className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2"
                            >
                                {pathLoading ? (
                                    <>
                                        <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></span>
                                        Calculating...
                                    </>
                                ) : (
                                    <>
                                        <Play className="w-4 h-4 fill-current" /> Calculate Path
                                    </>
                                )}
                            </button>

                            {calculatedPath && (
                                <div className="mt-4 p-3 bg-slate-50 rounded border border-slate-200">
                                    <div className="mb-2">
                                        <label className="flex justify-between text-xs font-medium text-slate-600 mb-1">
                                            <span>Robot Steps</span>
                                            <span>{pathProgress}%</span>
                                        </label>
                                        <input
                                            type="range"
                                            min="0"
                                            max="100"
                                            value={pathProgress}
                                            onChange={(e) => setPathProgress(parseInt(e.target.value))}
                                            className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                                        />
                                    </div>

                                    <div className="font-mono text-[10px] leading-tight text-slate-700 overflow-x-auto whitespace-pre bg-white p-2 rounded border border-slate-200 shadow-inner max-h-[200px] overflow-y-auto">
                                        {(() => {
                                            // 1. Calculate Robot Pose based on progress
                                            if (!calculatedPath || calculatedPath.length < 2) return "";

                                            const totalSegments = calculatedPath.length - 1;
                                            const exactIndex = (pathProgress / 100) * totalSegments;
                                            const idx = Math.floor(exactIndex);
                                            const t = exactIndex - idx;

                                            // Safety check
                                            if (idx >= calculatedPath.length - 1) {
                                                // const last = calculatedPath[calculatedPath.length - 1];
                                                // Handle logic for last point similar to inside loop
                                                // ... (Simplified for updating View)
                                            }

                                            const p1 = calculatedPath[Math.min(idx, calculatedPath.length - 1)];
                                            const p2 = calculatedPath[Math.min(idx + 1, calculatedPath.length - 1)];

                                            // Interpolate Robot Pose (Global Plan coords are typically local for simulation, but we use them as is)
                                            // Use x,y from path which are local/UTM (not lat/lon) for consistent distance calc
                                            const rx = p1.x + (p2.x - p1.x) * t;
                                            const ry = p1.y + (p2.y - p1.y) * t;
                                            // Interpolate Angle
                                            // Shortest path interpolation for angle
                                            let a1 = p1.theta;
                                            let a2 = p2.theta;
                                            let da = a2 - a1;
                                            while (da > Math.PI) da -= 2 * Math.PI;
                                            while (da < -Math.PI) da += 2 * Math.PI;
                                            const rtheta = a1 + da * t;

                                            // 2. Find Nearest Street Pose
                                            // Using genResult.global_plan_points which contains all graph nodes
                                            let min_dist = Infinity;
                                            let nearest_pose: any = null;

                                            // Filter for street nodes from cached data if possible, or just iterate all
                                            if (genResult && genResult.global_plan_points && genResult.global_plan_points.features) {
                                                for (const f of genResult.global_plan_points.features) {
                                                    const props = f.properties;
                                                    // Check if type is street (or home/transit? usually just street for compliance)
                                                    if (props.pose_type === 'street' || props.pose_type === 'transit_street' || props.pose_type === 'home_pose') {
                                                        // Parse coords
                                                        let px = 0, py = 0, pth = 0;
                                                        // Using local coords if available for distance check?
                                                        // Graph points features usually have lat/lon in geometry, but properties might have local
                                                        // Let's use properties.graph_pose_local if available, else standard
                                                        try {
                                                            let parts = null;
                                                            if (Array.isArray(props.graph_pose_local)) parts = props.graph_pose_local;
                                                            else if (typeof props.graph_pose_local === 'string') parts = JSON.parse(props.graph_pose_local);

                                                            if (!parts && Array.isArray(props.graph_pose)) parts = props.graph_pose;
                                                            else if (!parts && typeof props.graph_pose === 'string') parts = JSON.parse(props.graph_pose.replace(/'/g, '"'));

                                                            if (parts && Array.isArray(parts) && parts.length >= 2) {
                                                                px = parts[0]; py = parts[1]; pth = parts[2] || 0;
                                                            } else {
                                                                continue;
                                                            }
                                                        } catch (e) { continue; }

                                                        const d = Math.sqrt(Math.pow(px - rx, 2) + Math.pow(py - ry, 2));
                                                        if (d < min_dist) {
                                                            min_dist = d;
                                                            nearest_pose = { x: px, y: py, theta: pth };
                                                        }
                                                    }
                                                }
                                            }

                                            // 3. Calculate Assigned & Recovery
                                            let assigned_pose = nearest_pose ? { ...nearest_pose } : null;
                                            if (min_dist > 2.0) {
                                                assigned_pose = { x: rx, y: ry, theta: rtheta };
                                            }

                                            let recovery_pose = null;
                                            if (assigned_pose) {
                                                const rec_dist = -2.0;
                                                recovery_pose = {
                                                    x: assigned_pose.x + rec_dist * Math.cos(assigned_pose.theta),
                                                    y: assigned_pose.y + rec_dist * Math.sin(assigned_pose.theta),
                                                    theta: assigned_pose.theta
                                                };
                                            }

                                            // Formatting Output
                                            const pathIds = calculatedPath.map(p => p.id);
                                            const waypointsStr = calculatedPath.map(p => `${p.id}(${p.x.toFixed(1)}, ${p.y.toFixed(1)})`).join(', ');

                                            return (
                                                <>
                                                    <div>Nodos del camino ({calculatedPath.length}): [{pathIds.join(', ')}]</div>
                                                    <div className="mt-1">Poses Waypoints: {waypointsStr}</div>
                                                    <div className="mt-1 font-bold text-blue-700">Robot Pose:     x={rx.toFixed(2)}, y={ry.toFixed(2)}</div>
                                                    <div className="text-green-700">Nearest Pose:   x={nearest_pose?.x.toFixed(2) || 'N/A'}, y={nearest_pose?.y.toFixed(2) || 'N/A'}</div>
                                                    <div className="text-purple-700">Assigned Pose:  x={assigned_pose?.x.toFixed(2) || 'N/A'}, y={assigned_pose?.y.toFixed(2) || 'N/A'}</div>
                                                    <div className="text-red-700">Recovery Pose:  x={recovery_pose?.x.toFixed(2) || 'N/A'}, y={recovery_pose?.y.toFixed(2) || 'N/A'}</div>
                                                </>
                                            );
                                        })()}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>


            <TransferModal
                isOpen={showTransferModal}
                onClose={() => setShowTransferModal(false)}
                onTransfer={handleTransfer}
                isTransferring={isTransferring}
                availableFiles={['global_plan.csv', 'map.png', 'maze_peld.yaml', 'latlon.yaml']}
            />

            {/* Main Content */}
            <div className="main-content">
                <div className="map-container relative">
                    {/* Map Overlay Toggle */}
                    <div className="absolute top-4 right-4 z-[1000] bg-white/90 backdrop-blur-sm shadow-md rounded-lg p-1 flex">
                        <button
                            onClick={() => setViewMode('raw')}
                            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${viewMode === 'raw'
                                ? 'bg-white text-blue-600 shadow-sm'
                                : 'text-slate-500 hover:text-slate-700'
                                }`}
                        >
                            {t('Raw Input')}
                        </button>
                        <button
                            onClick={() => setViewMode('generated')}
                            disabled={!genResult}
                            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${viewMode === 'generated'
                                ? 'bg-white text-green-600 shadow-sm'
                                : 'text-slate-500 hover:text-slate-700 disabled:opacity-50 disabled:cursor-not-allowed'
                                }`}
                        >
                            {t('Generated')}
                        </button>
                    </div>
                    <MapComponent
                        currentStepKey={viewMode === 'raw' ? currentStep.key : 'preview'} // 'preview' or similar to avoid editing in generated mode
                        drawMode={viewMode === 'raw' ? currentStep.drawMode : 'none'} // Disable drawing in generated mode
                        existingData={currentMapData}
                        onUpdate={handleMapUpdate}
                        centerTrigger={centerTrigger}
                    />

                </div>

                {/* Floating Info */}
                {viewMode === 'raw' && (
                    <div className="floating-info">
                        <p className="floating-info-text">
                            <span className="pulse-dot"></span>
                            Drawing: <span className="drawing-label">{currentStep.label}</span>
                        </p>
                    </div>
                )}
                {viewMode === 'generated' && (
                    <div className="floating-info border-green-200 bg-green-50/90">
                        <p className="floating-info-text text-green-800">
                            <CheckCircle className="w-4 h-4 text-green-600" />
                            Viewing: <span className="drawing-label text-green-900">Generated Route</span>
                        </p>
                    </div>
                )}

                {/* Options Section - Below Map */}
                <div className="bg-white p-4 border-t border-slate-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] z-10 shrink-0">
                    <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                        <Settings className="w-4 h-4" /> {t('routeGenerator.options.title')}
                    </h3>
                    <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
                        <Checkbox
                            label={t('routeGenerator.options.fitStreets')}
                            checked={options.fit_streets}
                            onChange={(c) => setOptions(prev => ({ ...prev, fit_streets: c }))}
                        />
                        <Checkbox
                            label={t('routeGenerator.options.fitTwice')}
                            checked={options.fit_twice}
                            onChange={(c) => setOptions(prev => ({ ...prev, fit_twice: c }))}
                        />
                        <Checkbox
                            label={t('routeGenerator.options.wgs84')}
                            checked={options.wgs84}
                            onChange={(c) => setOptions(prev => ({ ...prev, wgs84: c }))}
                        />
                        <Checkbox
                            label={t('routeGenerator.options.useObstacles')}
                            checked={options.use_obstacles}
                            onChange={(c) => setOptions(prev => ({ ...prev, use_obstacles: c }))}
                        />
                        <Checkbox
                            label={t('routeGenerator.options.useHighObstacles')}
                            checked={options.use_high_obstacles}
                            onChange={(c) => setOptions(prev => ({ ...prev, use_high_obstacles: c }))}
                        />
                        <Checkbox
                            label={t('routeGenerator.options.useTransitStreets')}
                            checked={options.use_transit_streets}
                            onChange={(c) => setOptions(prev => ({ ...prev, use_transit_streets: c }))}
                        />
                    </div>
                </div>
            </div>

            {/* Result Modal */}
            {
                showGenModal && genResult && (
                    <div className="modal-overlay">
                        <div className="modal-content">
                            <div className="modal-header">
                                <h2 className="modal-title">Route Generation Result</h2>
                                <button onClick={() => setShowGenModal(false)} className="btn-close-modal">
                                    <X className="w-6 h-6 text-gray-500" />
                                </button>
                            </div>
                            <div className="modal-body">
                                <div className="modal-map-wrapper">
                                    <img src={genResult.map_image} alt="Generated Map" className="w-full h-auto" />
                                </div>
                                <div className="modal-downloads-grid">
                                    <a href={genResult.download_links.csv} download className="download-card group">
                                        <Download className="w-6 h-6 text-gray-500 group-hover:text-blue-600" />
                                        <span className="download-card-text">Global Plan (CSV)</span>
                                    </a>
                                    <a href={genResult.download_links.map_png} download className="download-card group">
                                        <Download className="w-6 h-6 text-gray-500 group-hover:text-blue-600" />
                                        <span className="download-card-text">Map Image (PNG)</span>
                                    </a>
                                    <a href={genResult.download_links.map_yaml} download className="download-card group">
                                        <Download className="w-6 h-6 text-gray-500 group-hover:text-blue-600" />
                                        <span className="download-card-text">Map Config (YAML)</span>
                                    </a>
                                    <a href={genResult.download_links.latlon_yaml} download className="download-card group">
                                        <Download className="w-6 h-6 text-gray-500 group-hover:text-blue-600" />
                                        <span className="download-card-text">LatLon Config (YAML)</span>
                                    </a>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
};

export default Wizard;

function Checkbox({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
    return (
        <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
                type="checkbox"
                checked={checked}
                onChange={(e) => onChange(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
            />
            <span className="text-sm text-slate-600">{label}</span>
        </label>
    )
}
