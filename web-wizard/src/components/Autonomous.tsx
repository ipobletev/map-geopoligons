import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
// import MapComponent from './MapComponent'; // We might need to adapt this

const Autonomous = () => {
    const { t } = useTranslation();
    const [missionState, setMissionState] = useState('idle'); // idle, running, paused, error
    const [operatorRequest, setOperatorRequest] = useState<string | null>(null);
    const [operatorOptions, setOperatorOptions] = useState<string[]>([]);
    const [drillholeStats, setDrillholeStats] = useState({
        total: 0,
        completed: 0,
        water: 0
    });

    useEffect(() => {
        const interval = setInterval(fetchData, 1000);
        return () => clearInterval(interval);
    }, []);

    const fetchData = async () => {
        try {
            const response = await fetch('/api/autonomous/data');
            if (response.ok) {
                const data = await response.json();
                setMissionState(data.missionState);
                setOperatorRequest(data.operatorRequest);
                setOperatorOptions(data.operatorOptions);
                setDrillholeStats(data.drillholeStats);
            }
        } catch (error) {
            console.error('Error fetching autonomous data:', error);
        }
    };

    const sendCommand = async (command: string) => {
        try {
            await fetch('/api/autonomous/command', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ command })
            });
        } catch (error) {
            console.error('Error sending command:', error);
        }
    };

    const sendOperatorAnswer = async (answerIndex: number) => {
        try {
            await fetch('/api/autonomous/answer', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ answerIndex })
            });
            setOperatorRequest(null);
        } catch (error) {
            console.error('Error sending operator answer:', error);
        }
    };

    return (
        <div className="flex flex-col h-full gap-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
                {/* Left Panel: Map & Camera */}
                <div className="lg:col-span-2 flex flex-col gap-6">
                    <div className="bg-white p-4 rounded-lg shadow-lg flex-grow min-h-[400px]">
                        <h3 className="text-lg font-bold mb-2">Map Visualization</h3>
                        {/* Placeholder for Map - passing readOnly to MapComponent if supported, or just using it as is for now */}
                        <div className="w-full h-full bg-gray-200 rounded flex items-center justify-center">
                            <p className="text-gray-500">Map Component Placeholder (Robot Position, Holes)</p>
                        </div>
                    </div>

                    <div className="bg-white p-4 rounded-lg shadow-lg h-[300px]">
                        <h3 className="text-lg font-bold mb-2">Antenna Camera</h3>
                        <div className="w-full h-full bg-black rounded flex items-center justify-center text-white">
                            <p>Camera Feed</p>
                        </div>
                    </div>
                </div>

                {/* Right Panel: Controls & Console */}
                <div className="flex flex-col gap-6">
                    {/* Mission Control */}
                    <div className="bg-white p-6 rounded-lg shadow-lg">
                        <h3 className="text-xl font-bold mb-4">Mission Control</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <button
                                onClick={() => sendCommand('start')}
                                className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded"
                                disabled={missionState === 'running'}
                            >
                                Start Mission
                            </button>
                            <button
                                onClick={() => sendCommand('abort')}
                                className="bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-4 rounded"
                            >
                                Abort
                            </button>
                            <button
                                onClick={() => sendCommand('home')}
                                className="bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-3 px-4 rounded"
                            >
                                Return Home
                            </button>
                            <button
                                onClick={() => sendCommand('only_primer')}
                                className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-4 rounded"
                            >
                                Only Primer
                            </button>
                        </div>
                    </div>

                    {/* Stats */}
                    <div className="bg-white p-6 rounded-lg shadow-lg">
                        <h3 className="text-xl font-bold mb-4">Progress</h3>
                        <div className="space-y-4">
                            <div>
                                <div className="flex justify-between mb-1">
                                    <span>Completed</span>
                                    <span className="font-bold">{drillholeStats.completed} / {drillholeStats.total}</span>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-2.5">
                                    <div
                                        className="bg-blue-600 h-2.5 rounded-full"
                                        style={{ width: `${drillholeStats.total ? (drillholeStats.completed / drillholeStats.total) * 100 : 0}%` }}
                                    ></div>
                                </div>
                            </div>
                            <div className="flex justify-between">
                                <span>Water Detected</span>
                                <span className="font-bold">{drillholeStats.water}</span>
                            </div>
                        </div>
                    </div>

                    {/* Operator Console */}
                    <div className={`bg-white p-6 rounded-lg shadow-lg flex-grow border-2 ${operatorRequest ? 'border-red-500 animate-pulse' : 'border-transparent'}`}>
                        <h3 className="text-xl font-bold mb-4">Operator Console</h3>
                        {operatorRequest ? (
                            <div>
                                <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 mb-4" role="alert">
                                    <p className="font-bold">Request</p>
                                    <p>{operatorRequest}</p>
                                </div>
                                <div className="flex flex-col gap-2">
                                    {operatorOptions.map((option, index) => (
                                        <button
                                            key={index}
                                            onClick={() => sendOperatorAnswer(index)}
                                            className="bg-gray-100 hover:bg-gray-200 text-gray-800 font-semibold py-2 px-4 border border-gray-400 rounded shadow"
                                        >
                                            {option}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <p className="text-gray-500 italic">No active requests.</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Autonomous;
