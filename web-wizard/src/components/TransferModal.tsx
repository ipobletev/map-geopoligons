import React, { useState } from 'react';
import { X, Send, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface TransferModalProps {
    isOpen: boolean;
    onClose: () => void;
    onTransfer: (data: any) => Promise<void>;
    isTransferring: boolean;
}

export default function TransferModal({ isOpen, onClose, onTransfer, isTransferring }: TransferModalProps) {
    const { t } = useTranslation();
    const [formData, setFormData] = useState({
        host: '',
        port: 22,
        username: '',
        password: '',
        remote_path: '/tmp/'
    });

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        await onTransfer(formData);
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: name === 'port' ? parseInt(value) || 22 : value
        }));
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6 relative animate-in fade-in zoom-in duration-200">
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

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-3 gap-4">
                        <div className="col-span-2">
                            <label className="block text-sm font-medium text-slate-700 mb-1">Host / IP</label>
                            <input
                                type="text"
                                name="host"
                                required
                                value={formData.host}
                                onChange={handleChange}
                                placeholder="192.168.1.100"
                                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Port</label>
                            <input
                                type="number"
                                name="port"
                                required
                                value={formData.port}
                                onChange={handleChange}
                                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Username</label>
                        <input
                            type="text"
                            name="username"
                            required
                            value={formData.username}
                            onChange={handleChange}
                            placeholder="user"
                            className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
                        <input
                            type="password"
                            name="password"
                            required
                            value={formData.password}
                            onChange={handleChange}
                            placeholder="••••••••"
                            className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Remote Path</label>
                        <input
                            type="text"
                            name="remote_path"
                            required
                            value={formData.remote_path}
                            onChange={handleChange}
                            placeholder="/home/user/data/"
                            className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                        />
                        <p className="text-xs text-slate-500 mt-1">Destination directory on the remote machine.</p>
                    </div>

                    <div className="pt-4 flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isTransferring}
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
