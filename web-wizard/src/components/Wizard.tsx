import { useState, useRef } from 'react';
import { WIZARD_STEPS } from '../types';
import MapComponent from './MapComponent';
import { enrichGeoJSONWithUTM } from '../utils/utm';
import { saveAs } from 'file-saver';
import JSZip from 'jszip';
import { ArrowRight, ArrowLeft, Save, CheckCircle, Trash2, Upload, Download } from 'lucide-react';
import { parseHolFile } from '../utils/holParser';

const Wizard = () => {
    const [currentStepIndex, setCurrentStepIndex] = useState(0);
    const [data, setData] = useState<Record<string, any>>({});
    const [currentStepData, setCurrentStepData] = useState<any>(null);
    const [centerTrigger, setCenterTrigger] = useState(0);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const currentStep = WIZARD_STEPS[currentStepIndex];
    const isLastStep = currentStepIndex === WIZARD_STEPS.length - 1;

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
        if (confirm('Are you sure you want to delete all generated figures? This cannot be undone.')) {
            setData({});
            setCurrentStepData(null);
            // Force map refresh by key change or similar if needed, but data prop change should suffice for static layers.
            // For editable layer, we might need to clear it.
            // The MapComponent clears editable layer on step change, but here we are on same step.
            // We can force a remount or pass a "clear signal".
            // Simplest is to just reload the page or reset state completely.
            window.location.reload();
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

                // We assume loading into current step
                // But maybe we want to load a full project?
                // Request says "un boton para cargar geojson".
                // Let's assume loading into current step for now, or maybe smart detection?
                // If it's a single feature collection, load into current step.

                // Check if it has UTM, if not, it will be enriched on save.
                setCurrentStepData(parsed);

                // We need to tell the map to display this as editable.
                // Currently MapComponent doesn't accept "initialEditableData".
                // We can pass it via a new prop or just let the user draw.
                // Wait, if we want to load it into the map, we need to pass it to MapComponent.
                // Let's update MapComponent to accept `initialData` for the editable layer.
                // Let's update MapComponent to accept `initialData` for the editable layer.

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

    const handleSaveAll = async () => {
        const zip = new JSZip();

        // Create folder structure: map-geopoligons/geojson/{datetime}/
        const now = new Date();
        const timestamp = now.toISOString().replace(/[:.]/g, '-').split('T')[0] + '_' + now.toTimeString().split(' ')[0].replace(/:/g, '');
        const folderName = `map-geopoligons/geojson/${timestamp}`;
        const folder = zip.folder(folderName);

        if (!folder) return;

        // Add all steps to zip
        WIZARD_STEPS.forEach(step => {
            const stepData = data[step.key];
            if (stepData) {
                folder.file(`${step.key}.geojson`, JSON.stringify(stepData, null, 4));
            }
        });

        // Also add current step data if not saved yet
        if (currentStepData && currentStepData.features && currentStepData.features.length > 0) {
            const enriched = enrichGeoJSONWithUTM(currentStepData);
            folder.file(`${currentStep.key}.geojson`, JSON.stringify(enriched, null, 4));
        }

        const content = await zip.generateAsync({ type: 'blob' });
        saveAs(content, `map-geopoligons-${timestamp}.zip`);
    };

    return (
        <div className="flex h-screen w-full bg-slate-50">
            {/* Sidebar */}
            <div className="w-80 bg-white border-r border-slate-200 flex flex-col shadow-lg z-10">
                <div className="p-6 border-b border-slate-100">
                    <h1 className="text-2xl font-bold text-slate-800 bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                        Map Wizard
                    </h1>
                    <p className="text-sm text-slate-500 mt-1">Generate map geopolygons</p>

                    <div className="flex gap-2 mt-4">
                        <button
                            onClick={handleClearAll}
                            className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded border border-red-200 transition-colors"
                            title="Delete all figures"
                        >
                            <Trash2 className="w-3 h-3" /> Clear All
                        </button>
                        <button
                            onClick={handleCenterMap}
                            className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded border border-blue-200 transition-colors"
                            title="Center map on data"
                        >
                            <Upload className="w-3 h-3 rotate-90" /> Center Map
                        </button>
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs font-medium text-slate-600 bg-slate-50 hover:bg-slate-100 rounded border border-slate-200 transition-colors"
                            title="Load GeoJSON"
                        >
                            <Upload className="w-3 h-3" /> Load JSON
                        </button>
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleLoadGeoJSON}
                            accept=".geojson,.json,.hol"
                            className="hidden"
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {WIZARD_STEPS.map((step, index) => {
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
                                        Step {index + 1}
                                    </span>
                                    {hasData && <CheckCircle className="w-4 h-4 text-green-500" />}
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
                                Back
                            </button>
                            <button
                                onClick={handleNext}
                                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                            >
                                {isLastStep ? 'Finish' : 'Next'}
                                {isLastStep ? <Save className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
                            </button>
                        </div>
                        <button
                            onClick={handleSaveAll}
                            className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-slate-800 text-white font-medium hover:bg-slate-900 shadow-md hover:shadow-lg transition-all"
                        >
                            <Download className="w-4 h-4" /> Download All (ZIP)
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
        </div>
    );
};

export default Wizard;
