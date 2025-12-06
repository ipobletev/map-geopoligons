import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

const Status = () => {
    const { t } = useTranslation();
    const [statusData, setStatusData] = useState({
        sensors: {
            lidarFront: 'ok',
            lidarLeft: 'ok',
            lidarRight: 'ok',
            lidarBack: 'ok',
            imuFront: 'ok',
            imuLeft: 'ok',
            imuRight: 'ok',
            imuBack: 'ok',
            gnss: 'ok'
        },
        primer: {
            spoolerRight: 0,
            spoolerLeft: 0,
            boosterRight: 0,
            boosterLeft: 0,
            stickCount: 0,
            racks: [] // Array of status codes/colors
        },
        inclination: {
            primer: 0,
            dieci: 0
        }
    });

    useEffect(() => {
        const interval = setInterval(fetchData, 1000);
        return () => clearInterval(interval);
    }, []);

    const fetchData = async () => {
        try {
            const response = await fetch('/api/status/data');
            if (response.ok) {
                const data = await response.json();
                setStatusData(data);
            }
        } catch (error) {
            console.error('Error fetching status data:', error);
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'ok': return 'bg-green-500';
            case 'warn': return 'bg-yellow-500';
            case 'error': return 'bg-red-500';
            default: return 'bg-gray-300';
        }
    };

    return (
        <div className="p-6 bg-white rounded-lg shadow-lg">
            <h2 className="text-2xl font-bold mb-6">System Status</h2>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Sensors */}
                <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
                    <h3 className="text-xl font-semibold mb-4">Sensors</h3>
                    <div className="grid grid-cols-2 gap-4">
                        {Object.entries(statusData.sensors).map(([key, status]) => (
                            <div key={key} className="flex items-center justify-between p-3 bg-white rounded shadow-sm">
                                <span className="capitalize font-medium">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                                <div className={`w-4 h-4 rounded-full ${getStatusColor(status)}`}></div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Primer Info */}
                <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
                    <h3 className="text-xl font-semibold mb-4">Primer Info</h3>
                    <div className="grid grid-cols-2 gap-4 mb-6">
                        <div className="bg-white p-3 rounded shadow-sm">
                            <div className="text-sm text-gray-500">Spooler Right</div>
                            <div className="text-xl font-bold">{statusData.primer.spoolerRight}</div>
                        </div>
                        <div className="bg-white p-3 rounded shadow-sm">
                            <div className="text-sm text-gray-500">Spooler Left</div>
                            <div className="text-xl font-bold">{statusData.primer.spoolerLeft}</div>
                        </div>
                        <div className="bg-white p-3 rounded shadow-sm">
                            <div className="text-sm text-gray-500">Booster Right</div>
                            <div className="text-xl font-bold">{statusData.primer.boosterRight}</div>
                        </div>
                        <div className="bg-white p-3 rounded shadow-sm">
                            <div className="text-sm text-gray-500">Booster Left</div>
                            <div className="text-xl font-bold">{statusData.primer.boosterLeft}</div>
                        </div>
                    </div>

                    <div className="bg-white p-3 rounded shadow-sm mb-4">
                        <div className="text-sm text-gray-500">Stick Count</div>
                        <div className="text-xl font-bold">{statusData.primer.stickCount}</div>
                    </div>

                    <h4 className="font-semibold mb-2">Inclination</h4>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-white p-3 rounded shadow-sm">
                            <div className="text-sm text-gray-500">Primer Pitch</div>
                            <div className="text-xl font-bold">{statusData.inclination.primer.toFixed(1)}°</div>
                        </div>
                        <div className="bg-white p-3 rounded shadow-sm">
                            <div className="text-sm text-gray-500">Dieci Pitch</div>
                            <div className="text-xl font-bold">{statusData.inclination.dieci.toFixed(1)}°</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Status;
