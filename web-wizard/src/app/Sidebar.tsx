import React, { useEffect, useState } from 'react';
import { useWarnMessage } from '../ros/topics/Alarms';
import { useGuiInfo } from '../ros/topics/Logs';
import { Octagon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import '../styles/components/Sidebar.css';

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
    const scrollToBottom = (ref: React.RefObject<HTMLUListElement | null>) => {
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
        <div className="sidebar-container">
            {/* Información */}
            <div className="info-section">
                <div className="section-header">{t('sidebar.information')}</div>
                <ul ref={infoListRef} className="message-list">
                    {infos.map((msg, i) => (
                        <li key={i} className="message-item">{msg}</li>
                    ))}
                </ul>
            </div>

            {/* Advertencia */}
            <div className="warning-section">
                <div className="section-header">{t('sidebar.warning')}</div>
                <ul ref={warningListRef} className="message-list message-list-warning">
                    {warnings.map((msg, i) => (
                        <li key={i} className="message-item">{msg}</li>
                    ))}
                </ul>
            </div>

            {/* Peligro */}
            <div className="danger-section">
                <div className="section-header">{t('sidebar.danger')}</div>
                <ul ref={dangerListRef} className="message-list message-list-danger">
                    {/* dangers.map(...) */}
                </ul>
            </div>

            {/* Emergency Stop Area */}
            <div className="emergency-area">
                {/* Styled to match the red button in the image approximately */}
                <div className="emergency-button-wrapper">
                    <button className="emergency-button">
                        <Octagon className="emergency-icon" />
                    </button>
                </div>
                <button className="ansul-button">
                    <span>🔥</span> ANSUL
                </button>
            </div>
        </div>
    );
};

export default Sidebar;
