import React, { useState } from 'react';
import { Upload, FileText, Map, Settings, Download } from 'lucide-react';

export default function RouteGenerator() {
    const [loading, setLoading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [result, setResult] = useState<{
        map_image: string;
        download_links: { [key: string]: string };
    } | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setLoading(true);
        setProgress(0);
        setError(null);
        setResult(null);

        const formData = new FormData(e.currentTarget);

        try {
            const response = await fetch('/api/generate-routes', {
                method: 'POST',
                body: formData,
            });

            if (!response.body) {
                throw new Error('No response body');
            }

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
                            setProgress(message.value);
                        } else if (message.type === 'result') {
                            setResult(message.data);
                        } else if (message.type === 'error') {
                            setError(message.message);
                        }
                    } catch (e) {
                        console.error('Error parsing JSON:', e);
                    }
                }
            }

        } catch (err) {
            setError('Failed to connect to server');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-6 max-w-4xl mx-auto bg-white rounded-xl shadow-md space-y-6">
            <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                <Map className="w-6 h-6" />
                Route Generator
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FileInput name="holes" label="Holes File (.hol/.csv)" required />
                    <FileInput name="geofence" label="Geofence (.geojson)" required />
                    <FileInput name="streets" label="Streets (.geojson)" required />
                    <FileInput name="home_pose" label="Home Pose (.geojson)" required />

                    <FileInput name="obstacles" label="Obstacles (.geojson)" />
                    <FileInput name="high_obstacles" label="High Obstacles (.geojson)" />
                    <FileInput name="transit_streets" label="Transit Streets (.geojson)" />
                </div>

                <div className="p-4 bg-gray-50 rounded-lg space-y-2">
                    <h3 className="font-semibold text-gray-700 flex items-center gap-2">
                        <Settings className="w-4 h-4" /> Options
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                        <Checkbox name="fit_streets" label="Fit Streets" defaultChecked />
                        <Checkbox name="fit_twice" label="Fit Twice" defaultChecked />
                        <Checkbox name="wgs84" label="WGS84 Coordinates" defaultChecked />
                        <Checkbox name="use_obstacles" label="Use Obstacles" />
                        <Checkbox name="use_high_obstacles" label="Use High Obstacles" />
                        <Checkbox name="use_transit_streets" label="Use Transit Streets" />
                    </div>
                </div>

                <div className="space-y-2">
                    {loading && (
                        <div className="w-full bg-gray-200 rounded-full h-2.5">
                            <div
                                className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                                style={{ width: `${progress}%` }}
                            ></div>
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2"
                    >
                        {loading ? `Generating... ${Math.round(progress)}%` : 'Generate Routes'}
                    </button>
                </div>
            </form>

            {error && (
                <div className="p-4 bg-red-50 text-red-700 rounded-lg border border-red-200">
                    <strong>Error:</strong> {error}
                </div>
            )}

            {result && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="border rounded-lg overflow-hidden shadow-sm">
                        <img src={result.map_image} alt="Generated Map" className="w-full h-auto" />
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <DownloadLink href={result.download_links.csv} label="Global Plan (CSV)" />
                        <DownloadLink href={result.download_links.map_png} label="Map Image (PNG)" />
                        <DownloadLink href={result.download_links.map_yaml} label="Map Config (YAML)" />
                        <DownloadLink href={result.download_links.latlon_yaml} label="LatLon Config (YAML)" />
                    </div>
                </div>
            )}
        </div>
    );
}

function FileInput({ name, label, required }: { name: string; label: string; required?: boolean }) {
    return (
        <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">
                {label} {required && <span className="text-red-500">*</span>}
            </label>
            <input
                type="file"
                name={name}
                required={required}
                className="block w-full text-sm text-gray-500
          file:mr-4 file:py-2 file:px-4
          file:rounded-full file:border-0
          file:text-sm file:font-semibold
          file:bg-blue-50 file:text-blue-700
          hover:file:bg-blue-100
          border border-gray-300 rounded-lg cursor-pointer"
            />
        </div>
    );
}

function Checkbox({ name, label, defaultChecked }: { name: string; label: string; defaultChecked?: boolean }) {
    return (
        <label className="flex items-center space-x-2 cursor-pointer">
            <input type="checkbox" name={name} value="true" defaultChecked={defaultChecked} className="rounded text-blue-600 focus:ring-blue-500" />
            <span className="text-sm text-gray-700">{label}</span>
        </label>
    )
}

function DownloadLink({ href, label }: { href: string; label: string }) {
    return (
        <a
            href={href}
            download
            className="flex flex-col items-center justify-center p-4 bg-gray-50 hover:bg-gray-100 rounded-lg border border-gray-200 transition-colors text-center gap-2 group"
        >
            <Download className="w-6 h-6 text-gray-500 group-hover:text-blue-600" />
            <span className="text-sm font-medium text-gray-700 group-hover:text-blue-700">{label}</span>
        </a>
    );
}
