import React, { useState } from 'react';
import {
    Truck, CheckCircle,
    Settings, Ruler, FileText, Droplet, Zap,
    Upload, RefreshCw, Map as MapIcon,
    AlertCircle
} from 'lucide-react';

// Helper for input fields with icons
const InfoInput = ({ label, icon: Icon, value, placeholder }: any) => (
    <div className="flex flex-col gap-1 w-full">
        <span className="text-sm font-medium text-slate-600 ml-1">{label}</span>
        <div className="flex items-center bg-white border border-slate-300 rounded-lg px-3 py-2 shadow-sm">
            <Icon size={18} className="text-slate-400 mr-3" />
            <input
                type="text"
                className="flex-1 bg-transparent border-none outline-none text-slate-700 font-medium"
                value={value}
                placeholder={placeholder}
                readOnly
            />
        </div>
    </div>
);

// Helper for Operation Summary Status Fields
const StatusField = ({ label, value }: { label: string, value: string }) => (
    <div className="flex flex-col gap-1 w-full">
        <span className="text-sm font-medium text-slate-600 ml-1">{label}</span>
        <div className="bg-white border border-slate-300 rounded-lg px-4 py-3 shadow-sm min-h-[48px] flex items-center">
            <span className="text-slate-800 font-medium">{value}</span>
        </div>
    </div>
);

const Autonomous: React.FC = () => {
    // Mock State for UI visualization
    const [consoleState] = useState<'idle' | 'request'>('idle');

    return (
        <div className="flex flex-col h-full bg-[#e6e7eb] p-6 gap-6 font-sans text-slate-800 overflow-hidden">

            {/* TOP SECTION: Console & Operation Buttons */}
            <div className="flex gap-6 h-[25%] min-h-[200px] shrink-0">

                {/* Console */}
                <div className="flex-[3] bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col overflow-hidden">
                    <div className="bg-white px-6 py-3 border-b border-slate-100">
                        <span className="font-bold text-slate-700 text-lg">Consola de operación</span>
                    </div>
                    {/* Console Viewport */}
                    <div className={`flex-1 flex items-center justify-center p-6 ${consoleState === 'idle' ? 'bg-[#a3b3cc]/30' : 'bg-red-50'}`}>
                        {consoleState === 'idle' ? (
                            <div className="flex items-center gap-4">
                                <div className="bg-[#1B8819] rounded-full p-2">
                                    <CheckCircle size={48} className="text-white" />
                                </div>
                                <span className="text-xl font-medium text-slate-600">Sin solicitudes por responder</span>
                            </div>
                        ) : (
                            <div className="flex items-center gap-4">
                                <AlertCircle size={48} className="text-red-500" />
                                <span className="text-xl font-medium text-red-600">Nueva solicitud pendiente...</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Operation Buttons */}
                <div className="flex-[1] flex flex-col gap-3 h-full">
                    <span className="text-sm font-medium text-slate-500 ml-1 mb-1 hidden">Botones de Operación</span>

                    <button className="flex-1 bg-[#0055cb] hover:bg-blue-700 active:scale-95 text-white rounded-xl shadow-md flex items-center justify-center gap-3 transition-all relative overflow-hidden group">
                        <div className="flex items-center justify-center bg-white/20 p-2 rounded-lg">
                            <Truck size={24} className="text-white fill-current" />
                        </div>
                        <span className="font-bold text-lg leading-tight text-center">Iniciar Operación</span>
                        <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>

                    <button className="flex-1 bg-[#0055cb] hover:bg-blue-700 active:scale-95 text-white rounded-xl shadow-md flex items-center justify-center font-bold text-lg transition-all">
                        Primar
                    </button>

                    <button className="flex-1 bg-[#0055cb] hover:bg-blue-700 active:scale-95 text-white rounded-xl shadow-md flex items-center justify-center font-bold text-lg transition-all">
                        Abortar Misión
                    </button>

                    <button className="flex-1 bg-[#0055cb] hover:bg-blue-700 active:scale-95 text-white rounded-xl shadow-md flex items-center justify-center font-bold text-lg transition-all">
                        Volver a Origen
                    </button>
                </div>
            </div>


            {/* BOTTOM SECTION: Map, Well Info, Summary */}
            <div className="flex-1 flex gap-6 min-h-0">

                {/* 1. Map Area (Left) */}
                <div className="flex-[2] bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col">
                    {/* Placeholder for Map */}
                    <div className="flex-1 m-2 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-center">
                        <span className="text-slate-400 font-medium">Map Visualization Area</span>
                    </div>
                </div>

                {/* 2. Well Info (Center) */}
                <div className="flex-[1] flex flex-col gap-4 min-w-[250px] overflow-y-auto pr-1">
                    <div className="flex items-center gap-2 mb-2">
                        <span className="text-lg font-bold text-slate-700">Mapa de Pozos</span>
                        <AlertCircle size={16} className="text-blue-500 cursor-help" />
                    </div>

                    <InfoInput label="Pozo ID" icon={MapIcon} placeholder="-" />
                    <InfoInput label="Estado" icon={Settings} placeholder="-" />
                    <InfoInput label="Profundidad medida" icon={Ruler} placeholder="-" />
                    <InfoInput label="Profundidad en archivo" icon={FileText} placeholder="-" />
                    <InfoInput label="Altura agua" icon={Droplet} placeholder="-" />
                    <InfoInput label="Profundidad booster" icon={Zap} placeholder="-" />

                    <button className="mt-4 w-full bg-[#0055cb] hover:bg-blue-700 text-white font-bold py-3 rounded-xl shadow-md flex items-center justify-center gap-2 transition-colors">
                        <MapIcon size={20} />
                        Cargar malla
                    </button>
                </div>

                {/* 3. Operation Summary (Right) */}
                <div className="flex-[1] flex flex-col gap-4 min-w-[280px] bg-[#dbe4f0]/50 -m-2 p-4 rounded-xl border border-slate-200/50">
                    <span className="text-lg font-bold text-slate-700 mb-2">Resumen de Operación</span>

                    <div className="flex gap-4 mb-2">
                        <div className="flex-1 bg-white rounded-xl p-4 shadow-sm border border-slate-200 flex flex-col items-center justify-center gap-2 h-32">
                            <span className="text-3xl font-bold text-slate-800">0</span>
                            <span className="text-xs font-medium text-slate-500 text-center leading-tight">Pozos<br />primados</span>
                        </div>
                        <div className="flex-1 bg-white rounded-xl p-4 shadow-sm border border-slate-200 flex flex-col items-center justify-center gap-2 h-32">
                            <span className="text-3xl font-bold text-slate-800">0</span>
                            <span className="text-xs font-medium text-slate-500 text-center leading-tight">Pozos<br />con agua</span>
                        </div>
                    </div>

                    <StatusField label="Tarea Actual:" value="" />
                    <StatusField label="Estado Primador:" value="" />
                    <StatusField label="Estado Pozómetro:" value="" />

                    <div className="flex gap-3 mt-auto pt-4">
                        <button className="flex-1 bg-[#0055cb] hover:bg-blue-700 text-white text-xs font-bold py-3 px-2 rounded-lg shadow-sm flex flex-col items-center justify-center gap-1 text-center leading-tight h-16">
                            <Upload size={18} />
                            Subir XML
                        </button>
                        <button className="flex-1 bg-[#0055cb] hover:bg-blue-700 text-white text-xs font-bold py-3 px-2 rounded-lg shadow-sm flex flex-col items-center justify-center gap-1 text-center leading-tight h-16">
                            <RefreshCw size={18} />
                            Umbrales Inc.
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default Autonomous;
