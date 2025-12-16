import React from 'react';
import { useTranslation } from 'react-i18next';
import { useMachineInfo } from '../ros/topics/MachineInfo';
import { toggleMachineOn, toggleMachineOperative, clearErrors } from '../ros/topics/MachineControl';

interface SupervisorProps {
    isConnected: boolean;
}

const Supervisor: React.FC<SupervisorProps> = ({ isConnected }) => {
    const { t } = useTranslation();
    const { data: machineInfo } = useMachineInfo();

    // Helpers
    const formatValue = (val?: number) => val !== undefined ? Math.round(val) : '0';
    const formatSpeed = (val?: number) => val !== undefined ? val.toFixed(1) : '0.0';

    return (
        <div className="flex flex-col h-full w-full bg-gray-100 p-4 relative">
            {/* Disconnected Overlay */}
            {!isConnected && (
                <div className="absolute inset-0 z-50 bg-gray-200/50 backdrop-blur-[0.8px] flex items-center justify-center rounded-xl">
                    <div className="bg-white/90 px-8 py-4 rounded-xl shadow-lg border border-red-200 flex items-center gap-3">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        <span className="text-red-600 font-bold text-lg">{t('app.disconnectedOverlay')}</span>
                    </div>
                </div>
            )}

            {/* Machine Visualization Area (Center) */}
            <div className="flex-1 bg-gray-200 rounded-xl mb-4 relative flex items-center justify-center overflow-hidden shadow-inner">
                {/* Placeholder for Machine Graphic */}
                <div className="w-[400px] h-[250px] bg-white rounded-lg flex items-center justify-center shadow-sm">
                    {/* Simplified Tractor/Loader Icon Concept */}
                    <svg viewBox="0 0 200 150" className="w-64 h-64 text-black">
                        <path fill="currentColor" d="M140 80 a 20 20 0 0 1 20 20 v 20 a 10 10 0 0 1 -10 10 h-80 a 10 10 0 0 1 -10 -10 v -20 a 10 10 0 0 1 10 -10 z" />
                        <circle cx="130" cy="130" r="15" fill="currentColor" />
                        <circle cx="70" cy="130" r="12" fill="currentColor" />
                        <path fill="currentColor" d="M60 90 L 20 60 L 40 40 L 80 80 Z" />
                        <rect x="20" y="30" width="30" height="20" rx="5" fill="currentColor" />
                    </svg>
                </div>

                {/* Control Buttons (Overlay or placed below machine) */}
                <div className="absolute bottom-10 flex gap-8 z-10">
                    <button
                        onClick={() => toggleMachineOperative(!machineInfo?.contact_indicator)}
                        className={`w-32 h-32 rounded-full border-4 flex items-center justify-center text-white font-bold text-xl shadow-lg transition-transform active:scale-95 ${machineInfo?.contact_indicator ? 'bg-green-600 border-green-800' : 'bg-black border-gray-700'}`}
                    >
                        {t('supervisor.start')}
                    </button>

                    <div className="flex flex-col gap-4 self-center">
                        <button
                            onClick={() => toggleMachineOn(!machineInfo?.machine_on_status)}
                            className={`w-32 h-16 rounded-lg flex items-center justify-center text-white font-bold text-lg shadow-lg transition-colors ${machineInfo?.machine_on_status ? 'bg-green-600' : 'bg-black'}`}
                        >
                            {t('supervisor.contact')}
                        </button>

                        <button
                            onClick={clearErrors}
                            className="w-32 h-16 rounded-lg bg-yellow-500 hover:bg-yellow-600 active:scale-95 text-white font-bold text-lg shadow-lg transition-colors flex flex-col items-center justify-center leading-tight"
                        >
                            {t('supervisor.clearErrors')}
                        </button>
                    </div>
                </div>
            </div>

            {/* Bottom Instrument Cluster */}
            <div className="h-48 grid grid-cols-4 gap-4">

                {/* Combustible */}
                <div className="bg-gray-300 rounded-t-lg p-2 flex flex-col relative">
                    <span className="text-gray-700 font-bold mb-2">{t('supervisor.fuel')}</span>
                    <div className="flex-1 bg-slate-700 flex items-center justify-end pr-4 rounded">
                        <span className="font-mono text-5xl text-white tracking-widest">{formatValue(machineInfo?.fuel_level)}</span>
                    </div>
                </div>

                {/* Velocidad */}
                <div className="bg-gray-300 rounded-t-lg p-2 flex flex-col items-center">
                    <span className="text-gray-700 font-bold w-full text-left mb-1">{t('supervisor.speed')}</span>
                    <div className="relative w-32 h-32 bg-slate-700 rounded-full flex items-center justify-center">
                        <span className="font-mono text-4xl text-white">{formatSpeed(machineInfo?.speed)}</span>
                        <span className="absolute bottom-4 text-xs text-gray-400">m/s</span>
                    </div>
                </div>

                {/* RPM */}
                <div className="bg-gray-300 rounded-t-lg p-2 flex flex-col relative">
                    <span className="text-gray-700 font-bold mb-2">{t('supervisor.rpm')}</span>
                    <div className="flex-1 bg-slate-700 flex items-center justify-end pr-4 rounded">
                        <span className="font-mono text-5xl text-white tracking-widest">{formatValue(machineInfo?.rpm)}</span>
                    </div>
                </div>

                {/* Alerta Vuelco */}
                <div className="bg-white rounded-t-lg p-2 flex flex-col">
                    <span className="text-gray-700 font-bold mb-2">{t('supervisor.rollAlert')}</span>
                    <div className="flex-1 border-2 border-gray-300 flex items-center justify-center relative bg-gray-100">
                        {/* Alarm Icon Placeholder */}
                        {machineInfo?.cell_load_95 ? (
                            <div className="text-red-600 font-bold text-center animate-pulse">
                                ⚠ {t('supervisor.rollover')}
                            </div>
                        ) : (
                            <div className="opacity-20 text-6xl">⚠</div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Supervisor;
