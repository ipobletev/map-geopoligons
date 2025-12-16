import React, { useState, useEffect } from 'react';
import { X, Save, Server, RefreshCw } from 'lucide-react';
import RosConnection from '../ros/RosConnection';

interface ConnectionModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const ConnectionModal: React.FC<ConnectionModalProps> = ({ isOpen, onClose }) => {
    const [url, setUrl] = useState('');
    const [isConnecting, setIsConnecting] = useState(false);
    const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');

    useEffect(() => {
        if (isOpen) {
            const currentUrl = RosConnection.getInstance().getUrl();
            setUrl(currentUrl);
            setStatus('idle');
        }
    }, [isOpen]);

    const handleSave = () => {
        setIsConnecting(true);
        setStatus('idle');

        try {
            RosConnection.getInstance().connect(url);
            // Simulate a brief check or just assume triggered
            setTimeout(() => {
                setIsConnecting(false);
                onClose();
            }, 500);
        } catch (e) {
            console.error(e);
            setStatus('error');
            setIsConnecting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999] flex items-center justify-center">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-100 animate-in fade-in zoom-in duration-200">
                <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex justify-between items-center">
                    <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                        <Server className="w-5 h-5 text-indigo-600" />
                        Configure Connection
                    </h3>
                    <button
                        onClick={onClose}
                        className="text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-full hover:bg-slate-200"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                            ROS Bridge URL
                        </label>
                        <input
                            type="text"
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
                            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                            placeholder="ws://localhost:9090"
                        />
                        <p className="text-xs text-slate-500 mt-2">
                            Enter the WebSocket URL of your ROS bridge server (e.g., ws://192.168.1.100:9090).
                        </p>
                        {status === 'error' && (
                            <p className="text-xs text-red-500 mt-2 font-medium animate-pulse">
                                Failed to connect. Please check the URL and try again.
                            </p>
                        )}
                    </div>

                    <div className="flex justify-end gap-3 mt-6">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-100 rounded-lg transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={isConnecting}
                            className="px-4 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200 flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                            {isConnecting ? (
                                <>
                                    <RefreshCw className="w-4 h-4 animate-spin" />
                                    Connecting...
                                </>
                            ) : (
                                <>
                                    <Save className="w-4 h-4" />
                                    Save & Connect
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ConnectionModal;
