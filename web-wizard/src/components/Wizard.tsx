import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { WIZARD_STEPS } from '../types';
import MapComponent from './MapComponent';
import { enrichGeoJSONWithUTM } from '../utils/utm';
import { saveAs } from 'file-saver';
import JSZip from 'jszip';
import { ArrowRight, ArrowLeft, CheckCircle, Trash2, Upload, Download, Folder, Play, X, Settings, Send } from 'lucide-react';
import TransferModal from './TransferModal';
import { parseHolFile, generateHolString, UTM_ZONE_19S, WGS84 } from '../utils/holParser';
import proj4 from 'proj4';
import '../styles/components/Wizard.css';

const Wizard = () => {
    const { t } = useTranslation();
    const [currentStepIndex, setCurrentStepIndex] = useState(0);
    const [data, setData] = useState<Record<string, any>>({});
    const [currentStepData, setCurrentStepData] = useState<any>(null);
    const [centerTrigger, setCenterTrigger] = useState(0);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const folderInputRef = useRef<HTMLInputElement>(null);
    const resultInputRef = useRef<HTMLInputElement>(null);

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
    const [pathNodes, setPathNodes] = useState<{ id: number, label: string, type: string }[]>([]);
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
                    // Parse CSV
                    const lines = content.split('\n');
                    const headers = lines[0].split(',');
                    const data = [];

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
                        .filter((row: any) => row.type === 'graph_pose')
                        .map((row: any) => {
                            try {
                                // Try to use global coordinates first (UTM)
                                // The CSV column is 'graph_pose' for global UTM coordinates
                                let coordsStr = row.graph_pose;
                                let isGlobal = true;

                                if (!coordsStr || coordsStr === 'nan') {
                                    // Fallback to local if global is missing (though global is preferred for map)
                                    coordsStr = row.graph_pose_local;
                                    isGlobal = false;
                                }

                                if (coordsStr) {
                                    coordsStr = coordsStr.replace(/^"|"$/g, '').replace(/'/g, '"');
                                    const coords = JSON.parse(coordsStr);
                                    if (Array.isArray(coords) && coords.length >= 2) {
                                        let lon = coords[0];
                                        let lat = coords[1];

                                        // Convert UTM to WGS84 if using global coordinates
                                        if (isGlobal) {
                                            [lon, lat] = proj4(UTM_ZONE_19S, WGS84, [coords[0], coords[1]]);
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
                                }
                            } catch (e) {
                                console.warn('Failed to parse pose', row);
                            }
                            return null;
                        })
                        .filter(Boolean);

                    // Extract Lines (Routes)
                    const lineFeatures: any[] = [];
                    for (const row of data) {
                        if (row.type === 'graph_pose' && row.connections && nodes[row.graph_id]) {
                            try {
                                let connsStr = row.connections.replace(/^"|"$/g, '').replace(/'/g, '"');
                                if (connsStr && connsStr !== 'nan' && connsStr !== '[]') {
                                    const conns = JSON.parse(connsStr);
                                    if (Array.isArray(conns)) {
                                        conns.forEach((targetId: any) => {
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
                            } catch (e) {
                                // console.warn('Failed to parse connections', row);
                            }
                        }
                    }

                    setGenResult({
                        arrow_geojson: { type: 'FeatureCollection', features: lineFeatures },
                        global_plan_points: { type: 'FeatureCollection', features: pointsFeatures },
                        download_links: {} // Empty links as we just loaded a file
                    });
                    setViewMode('generated');
                    setCenterTrigger(prev => prev + 1);
                    alert('Loaded result file successfully.');

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

        const formData = new FormData();

        const appendFile = (key: string, fieldName: string, filename: string) => {
            if (allData[key]) {
                const blob = new Blob([JSON.stringify(allData[key])], { type: 'application/json' });
                formData.append(fieldName, blob, filename);
            }
        };

        appendFile('objective', 'holes', 'holes.geojson');
        appendFile('geofence', 'geofence', 'geofence.geojson');
        appendFile('road', 'streets', 'streets.geojson');
        appendFile('home', 'home_pose', 'home_pose.geojson');
        appendFile('obstacles', 'obstacles', 'obstacles.geojson');
        appendFile('tall_obstacle', 'high_obstacles', 'high_obstacles.geojson');
        appendFile('transit_road', 'transit_streets', 'transit_streets.geojson');

        // Add default options
        // Add options from state
        formData.append('fit_streets', options.fit_streets.toString());
        formData.append('fit_twice', options.fit_twice.toString());
        formData.append('wgs84', options.wgs84.toString());

        formData.append('use_obstacles', options.use_obstacles.toString());
        formData.append('use_high_obstacles', options.use_high_obstacles.toString());
        formData.append('use_transit_streets', options.use_transit_streets.toString());

        try {
            const response = await fetch('/api/generate-routes', {
                method: 'POST',
                body: formData,
            });

            if (!response.body) throw new Error('No response body');

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (!line.trim()) continue;
                    try {
                        const message = JSON.parse(line);
                        if (message.type === 'progress') {
                            setGenProgress(message.value);
                        } else if (message.type === 'result') {
                            setGenResult(message.data);
                            setViewMode('generated'); // Switch to generated view automatically
                            alert(t('wizard.successRoute'));
                        } else if (message.type === 'error') {
                            alert(t('wizard.errorRoute') + ': ' + message.message);
                        }
                    } catch (e) {
                        console.error('Error parsing JSON:', e);
                    }
                }
            }
        } catch (e) {
            console.error(e);
            alert(t('wizard.errorRoute'));
        } finally {
            setGenerating(false);
        }
    };

    const handleDownloadGenerated = async () => {
        if (!genResult || !genResult.download_links) return;

        const zip = new JSZip();
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const folderName = `generated_routes_${timestamp}`;
        const folder = zip.folder(folderName);

        if (!folder) return;

        try {
            const links = genResult.download_links;
            const filesToDownload = [
                { name: 'global_plan.csv', url: links.csv },
                { name: 'map.png', url: links.map_png },
                { name: 'map.yaml', url: links.map_yaml },
                { name: 'latlon.yaml', url: links.latlon_yaml }
            ];

            await Promise.all(filesToDownload.map(async (file) => {
                try {
                    const response = await fetch(file.url);
                    const blob = await response.blob();
                    folder.file(file.name, blob);
                } catch (e) {
                    console.error(`Error downloading ${file.name}:`, e);
                }
            }));

            const content = await zip.generateAsync({ type: 'blob' });
            saveAs(content, `routes-${timestamp}.zip`);
        } catch (e) {
            console.error('Error creating zip:', e);
            alert('Error creating zip file');
        }
    };

    const fetchGraphNodes = async () => {
        try {
            const response = await fetch('/api/graph-nodes');
            if (response.ok) {
                const data = await response.json();
                setPathNodes(data.nodes);
                // Set defaults if available
                const home = data.nodes.find((n: any) => n.label.includes('Home'));
                if (home) setPathStart(home.id.toString());
            }
        } catch (e) {
            console.error('Error fetching graph nodes:', e);
        }
    };

    // Fetch nodes when generation succeeds or result loaded
    if (viewMode === 'generated' && pathNodes.length === 0 && genResult) {
        fetchGraphNodes();
    }

    const handleCalculatePath = async () => {
        if (!pathStart || !pathEnd) {
            alert(t('Select start and end nodes'));
            return;
        }
        setPathLoading(true);
        try {
            const response = await fetch('/api/calculate-path', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ start_node: parseInt(pathStart), end_node: parseInt(pathEnd) })
            });
            const data = await response.json();
            if (data.status === 'success') {
                setCalculatedPath(data.path);
                setPathProgress(0);
                setPathRevision(prev => prev + 1);
                setCenterTrigger(prev => prev + 1);
            } else {
                alert('Path calculation failed: ' + data.message);
            }
        } catch (e) {
            console.error(e);
            alert('Error calculating path');
        } finally {
            setPathLoading(false);
        }
    };

    const handleTransfer = async (transferData: any) => {
        setIsTransferring(true);
        try {
            const response = await fetch('/api/transfer-files', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(transferData),
            });

            const data = await response.json();

            if (response.ok) {
                alert(t('Transfer successful!'));
                setShowTransferModal(false);
            } else {
                alert(`Transfer failed: ${data.message}`);
            }
        } catch (error) {
            console.error('Transfer error:', error);
            alert('Transfer failed due to network error.');
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
                // Show original context layers if they exist in genResult or data
                'objective': data['objective'],
                'geofence': data['geofence'],
                'home': data['home'],
                'obstacles': data['obstacles'],
                'high_obstacles': data['tall_obstacle'],
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
            <div className="sidebar">
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
                                        className="btn-download-all"
                                    >
                                        <Download className="w-4 h-4" /> {t('wizard.downloadAll')}
                                    </button>
                                    <button
                                        onClick={() => setShowTransferModal(true)}
                                        className="btn-transfer"
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
                                            <span>Robot Simulation</span>
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
                                                const last = calculatedPath[calculatedPath.length - 1];
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
                                            let nearest_id = -1;

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
                                                            if (props.graph_pose_local) {
                                                                const parts = JSON.parse(props.graph_pose_local);
                                                                px = parts[0]; py = parts[1]; pth = parts[2];
                                                            } else if (props.graph_pose) {
                                                                // Use whatever is there
                                                                const parts = typeof props.graph_pose === 'string' ? JSON.parse(props.graph_pose.replace(/'/g, '"')) : props.graph_pose;
                                                                px = parts[0]; py = parts[1]; pth = parts[2];
                                                            }
                                                        } catch (e) { continue; }

                                                        const d = Math.sqrt(Math.pow(px - rx, 2) + Math.pow(py - ry, 2));
                                                        if (d < min_dist) {
                                                            min_dist = d;
                                                            nearest_pose = { x: px, y: py, theta: pth };
                                                            nearest_id = props.graph_id;
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

                {/* Options Section */}
                <div className="mt-4 bg-white p-4 rounded-lg border border-slate-200 shadow-sm shrink-0">
                    <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                        <Settings className="w-4 h-4" /> {t('routeGenerator.options.title')}
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
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
