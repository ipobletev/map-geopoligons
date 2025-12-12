import React, { useState, useEffect } from 'react';
import { X, Send, Loader2, FolderInput } from 'lucide-react';

interface TransferModalProps {
    isOpen: boolean;
    onClose: () => void;
    onTransfer: (data: any) => Promise<void>;
    isTransferring: boolean;
    availableFiles: string[];
}

export default function TransferModal({ isOpen, onClose, onTransfer, isTransferring, availableFiles }: TransferModalProps) {
    const [connection, setConnection] = useState({
        host: '',
        port: 22,
        username: '',
        password: ''
    });

    const [filePaths, setFilePaths] = useState<Record<string, string>>({});

    // Initialize file paths when availableFiles changes
    useEffect(() => {
        if (availableFiles.length > 0) {
            const initialPaths: Record<string, string> = {};
            availableFiles.forEach(file => {
                // Preserve existing path if user edited it, otherwise default
                initialPaths[file] = filePaths[file] || `/tmp/${file}`;
            });
            setFilePaths(initialPaths);
        }
    }, [availableFiles, isOpen]);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        await onTransfer({
            ...connection,
            files: filePaths
        });
    };

    const handleConnectionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setConnection(prev => ({
            ...prev,
            [name]: name === 'port' ? parseInt(value) || 22 : value
        }));
    };

    const handlePathChange = (filename: string, value: string) => {
        setFilePaths(prev => ({
            ...prev,
            [filename]: value
        }));
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl p-6 relative animate-in fade-in zoom-in duration-200 max-h-[90vh] overflow-y-auto">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors"
                >
                    <X className="w-5 h-5" />
                </button>

                <h3 className="text-xl font-semibold text-slate-800 mb-4 flex items-center gap-2">
                    <Send className="w-5 h-5 text-blue-600" />
                    Transfer Files (SCP)
                </h3>

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Connection Details */}
                    <div className="bg-slate-50 p-4 rounded-md border border-slate-200 space-y-4">
                        <h4 className="font-medium text-slate-700 text-sm">Connection Details</h4>
                        <div className="grid grid-cols-3 gap-4">
                            <div className="col-span-2">
                                <label className="block text-xs font-medium text-slate-500 mb-1">Host / IP</label>
                                <input
                                    type="text"
                                    name="host"
                                    required
                                    value={connection.host}
                                    onChange={handleConnectionChange}
                                    placeholder="192.168.1.100"
                                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-500 mb-1">Port</label>
                                <input
                                    type="number"
                                    name="port"
                                    required
                                    value={connection.port}
                                    onChange={handleConnectionChange}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-medium text-slate-500 mb-1">Username</label>
                                <input
                                    type="text"
                                    name="username"
                                    required
                                    value={connection.username}
                                    onChange={handleConnectionChange}
                                    placeholder="user"
                                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-500 mb-1">Password</label>
                                <input
                                    type="password"
                                    name="password"
                                    required
                                    value={connection.password}
                                    onChange={handleConnectionChange}
                                    placeholder="••••••••"
                                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Files List */}
                    <div>
                        <h4 className="font-medium text-slate-700 text-sm mb-3 flex items-center gap-2">
                            <FolderInput className="w-4 h-4 text-slate-500" />
                            File Destinations
                        </h4>
                        <div className="space-y-3">
                            {availableFiles.map(filename => (
                                <div key={filename} className="flex items-center gap-3">
                                    <div className="w-1/3 text-sm text-slate-600 font-medium truncate" title={filename}>
                                        {filename}
                                    </div>
                                    <div className="flex-1">
                                        <input
                                            type="text"
                                            value={filePaths[filename] || ''}
                                            onChange={(e) => handlePathChange(filename, e.target.value)}
                                            placeholder={`/remote/path/to/${filename}`}
                                            className="w-full px-3 py-1.5 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                                        />
                                    </div>
                                </div>
                            ))}
                            {availableFiles.length === 0 && (
                                <p className="text-sm text-slate-500 italic">No files available to transfer.</p>
                            )}
                        </div>
                    </div>

                    <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isTransferring || availableFiles.length === 0}
                            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md shadow-sm flex items-center gap-2 transition-all disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                            {isTransferring ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Sending...
                                </>
                            ) : (
                                <>
                                    <Send className="w-4 h-4" />
                                    Send Files
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
