import React, { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Upload, Map, Settings, Download, Trash2, X } from 'lucide-react';
import MapComponent from './MapComponent';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

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
        download_links: { [key: string]: string };
    } | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handleBulkUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files) return;

        const newFiles = { ...files };
        Array.from(e.target.files).forEach(file => {
            const name = file.name.toLowerCase();
            if (name.includes('geofence')) newFiles.geofence = file;
            else if (name.includes('home')) newFiles.home_pose = file;
            else if (name.includes('transit')) newFiles.transit_streets = file;
            else if (name.includes('streets')) newFiles.streets = file;
            else if (name.includes('high') && name.includes('obstacle')) newFiles.high_obstacles = file;
            else if (name.includes('obstacle')) newFiles.obstacles = file;
            else if (name.endsWith('.hol') || name.endsWith('.csv')) newFiles.holes = file;
        });
        setFiles(newFiles);
    };

    const handleFileChange = (name: string, file: File | null) => {
        setFiles(prev => ({ ...prev, [name]: file }));
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

        try {
            const response = await fetch('/api/generate-routes', {
                method: 'POST',
                body: formData,
            });

            if (!response.body) {
                throw new Error('No response body');
            }

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
                            setProgress(message.value);
                        } else if (message.type === 'result') {
                            setResult(message.data);
                        } else if (message.type === 'error') {
                            setError(message.message);
                        }
                    } catch (e) {
                        console.error('Error parsing JSON:', e);
                    }
                }
            }

        } catch (err) {
            setError(t('routeGenerator.connectionError'));
            console.error(err);
        } finally {
            setLoading(false);
        }
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

    return (
        <div className="p-6 max-w-4xl mx-auto bg-white rounded-xl shadow-md space-y-6">
            <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                <Map className="w-6 h-6" />
                {t('routeGenerator.title')}
            </h2>

            <div className="p-6 border-2 border-dashed border-blue-300 rounded-xl bg-blue-50 text-center space-y-2 hover:bg-blue-100 transition-colors">
                <Upload className="w-12 h-12 text-blue-500 mx-auto" />
                <h3 className="text-lg font-semibold text-blue-700">{t('routeGenerator.bulkUpload.title')}</h3>
                <p className="text-sm text-blue-600">
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
                <div className="flex justify-center gap-4">
                    <label
                        htmlFor="bulk-upload"
                        className="inline-block px-4 py-2 bg-blue-600 text-white rounded-lg cursor-pointer hover:bg-blue-700 transition-colors"
                    >
                        {t('routeGenerator.bulkUpload.selectFiles')}
                    </label>
                    <label
                        htmlFor="folder-upload"
                        className="inline-block px-4 py-2 bg-green-600 text-white rounded-lg cursor-pointer hover:bg-green-700 transition-colors"
                    >
                        {t('routeGenerator.bulkUpload.selectFolder')}
                    </label>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

                <div className="p-4 bg-gray-50 rounded-lg space-y-2">
                    <h3 className="font-semibold text-gray-700 flex items-center gap-2">
                        <Settings className="w-4 h-4" /> {t('routeGenerator.options.title')}
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                        <Checkbox name="fit_streets" label={t('routeGenerator.options.fitStreets')} defaultChecked />
                        <Checkbox name="fit_twice" label={t('routeGenerator.options.fitTwice')} defaultChecked />
                        <Checkbox name="wgs84" label={t('routeGenerator.options.wgs84')} defaultChecked />
                        <Checkbox name="use_obstacles" label={t('routeGenerator.options.useObstacles')} />
                        <Checkbox name="use_high_obstacles" label={t('routeGenerator.options.useHighObstacles')} />
                        <Checkbox name="use_transit_streets" label={t('routeGenerator.options.useTransitStreets')} />
                    </div>
                </div>

                <div className="space-y-2">
                    {loading && (
                        <div className="w-full bg-gray-200 rounded-full h-2.5">
                            <div
                                className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                                style={{ width: `${progress}%` }}
                            ></div>
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2"
                    >
                        {loading ? t('routeGenerator.generating', { progress: Math.round(progress) }) : t('routeGenerator.generate')}
                    </button>
                </div>
            </form>

            {error && (
                <div className="p-4 bg-red-50 text-red-700 rounded-lg border border-red-200">
                    <strong>{t('routeGenerator.error')}:</strong> {error}
                </div>
            )}

            {result && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {result.arrow_geojson && (
                        <div className="h-[600px] border rounded-lg overflow-hidden shadow-sm">
                            <MapComponent
                                currentStepKey="routes"
                                drawMode="none"
                                existingData={{
                                    routes: result.arrow_geojson,
                                    holes: parseGeoJSON(result.holes_geojson),
                                    geofence: parseGeoJSON(result.geofence_geojson),
                                    streets: parseGeoJSON(result.streets_geojson),
                                    home: parseGeoJSON(result.home_pose_geojson),
                                    obstacles: parseGeoJSON(result.obstacles_geojson),
                                    high_obstacles: parseGeoJSON(result.high_obstacles_geojson),
                                    transit_streets: parseGeoJSON(result.transit_streets_geojson),
                                }}
                                onUpdate={() => { }}
                                centerTrigger={Date.now()}
                            />
                        </div>
                    )}

                    <div className="flex gap-4">
                        <button
                            onClick={handleDownloadAll}
                            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-slate-800 text-white font-medium rounded-lg hover:bg-slate-900 transition-colors shadow-md"
                        >
                            <Download className="w-4 h-4" /> {t('routeGenerator.downloadAll')}
                        </button>
                        <button
                            onClick={handleClearResults}
                            className="flex-none flex items-center justify-center gap-2 px-4 py-2 bg-red-100 text-red-700 font-medium rounded-lg hover:bg-red-200 transition-colors border border-red-200"
                        >
                            <Trash2 className="w-4 h-4" /> {t('routeGenerator.clearResults')}
                        </button>
                    </div>


                </div>
            )}
        </div>
    );
}

function parseGeoJSON(jsonString: string | undefined | null) {
    if (!jsonString) return null;
    try {
        return JSON.parse(jsonString);
    } catch (e) {
        console.error("Failed to parse GeoJSON", e);
        return null;
    }
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
        <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">
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
                    className="block w-full text-sm text-gray-500
              file:mr-4 file:py-2 file:px-4
              file:rounded-full file:border-0
              file:text-sm file:font-semibold
              file:bg-blue-50 file:text-blue-700
              hover:file:bg-blue-100
              border border-gray-300 rounded-lg cursor-pointer"
                />
                {file && (
                    <div className="absolute top-0 right-0 h-full flex items-center pr-2">
                        <span className="text-xs text-green-600 font-medium bg-green-50 px-2 py-1 rounded-full border border-green-200 mr-2">
                            {file.name}
                        </span>
                        <button
                            onClick={handleClear}
                            className="pointer-events-auto p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
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
        <label className="flex items-center space-x-2 cursor-pointer">
            <input type="checkbox" name={name} value="true" defaultChecked={defaultChecked} className="rounded text-blue-600 focus:ring-blue-500" />
            <span className="text-sm text-gray-700">{label}</span>
        </label>
    )
}


