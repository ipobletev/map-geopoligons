import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { WIZARD_STEPS } from '../types';
import MapComponent from './MapComponent';
import { enrichGeoJSONWithUTM } from '../utils/utm';
import { saveAs } from 'file-saver';
import JSZip from 'jszip';
import { ArrowRight, ArrowLeft, CheckCircle, Trash2, Upload, Download, Folder, Play, X } from 'lucide-react';
import { parseHolFile } from '../utils/holParser';
import '../../styles/components/Wizard.css';

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
        <div className="wizard-container">
            {/* Sidebar */}
            <div className="sidebar">
                <div className="sidebar-header">
                    <h1 className="wizard-title">
                        {t('wizard.title')}
                    </h1>
                    <p className="wizard-subtitle">{t('wizard.subtitle')}</p>

                    <div className="sidebar-actions-grid">
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
                    </div>
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
                            onClick={handleSaveAll}
                            className="btn-download-all"
                        >
                            <Download className="w-4 h-4" /> {t('wizard.downloadAll')}
                        </button>
                        <button
                            onClick={handleGenerateRoute}
                            disabled={generating}
                            className="btn-generate-route"
                        >
                            {generating ? t('wizard.generating', { progress: Math.round(genProgress) }) : <><Play className="w-4 h-4" /> {t('wizard.generateRoute')}</>}
                        </button>
                        <button
                            onClick={handleDownloadGenerated}
                            disabled={!genResult}
                            className="btn-download-routes"
                            title="Download generated route files"
                        >
                            <Download className="w-4 h-4" /> {t('wizard.downloadRoutes')}
                        </button>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="main-content">
                <div className="map-container">
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
                <div className="floating-info">
                    <p className="floating-info-text">
                        <span className="pulse-dot"></span>
                        Drawing: <span className="drawing-label">{currentStep.label}</span>
                    </p>
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
                                    <a href={genResult.download_links.csv} download className="download-card">
                                        <Download className="w-6 h-6 text-gray-500 group-hover:text-blue-600" />
                                        <span className="download-card-text">Global Plan (CSV)</span>
                                    </a>
                                    <a href={genResult.download_links.map_png} download className="download-card">
                                        <Download className="w-6 h-6 text-gray-500 group-hover:text-blue-600" />
                                        <span className="download-card-text">Map Image (PNG)</span>
                                    </a>
                                    <a href={genResult.download_links.map_yaml} download className="download-card">
                                        <Download className="w-6 h-6 text-gray-500 group-hover:text-blue-600" />
                                        <span className="download-card-text">Map Config (YAML)</span>
                                    </a>
                                    <a href={genResult.download_links.latlon_yaml} download className="download-card">
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
