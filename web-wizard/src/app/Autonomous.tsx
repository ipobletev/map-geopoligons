import React, { useState } from 'react';
import {
    Truck, CheckCircle,
    Settings, Ruler, FileText, Droplet, Zap,
    Upload, RefreshCw, Map as MapIcon,
    AlertCircle
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import '../styles/components/Autonomous.css';

// Helper for input fields with icons
const InfoInput = ({ label, icon: Icon, value, placeholder }: any) => (
    <div className="info-input-container">
        <span className="info-input-label">{label}</span>
        <div className="info-input-wrapper">
            <Icon size={18} className="info-input-icon" />
            <input
                type="text"
                className="info-input-field"
                value={value}
                placeholder={placeholder}
                readOnly
            />
        </div>
    </div>
);

// Helper for Operation Summary Status Fields
const StatusField = ({ label, value }: { label: string, value: string }) => (
    <div className="status-field-container">
        <span className="status-field-label">{label}</span>
        <div className="status-field-value-box">
            <span className="status-field-value">{value}</span>
        </div>
    </div>
);

const Autonomous: React.FC<{ isConnected: boolean }> = ({ isConnected }) => {
    const { t } = useTranslation();
    // Mock State for UI visualization
    const [consoleState] = useState<'idle' | 'request'>('idle');

    return (
        <div className="autonomous-container">
            {/* Disconnected Overlay */}
            {!isConnected && (
                <div className="disconnected-overlay">
                    <div className="disconnected-box">
                        <svg xmlns="http://www.w3.org/2000/svg" className="disconnected-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        <span className="disconnected-text">{t('app.disconnectedOverlay')}</span>
                    </div>
                </div>
            )}


            {/* TOP SECTION: Console & Operation Buttons */}
            <div className="autonomous-top-section">

                {/* Console */}
                <div className="console-container">
                    <div className="console-header">
                        <span className="console-title">{t('autonomous.console')}</span>
                    </div>
                    {/* Console Viewport */}
                    <div className={`console-viewport ${consoleState}`}>
                        {consoleState === 'idle' ? (
                            <div className="console-status-box">
                                <div className="console-icon-bg">
                                    <CheckCircle size={48} className="text-white" />
                                </div>
                                <span className="console-status-text">{t('autonomous.noRequests')}</span>
                            </div>
                        ) : (
                            <div className="console-status-box">
                                <AlertCircle size={48} className="text-red-500" />
                                <span className="console-status-text-error">{t('autonomous.newRequest')}</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Operation Buttons */}
                <div className="op-buttons-container">
                    <span className="op-buttons-label">{t('autonomous.opButtons')}</span>

                    <button className="op-button-start group">
                        <div className="op-button-icon-box">
                            <Truck size={24} className="text-white fill-current" />
                        </div>
                        <span className="op-button-text">{t('autonomous.startOp')}</span>
                        <div className="op-button-overlay" />
                    </button>

                    <button className="op-button">
                        {t('autonomous.prime')}
                    </button>

                    <button className="op-button">
                        {t('autonomous.abort')}
                    </button>

                    <button className="op-button">
                        {t('autonomous.returnHome')}
                    </button>
                </div>
            </div>


            {/* BOTTOM SECTION: Map, Well Info, Summary */}
            <div className="autonomous-bottom-section">

                {/* 1. Map Area (Left) */}
                <div className="map-container">
                    {/* Placeholder for Map */}
                    <div className="map-placeholder">
                        <span className="map-placeholder-text">{t('autonomous.mapArea')}</span>
                    </div>
                </div>

                {/* 2. Well Info (Center) */}
                <div className="well-info-container">
                    <div className="well-info-header">
                        <span className="well-info-title">{t('autonomous.wellsMap')}</span>
                        <AlertCircle size={16} className="text-blue-500 cursor-help" />
                    </div>

                    <InfoInput label={t('autonomous.wellId')} icon={MapIcon} placeholder="-" />
                    <InfoInput label={t('autonomous.state')} icon={Settings} placeholder="-" />
                    <InfoInput label={t('autonomous.measuredDepth')} icon={Ruler} placeholder="-" />
                    <InfoInput label={t('autonomous.fileDepth')} icon={FileText} placeholder="-" />
                    <InfoInput label={t('autonomous.waterHeight')} icon={Droplet} placeholder="-" />
                    <InfoInput label={t('autonomous.boosterDepth')} icon={Zap} placeholder="-" />

                    <button className="load-mesh-button">
                        <MapIcon size={20} />
                        {t('autonomous.loadMesh')}
                    </button>
                </div>

                {/* 3. Operation Summary (Right) */}
                <div className="op-summary-container">
                    <span className="op-summary-title">{t('autonomous.opSummary')}</span>

                    <div className="summary-stats-row">
                        <div className="summary-stat-card">
                            <span className="summary-stat-value">0</span>
                            <span className="summary-stat-label">{t('autonomous.primedWells')}</span>
                        </div>
                        <div className="summary-stat-card">
                            <span className="summary-stat-value">0</span>
                            <span className="summary-stat-label">{t('autonomous.waterWells')}</span>
                        </div>
                    </div>

                    <StatusField label={`${t('autonomous.currentTask')}:`} value="" />
                    <StatusField label={`${t('autonomous.primerStatus')}:`} value="" />
                    <StatusField label={`${t('autonomous.porometerStatus')}:`} value="" />

                    <div className="summary-actions-row">
                        <button className="summary-action-button">
                            <Upload size={18} />
                            {t('autonomous.uploadXml')}
                        </button>
                        <button className="summary-action-button">
                            <RefreshCw size={18} />
                            {t('autonomous.incThresholds')}
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default Autonomous;
