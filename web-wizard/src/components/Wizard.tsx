import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { WIZARD_STEPS } from '../types';
import MapComponent from './MapComponent';
import { enrichGeoJSONWithUTM } from '../utils/utm';
import { saveAs } from 'file-saver';
import JSZip from 'jszip';
import { ArrowRight, ArrowLeft, Save, CheckCircle, Trash2, Upload, Download, Folder, Play, X } from 'lucide-react';
import { parseHolFile } from '../utils/holParser';

const Wizard = () => {
    const { t } = useTranslation();
    const [currentStepIndex, setCurrentStepIndex] = useState(0);
    const [data, setData] = useState<Record<string, any>>({});
    const [currentStepData, setCurrentStepData] = useState<any>(null);
    const [centerTrigger, setCenterTrigger] = useState(0);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const folderInputRef = useRef<HTMLInputElement>(null);

    const [generating, setGenerating] = useState(false);
    const [genProgress, setGenProgress] = useState(0);
    const [genResult, setGenResult] = useState<any>(null);
    const [showGenModal, setShowGenModal] = useState(false);

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
            window.location.reload();
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
            const newData = { ...data };
            let loadedCount = 0;
            results.forEach(result => {
                if (result) {
                    newData[result.key] = result.data;
                    loadedCount++;
                }
            });
            setData(newData);
            if (loadedCount > 0) {
                setCenterTrigger(prev => prev + 1);
                alert(`Loaded ${loadedCount} files from folder.`);
            } else {
                alert('No matching files found in folder.');
            }
        });

        if (folderInputRef.current) folderInputRef.current.value = '';
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
            'tall_obstacle': 'tall_obstacles.geojson'
        };

        // Add all steps to zip
        WIZARD_STEPS.forEach(step => {
            const stepData = data[step.key];
            if (stepData) {
                const filename = FILE_NAME_MAPPING[step.key] || `${step.key}.geojson`;
                folder.file(filename, JSON.stringify(stepData, null, 4));
            }
        });

        // Also add current step data if not saved yet
        if (currentStepData && currentStepData.features && currentStepData.features.length > 0) {
            const enriched = enrichGeoJSONWithUTM(currentStepData);
            const filename = FILE_NAME_MAPPING[currentStep.key] || `${currentStep.key}.geojson`;
            folder.file(filename, JSON.stringify(enriched, null, 4));
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
        formData.append('fit_streets', 'true');
        formData.append('fit_twice', 'true');
        formData.append('wgs84', 'true'); // Backend handles GeoJSON by converting to UTM internally, so we treat the result as UTM (WGS84=True)

        formData.append('use_obstacles', allData['obstacles'] ? 'true' : 'false');
        formData.append('use_high_obstacles', allData['tall_obstacle'] ? 'true' : 'false');
        formData.append('use_transit_streets', allData['transit_road'] ? 'true' : 'false');

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
                            // setShowGenModal(true); // Disabled as per user request
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

    return (
        <div className="flex h-screen w-full bg-slate-50">
            {/* Sidebar */}
            <div className="w-80 bg-white border-r border-slate-200 flex flex-col shadow-lg z-10">
                <div className="p-6 border-b border-slate-100">
                    <h1 className="text-2xl font-bold text-slate-800 bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                        {t('wizard.title')}
                    </h1>
                    <p className="text-sm text-slate-500 mt-1">{t('wizard.subtitle')}</p>

                    <div className="flex gap-2 mt-4">
                        <button
                            onClick={handleClearAll}
                            className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded border border-red-200 transition-colors"
                            title="Delete all figures"
                        >
                            <Trash2 className="w-3 h-3" /> {t('wizard.clearAll')}
                        </button>
                        <button
                            onClick={handleCenterMap}
                            className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded border border-blue-200 transition-colors"
                            title="Center map on data"
                        >
                            <Upload className="w-3 h-3 rotate-90" /> {t('wizard.centerMap')}
                        </button>
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs font-medium text-slate-600 bg-slate-50 hover:bg-slate-100 rounded border border-slate-200 transition-colors"
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
                            className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs font-medium text-slate-600 bg-slate-50 hover:bg-slate-100 rounded border border-slate-200 transition-colors"
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
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {steps.map((step, index) => {
                        const isActive = index === currentStepIndex;
                        const hasData = !!data[step.key];

                        return (
                            <div
                                key={step.key}
                                onClick={() => handleStepClick(index)}
                                className={`p-4 rounded-lg border transition-all duration-200 cursor-pointer hover:shadow-md ${isActive
                                    ? 'bg-blue-50 border-blue-200 shadow-sm ring-1 ring-blue-200'
                                    : hasData
                                        ? 'bg-green-50/50 border-green-200'
                                        : 'bg-white border-slate-100 opacity-70 hover:opacity-100'
                                    }`}
                            >
                                <div className="flex items-center justify-between mb-2">
                                    <span className={`text-sm font-bold uppercase tracking-wider ${isActive ? 'text-blue-600' : 'text-slate-500'
                                        }`}>
                                        {t('wizard.step')} {index + 1}
                                    </span>
                                    {hasData && (
                                        <div className="flex items-center gap-2">
                                            <CheckCircle className="w-4 h-4 text-green-500" />
                                            <button
                                                onClick={(e) => handleClearStep(step.key, e)}
                                                className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                                                title="Clear step data"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    )}
                                </div>
                                <h3 className={`font-semibold text-lg ${isActive ? 'text-slate-800' : 'text-slate-600'}`}>
                                    {step.label}
                                </h3>
                                <p className="text-sm text-slate-500 mt-1 leading-relaxed">
                                    {step.description}
                                </p>
                            </div>
                        );
                    })}
                </div>

                <div className="p-6 border-t border-slate-100 bg-slate-50">
                    <div className="flex flex-col gap-3">
                        <div className="flex gap-3">
                            <button
                                onClick={handlePrev}
                                disabled={currentStepIndex === 0}
                                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-slate-300 text-slate-700 font-medium hover:bg-white hover:shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                            >
                                <ArrowLeft className="w-4 h-4" />
                                {t('wizard.back')}
                            </button>
                            <button
                                onClick={handleNext}
                                disabled={isLastStep}
                                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                            >
                                {t('wizard.next')}
                                <ArrowRight className="w-4 h-4" />
                            </button>
                        </div>
                        <button
                            onClick={handleSaveAll}
                            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-slate-800 text-white font-medium hover:bg-slate-900 shadow-md hover:shadow-lg transition-all"
                        >
                            <Download className="w-4 h-4" /> {t('wizard.downloadAll')}
                        </button>
                        <button
                            onClick={handleGenerateRoute}
                            disabled={generating}
                            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-green-600 text-white font-medium hover:bg-green-700 shadow-md hover:shadow-lg transition-all disabled:opacity-50"
                        >
                            {generating ? t('wizard.generating', { progress: Math.round(genProgress) }) : <><Play className="w-4 h-4" /> {t('wizard.generateRoute')}</>}
                        </button>
                        <button
                            onClick={handleDownloadGenerated}
                            disabled={!genResult}
                            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700 shadow-md hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Download generated route files"
                        >
                            <Download className="w-4 h-4" /> {t('wizard.downloadRoutes')}
                        </button>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 relative">
                <div className="absolute inset-0 p-4">
                    <MapComponent
                        // key={currentStep.key} // REMOVED: Do not remount map on step change
                        currentStepKey={currentStep.key}
                        drawMode={currentStep.drawMode}
                        existingData={data}
                        onUpdate={handleMapUpdate}
                        centerTrigger={centerTrigger}
                    />
                </div>

                {/* Floating Info */}
                <div className="absolute top-6 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur-sm px-6 py-3 rounded-full shadow-lg border border-slate-200 z-[1000] pointer-events-none">
                    <p className="text-slate-700 font-medium flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
                        Drawing: <span className="font-bold text-slate-900">{currentStep.label}</span>
                    </p>
                </div>
            </div>
            {/* Result Modal */}
            {
                showGenModal && genResult && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[2000] p-4">
                        <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto flex flex-col">
                            <div className="p-4 border-b flex justify-between items-center sticky top-0 bg-white z-10">
                                <h2 className="text-xl font-bold text-gray-800">Route Generation Result</h2>
                                <button onClick={() => setShowGenModal(false)} className="p-1 hover:bg-gray-100 rounded-full">
                                    <X className="w-6 h-6 text-gray-500" />
                                </button>
                            </div>
                            <div className="p-6 space-y-6">
                                <div className="border rounded-lg overflow-hidden shadow-sm">
                                    <img src={genResult.map_image} alt="Generated Map" className="w-full h-auto" />
                                </div>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    <a href={genResult.download_links.csv} download className="flex flex-col items-center justify-center p-4 bg-gray-50 hover:bg-gray-100 rounded-lg border border-gray-200 transition-colors text-center gap-2 group">
                                        <Download className="w-6 h-6 text-gray-500 group-hover:text-blue-600" />
                                        <span className="text-sm font-medium text-gray-700 group-hover:text-blue-700">Global Plan (CSV)</span>
                                    </a>
                                    <a href={genResult.download_links.map_png} download className="flex flex-col items-center justify-center p-4 bg-gray-50 hover:bg-gray-100 rounded-lg border border-gray-200 transition-colors text-center gap-2 group">
                                        <Download className="w-6 h-6 text-gray-500 group-hover:text-blue-600" />
                                        <span className="text-sm font-medium text-gray-700 group-hover:text-blue-700">Map Image (PNG)</span>
                                    </a>
                                    <a href={genResult.download_links.map_yaml} download className="flex flex-col items-center justify-center p-4 bg-gray-50 hover:bg-gray-100 rounded-lg border border-gray-200 transition-colors text-center gap-2 group">
                                        <Download className="w-6 h-6 text-gray-500 group-hover:text-blue-600" />
                                        <span className="text-sm font-medium text-gray-700 group-hover:text-blue-700">Map Config (YAML)</span>
                                    </a>
                                    <a href={genResult.download_links.latlon_yaml} download className="flex flex-col items-center justify-center p-4 bg-gray-50 hover:bg-gray-100 rounded-lg border border-gray-200 transition-colors text-center gap-2 group">
                                        <Download className="w-6 h-6 text-gray-500 group-hover:text-blue-600" />
                                        <span className="text-sm font-medium text-gray-700 group-hover:text-blue-700">LatLon Config (YAML)</span>
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
