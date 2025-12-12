import React, { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Upload, Settings, Download, Trash2, Map, Send } from 'lucide-react';
import MapComponent from './MapComponent';
import TransferModal from './TransferModal';
import proj4 from 'proj4';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { enrichGeoJSONWithUTM } from '../utils/utm';
import { parseHolFile, UTM_ZONE_19S, WGS84 } from '../utils/holParser';

import '../styles/components/RouteGenerator.css';
import { generateRoutes } from '../routes/generateRoutes';
import { transferFiles } from '../routes/transferFiles';

export default function RouteGenerator() {
    const { t } = useTranslation();
    const [files, setFiles] = useState<Record<string, File | null>>({
        holes: null,
        geofence: null,
        streets: null,
        home_pose: null,
        obstacles: null,
        high_obstacles: null,
        transit_streets: null,
    });
    const [loading, setLoading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [result, setResult] = useState<{
        map_image: string;
        arrow_geojson?: any;
        holes_geojson?: string;
        geofence_geojson?: string;
        streets_geojson?: string;
        home_pose_geojson?: string;
        obstacles_geojson?: string;
        high_obstacles_geojson?: string;
        transit_streets_geojson?: string;
        fitted_streets_geojson?: string;
        fitted_transit_streets_geojson?: string;
        global_plan_data?: any[];
        download_links: { [key: string]: string };
    } | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Map Preview State
    const [previewData, setPreviewData] = useState<Record<string, any>>({});
    const [viewMode, setViewMode] = useState<'raw' | 'generated'>('raw');
    const [centerTrigger, setCenterTrigger] = useState(0);
    const [showTable, setShowTable] = useState(false);
    const [showTransferModal, setShowTransferModal] = useState(false);
    const [isTransferring, setIsTransferring] = useState(false);

    const readFile = (file: File, key: string) => {
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

                // Map keys to match MapComponent expectations
                let mapKey = key;
                if (key === 'holes') mapKey = 'objective';
                if (key === 'home_pose') mapKey = 'home';

                setPreviewData(prev => ({ ...prev, [mapKey]: enriched }));
                setCenterTrigger(prev => prev + 1);
            } catch (err) {
                console.error(`Error parsing ${file.name}`, err);
            }
        };
        reader.readAsText(file);
    };

    const handleBulkUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files) return;

        const newFiles = { ...files };
        Array.from(e.target.files).forEach(file => {
            const name = file.name.toLowerCase();
            let key: keyof typeof files | null = null;

            if (name.includes('geofence')) key = 'geofence';
            else if (name.includes('home')) key = 'home_pose';
            else if (name.includes('transit')) key = 'transit_streets';
            else if (name.includes('streets')) key = 'streets';
            else if (name.includes('high') && name.includes('obstacle')) key = 'high_obstacles';
            else if (name.includes('obstacle')) key = 'obstacles';
            else if (name.endsWith('.hol') || name.endsWith('.csv')) key = 'holes';

            if (key) {
                newFiles[key] = file;
                readFile(file, key);
            }
        });
        setFiles(newFiles);
    };

    const handleLoadResultFile = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const content = event.target?.result as string;
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
                                let coordsStr = row.graph_pose;
                                let isGlobal = true;
                                if (!coordsStr || coordsStr === 'nan') {
                                    coordsStr = row.graph_pose_local;
                                    isGlobal = false;
                                }
                                if (coordsStr) {
                                    // Clean up string: remove quotes if present, handle [x, y, z]
                                    coordsStr = coordsStr.replace(/^"|"$/g, '').replace(/'/g, '"');
                                    const coords = JSON.parse(coordsStr);
                                    if (Array.isArray(coords) && coords.length >= 2) {
                                        let [lon, lat] = [coords[0], coords[1]];
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
                                // Handle potential "nan" or empty
                                if (connsStr && connsStr !== 'nan' && connsStr !== '[]') {
                                    // Simple array parse might fail if it's not valid JSON, e.g. [1, 2]
                                    // Let's try to parse it as JSON
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

                    setPreviewData(prev => ({
                        ...prev,
                        global_plan_points: { type: 'FeatureCollection', features: pointsFeatures },
                        routes: { type: 'FeatureCollection', features: lineFeatures }
                    }));
                    setCenterTrigger(prev => prev + 1);

                } else if (file.name.endsWith('.json') || file.name.endsWith('.geojson')) {
                    const parsed = JSON.parse(content);
                    // Assume it's a feature collection, try to guess type or just put it as 'routes' for now if generic
                    // Or ask user? For now, let's assume it might be the arrow_geojson or similar
                    setPreviewData(prev => ({ ...prev, routes: parsed }));
                    setCenterTrigger(prev => prev + 1);
                }
            } catch (err) {
                console.error('Error parsing file', err);
                alert('Error parsing file');
            }
        };
        reader.readAsText(file);
    };

    const handleFileChange = (name: string, file: File | null) => {
        setFiles(prev => ({ ...prev, [name]: file }));
        if (file) {
            readFile(file, name);
        } else {
            setPreviewData(prev => {
                const newData = { ...prev };
                // Remove the corresponding map key
                let mapKey = name;
                if (name === 'holes') mapKey = 'objective';
                if (name === 'home_pose') mapKey = 'home';
                delete newData[mapKey];
                return newData;
            });
        }
    };

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setLoading(true);
        setProgress(0);
        setError(null);
        setResult(null);

        const formData = new FormData(e.currentTarget);

        // Append files from state if they exist (overriding form data if needed, though FileInput is now controlled)
        Object.entries(files).forEach(([key, file]) => {
            if (file) {
                formData.set(key, file);
            }
        });

        const options = {
            fit_streets: true, // Hardcoded or from state if you add state for options in RouteGenerator
            fit_twice: true,
            wgs84: true,
            use_obstacles: true, // Defaulting based on typical usage or add inputs
            use_high_obstacles: true,
            use_transit_streets: true
        };

        generateRoutes(files, previewData, options, (message: any) => {
            if (message.type === 'progress') {
                setProgress(message.value);
            } else if (message.type === 'result') {
                setResult(message.data);
                setViewMode('generated');
            } else if (message.type === 'error') {
                setError(message.message);
            }
        }).finally(() => {
            setLoading(false);
        });
    };

    const handleClearResults = () => {
        if (confirm(t('routeGenerator.confirmClear'))) {
            setResult(null);
            setError(null);
            setProgress(0);
        }
    };

    const handleDownloadAll = async () => {
        if (!result) return;

        const zip = new JSZip();
        const now = new Date();
        const timestamp = now.toISOString().replace(/[:.]/g, '-').split('T')[0] + '_' + now.toTimeString().split(' ')[0].replace(/:/g, '');
        const folderName = `route_results_${timestamp}`;
        const folder = zip.folder(folderName);

        if (!folder) return;

        // Helper to fetch and add file to zip
        const addFileToZip = async (url: string, filename: string) => {
            try {
                const response = await fetch(url);
                const blob = await response.blob();
                folder.file(filename, blob);
            } catch (error) {
                console.error(`Failed to download ${filename}`, error);
            }
        };

        const promises = [];
        if (result.download_links.csv) promises.push(addFileToZip(result.download_links.csv, 'global_plan.csv'));
        if (result.download_links.map_png) promises.push(addFileToZip(result.download_links.map_png, 'map.png'));
        if (result.download_links.map_yaml) promises.push(addFileToZip(result.download_links.map_yaml, 'maze_peld.yaml'));
        if (result.download_links.latlon_yaml) promises.push(addFileToZip(result.download_links.latlon_yaml, 'latlon.yaml'));

        await Promise.all(promises);

        const content = await zip.generateAsync({ type: 'blob' });
        saveAs(content, `route_results_${timestamp}.zip`);
    };

    const handleTransfer = async (transferData: any) => {
        setIsTransferring(true);
        try {
            await transferFiles(transferData);
            alert(t('Transfer successful!'));
            setShowTransferModal(false);
        } catch (error: any) {
            console.error('Transfer error:', error);
            alert(`Transfer failed: ${error.message}`);
        } finally {
            setIsTransferring(false);
        }
    };

    return (
        <div className="route-gen-container">
            <h2 className="route-gen-title">
                <Map className="w-6 h-6" />
                {t('routeGenerator.title')}
            </h2>

            <div className="bulk-upload-area">
                <Upload className="w-12 h-12 text-blue-500 mx-auto" />
                <h3 className="bulk-upload-title">{t('routeGenerator.bulkUpload.title')}</h3>
                <p className="bulk-upload-desc">
                    {t('routeGenerator.bulkUpload.description')}
                </p>
                <input
                    type="file"
                    multiple
                    onChange={handleBulkUpload}
                    className="hidden"
                    id="bulk-upload"
                />
                <input
                    type="file"
                    // @ts-ignore
                    webkitdirectory=""
                    directory=""
                    multiple
                    onChange={handleBulkUpload}
                    className="hidden"
                    id="folder-upload"
                />
                <div className="bulk-upload-buttons">
                    <label
                        htmlFor="bulk-upload"
                        className="btn-select-files"
                    >
                        {t('routeGenerator.bulkUpload.selectFiles')}
                    </label>
                    <label
                        htmlFor="folder-upload"
                        className="btn-select-folder"
                    >
                        {t('routeGenerator.bulkUpload.selectFolder')}
                    </label>
                </div>
            </div>

            {/* Map Preview Section */}
            <div className="mb-6 flex justify-between items-center">
                <h3 className="text-lg font-semibold text-slate-700">Map Preview</h3>
                <div className="flex gap-2">
                    <input
                        type="file"
                        accept=".csv,.json,.geojson"
                        onChange={handleLoadResultFile}
                        className="hidden"
                        id="load-result-file"
                    />
                    <label
                        htmlFor="load-result-file"
                        className="px-3 py-1.5 text-sm font-medium rounded-md bg-white text-blue-600 border border-blue-200 shadow-sm hover:bg-blue-50 cursor-pointer flex items-center gap-2 transition-all"
                    >
                        <Upload className="w-4 h-4" /> Load Result File
                    </label>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="file-inputs-grid">
                    <FileInput
                        name="holes"
                        label={t('routeGenerator.files.holes')}
                        required
                        file={files.holes}
                        onChange={(f) => handleFileChange('holes', f)}
                        onClear={() => handleFileChange('holes', null)}
                    />
                    <FileInput
                        name="geofence"
                        label={t('routeGenerator.files.geofence')}
                        required
                        file={files.geofence}
                        onChange={(f) => handleFileChange('geofence', f)}
                        onClear={() => handleFileChange('geofence', null)}
                    />
                    <FileInput
                        name="streets"
                        label={t('routeGenerator.files.streets')}
                        required
                        file={files.streets}
                        onChange={(f) => handleFileChange('streets', f)}
                        onClear={() => handleFileChange('streets', null)}
                    />
                    <FileInput
                        name="home_pose"
                        label={t('routeGenerator.files.home')}
                        required
                        file={files.home_pose}
                        onChange={(f) => handleFileChange('home_pose', f)}
                        onClear={() => handleFileChange('home_pose', null)}
                    />

                    <FileInput
                        name="obstacles"
                        label={t('routeGenerator.files.obstacles')}
                        file={files.obstacles}
                        onChange={(f) => handleFileChange('obstacles', f)}
                        onClear={() => handleFileChange('obstacles', null)}
                    />
                    <FileInput
                        name="high_obstacles"
                        label={t('routeGenerator.files.highObstacles')}
                        file={files.high_obstacles}
                        onChange={(f) => handleFileChange('high_obstacles', f)}
                        onClear={() => handleFileChange('high_obstacles', null)}
                    />
                    <FileInput
                        name="transit_streets"
                        label={t('routeGenerator.files.transitStreets')}
                        file={files.transit_streets}
                        onChange={(f) => handleFileChange('transit_streets', f)}
                        onClear={() => handleFileChange('transit_streets', null)}
                    />
                </div>

                <div className="options-section">
                    <h3 className="options-title">
                        <Settings className="w-4 h-4" /> {t('routeGenerator.options.title')}
                    </h3>
                    <div className="options-grid">
                        <Checkbox name="fit_streets" label={t('routeGenerator.options.fitStreets')} defaultChecked />
                        <Checkbox name="fit_twice" label={t('routeGenerator.options.fitTwice')} defaultChecked />
                        <Checkbox name="wgs84" label={t('routeGenerator.options.wgs84')} defaultChecked />
                        <Checkbox name="use_obstacles" label={t('routeGenerator.options.useObstacles')} />
                        <Checkbox name="use_high_obstacles" label={t('routeGenerator.options.useHighObstacles')} />
                        <Checkbox name="use_transit_streets" label={t('routeGenerator.options.useTransitStreets')} />
                    </div>
                </div>


                <div className="h-[400px] w-full rounded-lg overflow-hidden border border-slate-200 shadow-sm relative">
                    {result && (
                        <div className="absolute top-4 right-4 z-[1000] bg-white/90 backdrop-blur-sm shadow-md rounded-lg p-1 flex">
                            <button
                                onClick={() => setViewMode('raw')}
                                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${viewMode === 'raw'
                                    ? 'bg-white text-blue-600 shadow-sm'
                                    : 'text-slate-500 hover:text-slate-700'
                                    }`}
                            >
                                {t('wizard.rawMode') || 'Raw Input'}
                            </button>
                            <button
                                onClick={() => setViewMode('generated')}
                                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${viewMode === 'generated'
                                    ? 'bg-white text-green-600 shadow-sm'
                                    : 'text-slate-500 hover:text-slate-700'
                                    }`}
                            >
                                {t('wizard.generatedMode') || 'Generated'}
                            </button>
                        </div>
                    )}
                    <MapComponent
                        currentStepKey="preview"
                        drawMode="none"
                        existingData={viewMode === 'generated' && result ? {
                            routes: result.arrow_geojson,
                            fitted_streets: result.fitted_streets_geojson ? JSON.parse(result.fitted_streets_geojson) : null,
                            fitted_transit_streets: result.fitted_transit_streets_geojson ? JSON.parse(result.fitted_transit_streets_geojson) : null,
                            objective: previewData['objective'],
                            geofence: previewData['geofence'],
                            streets: previewData['streets'],
                            home: previewData['home'],
                            obstacles: previewData['obstacles'],
                            high_obstacles: previewData['high_obstacles'],
                            transit_streets: previewData['transit_streets'],
                            global_plan_points: (() => {
                                if (!result.global_plan_data) return null;
                                const features = result.global_plan_data
                                    .filter((row: any) => row.type === 'graph_pose')
                                    .map((row: any) => {
                                        try {
                                            let coords = row.graph_pose;
                                            let isGlobal = true;
                                            if (!coords || coords === 'nan') {
                                                coords = row.graph_pose_local;
                                                isGlobal = false;
                                            }

                                            if (typeof coords === 'string') {
                                                // Handle string representation of list "[x, y, z]"
                                                coords = JSON.parse(coords.replace(/'/g, '"'));
                                            }
                                            if (Array.isArray(coords) && coords.length >= 2) {
                                                let [lon, lat] = [coords[0], coords[1]];
                                                if (isGlobal) {
                                                    [lon, lat] = proj4(UTM_ZONE_19S, WGS84, [coords[0], coords[1]]);
                                                }
                                                return {
                                                    type: 'Feature',
                                                    geometry: {
                                                        type: 'Point',
                                                        coordinates: [lon, lat]
                                                    },
                                                    properties: row
                                                };
                                            }
                                        } catch (e) {
                                            console.warn('Failed to parse pose', row);
                                        }
                                        return null;
                                    })
                                    .filter(Boolean);
                                return { type: 'FeatureCollection', features };
                            })()
                        } : previewData}
                        onUpdate={() => { }}
                        centerTrigger={centerTrigger}
                    />
                </div>

                <div className="space-y-2">
                    {loading && (
                        <div className="progress-bar-container">
                            <div
                                className="progress-bar-fill"
                                style={{ width: `${progress}%` }}
                            ></div>
                        </div>
                    )}

                    <div className="flex gap-2">
                        <button
                            type="submit"
                            disabled={loading}
                            className="btn-generate flex-1"
                        >
                            {loading ? t('routeGenerator.generating', { progress: Math.round(progress) }) : t('routeGenerator.generate')}
                        </button>
                        <button
                            type="button"
                            disabled={!result || loading}
                            onClick={() => setShowTransferModal(true)}
                            className="px-6 py-2 rounded-md font-medium text-white transition-all flex items-center gap-2 justify-center disabled:opacity-50 disabled:cursor-not-allowed bg-indigo-600 hover:bg-indigo-700 shadow-sm"
                        >
                            <Send className="w-5 h-5" />
                            Transfer
                        </button>
                    </div>
                </div>
            </form>

            {error && (
                <div className="error-box">
                    <strong>{t('routeGenerator.error')}:</strong> {error}
                </div>
            )}

            <TransferModal
                isOpen={showTransferModal}
                onClose={() => setShowTransferModal(false)}
                onTransfer={handleTransfer}
                isTransferring={isTransferring}
                availableFiles={['global_plan.csv', 'map.png', 'maze_peld.yaml', 'latlon.yaml']}
            />

            {result && (
                <div className="result-container">
                    {/* Map removed from here, now displayed above */}

                    <div className="action-buttons">
                        <button
                            onClick={() => setShowTable(!showTable)}
                            className="btn-view-data"
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                padding: '0.5rem 1rem',
                                backgroundColor: '#f8fafc',
                                border: '1px solid #e2e8f0',
                                borderRadius: '0.375rem',
                                color: '#475569',
                                fontWeight: 500,
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                            }}
                        >
                            <Settings className="w-4 h-4" /> {showTable ? 'Hide Data' : 'View Data'}
                        </button>
                        <button
                            onClick={handleDownloadAll}
                            className="btn-download"
                        >
                            <Download className="w-4 h-4" /> {t('routeGenerator.downloadAll')}
                        </button>
                        <button
                            onClick={handleClearResults}
                            className="btn-clear"
                        >
                            <Trash2 className="w-4 h-4" /> {t('routeGenerator.clearResults')}
                        </button>
                    </div>

                    {showTable && result.global_plan_data && (
                        <div className="mt-6 border border-slate-200 rounded-lg overflow-hidden shadow-sm">
                            <div className="overflow-x-auto max-h-[500px]">
                                <table className="min-w-full divide-y divide-slate-200">
                                    <thead className="bg-slate-50 sticky top-0 z-10">
                                        <tr>
                                            {Object.keys(result.global_plan_data[0] || {}).map((key) => (
                                                <th
                                                    key={key}
                                                    scope="col"
                                                    className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider whitespace-nowrap bg-slate-50"
                                                >
                                                    {key}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-slate-200">
                                        {result.global_plan_data.map((row: any, idx: number) => (
                                            <tr key={idx} className="hover:bg-slate-50">
                                                {Object.values(row).map((val: any, i: number) => (
                                                    <td
                                                        key={i}
                                                        className="px-6 py-4 whitespace-nowrap text-sm text-slate-500"
                                                    >
                                                        {typeof val === 'object' ? JSON.stringify(val) : String(val)}
                                                    </td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <div className="bg-slate-50 px-6 py-3 border-t border-slate-200 text-sm text-slate-500">
                                Showing {result.global_plan_data.length} records
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}



function FileInput({
    name,
    label,
    required,
    file,
    onChange,
    onClear
}: {
    name: string;
    label: string;
    required?: boolean;
    file: File | null;
    onChange: (file: File | null) => void;
    onClear: () => void;
}) {
    const inputRef = useRef<HTMLInputElement>(null);

    const handleClear = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (inputRef.current) {
            inputRef.current.value = '';
        }
        onClear();
    };

    return (
        <div className="file-input-wrapper">
            <label className="file-input-label">
                {label} {required && <span className="text-red-500">*</span>}
            </label>
            <div className="relative">
                <input
                    ref={inputRef}
                    type="file"
                    name={name}
                    required={required && !file} // Only required if no file is selected in state
                    onChange={(e) => {
                        const f = e.target.files ? e.target.files[0] : null;
                        onChange(f);
                    }}
                    className="file-input-field"
                />
                {file && (
                    <div className="file-status-wrapper">
                        <span className="file-name-badge">
                            {file.name}
                        </span>
                        <button
                            onClick={handleClear}
                            className="btn-clear-file"
                            title="Clear file"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

function Checkbox({ name, label, defaultChecked }: { name: string; label: string; defaultChecked?: boolean }) {
    return (
        <label className="checkbox-label">
            <input type="checkbox" name={name} value="true" defaultChecked={defaultChecked} className="checkbox-input" />
            <span className="checkbox-text">{label}</span>
        </label>
    )
}
