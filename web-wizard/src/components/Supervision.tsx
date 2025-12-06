import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

interface LogData {
    info: string[];
    warn: string[];
    danger: string[];
}

const Supervision = () => {
    const { t } = useTranslation();
    const [machineData, setMachineData] = useState({
        speed: 0,
        rpm: 0,
        fuel: 0,
        voltage: 0,
        machineOn: false,
        machineOperative: false,
        dieciStatus: false,
        dieciAlarm: false
    });

    const [logs, setLogs] = useState<LogData>({
        info: [],
        warn: [],
        danger: []
    });

    useEffect(() => {
        const interval = setInterval(() => {
            fetchData();
            fetchLogs();
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    const fetchData = async () => {
        try {
            const response = await fetch('/api/supervision/data');
            if (response.ok) {
                const data = await response.json();
                setMachineData(data);
            }
        } catch (error) {
            console.error('Error fetching supervision data:', error);
        }
    };

    const fetchLogs = async () => {
        try {
            const response = await fetch('/api/supervision/logs');
            if (response.ok) {
                const data = await response.json();
                setLogs(data);
            }
        } catch (error) {
            console.error('Error fetching logs:', error);
        }
    };

    const toggleMachineOn = async () => {
        try {
            await fetch('/api/supervision/machine-on', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ state: !machineData.machineOn })
            });
        } catch (error) {
            console.error('Error toggling machine on:', error);
        }
    };

    const toggleMachineOperative = async () => {
        try {
            await fetch('/api/supervision/machine-operative', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ state: !machineData.machineOperative })
            });
        } catch (error) {
            console.error('Error toggling machine operative:', error);
        }
    };

    const LogPanel = ({ title, items, colorClass }: { title: string, items: string[], colorClass: string }) => (
        <div className="flex flex-col h-1/3 border border-gray-300 rounded-lg overflow-hidden mb-2 last:mb-0">
            <div className="bg-gray-100 px-3 py-2 font-bold border-b border-gray-300">
                {title}
            </div>
            <div className={`flex-1 overflow-y-auto p-2 text-sm ${colorClass} bg-white`}>
                {items.length === 0 ? (
                    <span className="text-gray-400 italic">No logs</span>
                ) : (
                    items.map((log, index) => (
                        <div key={index} className="mb-1 border-b border-gray-100 last:border-0 pb-1">
                            {log}
                        </div>
                    ))
                )}
            </div>
        </div>
    );

    return (
        <div className="flex h-full gap-4 p-4 bg-gray-50">
            {/* Left Column: Logs */}
            <div className="w-1/3 flex flex-col h-[calc(100vh-140px)]">
                <LogPanel title="Información" items={logs.info} colorClass="text-gray-700" />
                <LogPanel title="Advertencia" items={logs.warn} colorClass="text-yellow-700" />
                <LogPanel title="Peligro" items={logs.danger} colorClass="text-red-700" />
            </div>

            {/* Right Column: Machine Visualization & Controls */}
            <div className="w-2/3 flex flex-col gap-4">
                {/* Top: Machine Visualization */}
                <div className="flex-1 bg-gray-200 rounded-lg flex items-center justify-center relative min-h-[300px]">
                    <div className="bg-white p-8 rounded-xl shadow-sm text-center">
                        <div className="text-xl font-bold mb-4 text-gray-700">
                            {machineData.machineOn ? 'Dieci Encendido' : 'Dieci Apagado'}
                        </div>
                        {/* Placeholder for Dieci Image - You can replace with actual image later */}
                        <div className="w-48 h-32 bg-gray-300 mx-auto rounded-lg flex items-center justify-center mb-4">
                            <span className="text-gray-500">Vehicle Image</span>
                        </div>
                    </div>

                    {/* Control Buttons Overlay */}
                    <div className="absolute bottom-8 flex gap-4">
                        <button
                            onClick={toggleMachineOperative}
                            className={`w-24 h-24 rounded-full font-bold text-white shadow-lg transition-transform active:scale-95 flex items-center justify-center text-lg ${machineData.machineOperative ? 'bg-black border-4 border-green-500' : 'bg-black'
                                }`}
                        >
                            START
                        </button>
                        <button
                            onClick={toggleMachineOn}
                            className={`px-6 py-3 rounded-lg font-bold text-white shadow-md transition-colors h-12 self-center ${machineData.machineOn ? 'bg-black border-2 border-green-500' : 'bg-black'
                                }`}
                        >
                            Contacto
                        </button>
                    </div>
                </div>

                {/* Bottom: Gauges & Status */}
                <div className="grid grid-cols-4 gap-4 h-48">
                    {/* Fuel */}
                    <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 flex flex-col">
                        <h3 className="text-gray-600 font-semibold mb-2">Combustible [%]</h3>
                        <div className="flex-1 bg-gray-800 rounded flex items-center justify-center relative">
                            <div className="text-white text-4xl font-mono">{machineData.fuel}</div>
                        </div>
                    </div>

                    {/* Speed */}
                    <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 flex flex-col">
                        <h3 className="text-gray-600 font-semibold mb-2">Velocidad</h3>
                        <div className="flex-1 bg-gray-800 rounded-full flex items-center justify-center relative mx-auto aspect-square w-full max-w-[140px]">
                            <div className="text-white text-3xl font-mono">{machineData.speed.toFixed(1)}</div>
                            <span className="absolute bottom-4 text-gray-400 text-xs">m/s</span>
                        </div>
                    </div>

                    {/* RPM */}
                    <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 flex flex-col">
                        <h3 className="text-gray-600 font-semibold mb-2">RPM</h3>
                        <div className="flex-1 bg-gray-800 rounded flex items-center justify-center">
                            <div className="text-white text-4xl font-mono">{machineData.rpm}</div>
                        </div>
                    </div>

                    {/* Rollover Alert */}
                    <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 flex flex-col">
                        <h3 className="text-gray-600 font-semibold mb-2">Alerta vuelco</h3>
                        <div className="flex-1 flex items-center justify-center">
                            {machineData.dieciAlarm ? (
                                <div className="text-red-600 font-bold text-center animate-pulse">
                                    WARNING
                                </div>
                            ) : (
                                <div className="text-gray-300">
                                    Normal
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Emergency Stop & ANSUL (Bottom Left of Right Column area) */}
                <div className="flex gap-4">
                    <button className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded shadow">
                        GUI sin conexión
                    </button>
                    <button className="bg-white border border-red-500 text-red-500 hover:bg-red-50 font-bold py-2 px-4 rounded shadow flex items-center">
                        <span className="mr-2">🔥</span> ANSUL
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Supervision;
