import React, { useEffect, useState } from 'react';
import { useWarnMessage } from '../ros/topics/Alarms';
import { useGuiInfo } from '../ros/topics/Logs';
import { Octagon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const Sidebar: React.FC = () => {
    const { t } = useTranslation();
    const { data: warningMsg } = useWarnMessage();
    const { data: infoMsg } = useGuiInfo();

    const [infos, setInfos] = useState<string[]>([]);
    const [warnings, setWarnings] = useState<string[]>([]);
    // const [dangers, setDangers] = useState<string[]>([]); // TODO: Implement Dangers when topic is known

    const infoListRef = React.useRef<HTMLUListElement>(null);
    const warningListRef = React.useRef<HTMLUListElement>(null);
    const dangerListRef = React.useRef<HTMLUListElement>(null);

    // Auto-scroll helper
    const scrollToBottom = (ref: React.RefObject<HTMLUListElement>) => {
        if (ref.current) {
            ref.current.scrollTop = ref.current.scrollHeight;
        }
    };

    useEffect(() => {
        if (infoMsg?.data) {
            setInfos(prev => [...prev, infoMsg.data].slice(-50));
        }
    }, [infoMsg]);

    useEffect(() => {
        scrollToBottom(infoListRef);
    }, [infos]);

    useEffect(() => {
        if (warningMsg?.data) {
            setWarnings(prev => [...prev, warningMsg.data].slice(-50));
        }
    }, [warningMsg]);

    useEffect(() => {
        scrollToBottom(warningListRef);
    }, [warnings]);

    return (
        <div className="flex flex-col w-64 h-full bg-gray-100 border-r border-gray-300 p-2 gap-2 shrink-0">
            {/* Información */}
            <div className="flex flex-col h-1/3 bg-white border border-gray-300 rounded-sm">
                <div className="bg-gray-200 px-2 py-1 font-bold text-gray-700 text-base">{t('sidebar.information')}</div>
                <ul ref={infoListRef} className="flex-1 overflow-y-auto p-1 text-xs font-mono">
                    {infos.map((msg, i) => (
                        <li key={i} className="whitespace-pre-wrap mb-1">{msg}</li>
                    ))}
                </ul>
            </div>

            {/* Advertencia */}
            <div className="flex flex-col h-1/3 bg-white border border-gray-300 rounded-sm">
                <div className="bg-gray-200 px-2 py-1 font-bold text-gray-700 text-base">{t('sidebar.warning')}</div>
                <ul ref={warningListRef} className="flex-1 overflow-y-auto p-1 text-xs font-mono text-orange-600">
                    {warnings.map((msg, i) => (
                        <li key={i} className="whitespace-pre-wrap mb-1">{msg}</li>
                    ))}
                </ul>
            </div>

            {/* Peligro */}
            <div className="flex flex-col h-1/3 bg-white border border-gray-300 rounded-sm">
                <div className="bg-gray-200 px-2 py-1 font-bold text-gray-700 text-base">{t('sidebar.danger')}</div>
                <ul ref={dangerListRef} className="flex-1 overflow-y-auto p-1 text-xs font-mono text-red-600">
                    {/* dangers.map(...) */}
                </ul>
            </div>

            {/* Emergency Stop Area */}
            <div className="flex flex-col gap-2 mt-auto">
                {/* Styled to match the red button in the image approximately */}
                <div className="relative w-full aspect-square bg-yellow-400 flex items-center justify-center overflow-hidden bg-[repeating-linear-gradient(45deg,transparent,transparent_10px,#000_10px,#000_20px)]">
                    <button className="w-20 h-20 rounded-full bg-red-600 shadow-[0_4px_0_rgb(153,27,27)] active:shadow-none active:translate-y-1 border-4 border-red-800 flex items-center justify-center">
                        <Octagon className="text-white w-10 h-10" />
                    </button>
                </div>
                <button className="bg-gray-200 border border-gray-400 text-gray-700 font-bold py-1 px-4 rounded flex items-center justify-center gap-2">
                    <span>🔥</span> ANSUL
                </button>
            </div>
        </div>
    );
};

export default Sidebar;
