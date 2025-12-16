import React from 'react';
import { useTranslation } from 'react-i18next';
import { useMachineInfo } from '../ros/topics/MachineInfo';
import { toggleMachineOn, toggleMachineOperative, clearErrors } from '../ros/topics/MachineControl';
import '../styles/Supervisor.css';

interface SupervisorProps {
    isConnected: boolean;
}

const Supervisor: React.FC<SupervisorProps> = ({ isConnected }) => {
    const { t } = useTranslation();
    const { data: machineInfo } = useMachineInfo();

    // Helpers
    const formatValue = (val?: number) => val !== undefined ? Math.round(val) : '0';
    const formatSpeed = (val?: number) => val !== undefined ? val.toFixed(1) : '0.0';

    return (
        <div className="supervisor-container">
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

            {/* Machine Visualization Area (Center) */}
            <div className="machine-viz-area">
                {/* Placeholder for Machine Graphic */}
                <div className="machine-placeholder">
                    {/* Simplified Tractor/Loader Icon Concept */}
                    <svg viewBox="0 0 200 150" className="machine-svg">
                        <path fill="currentColor" d="M140 80 a 20 20 0 0 1 20 20 v 20 a 10 10 0 0 1 -10 10 h-80 a 10 10 0 0 1 -10 -10 v -20 a 10 10 0 0 1 10 -10 z" />
                        <circle cx="130" cy="130" r="15" fill="currentColor" />
                        <circle cx="70" cy="130" r="12" fill="currentColor" />
                        <path fill="currentColor" d="M60 90 L 20 60 L 40 40 L 80 80 Z" />
                        <rect x="20" y="30" width="30" height="20" rx="5" fill="currentColor" />
                    </svg>
                </div>

                {/* Control Buttons (Overlay or placed below machine) */}
                <div className="control-buttons-container">
                    <button
                        onClick={() => toggleMachineOperative(!machineInfo?.contact_indicator)}
                        className={`start-button ${machineInfo?.contact_indicator ? 'start-button-active' : 'start-button-inactive'}`}
                    >
                        {t('supervisor.start')}
                    </button>

                    <div className="right-buttons-group">
                        <button
                            onClick={() => toggleMachineOn(!machineInfo?.machine_on_status)}
                            className={`contact-button ${machineInfo?.machine_on_status ? 'contact-button-active' : 'contact-button-inactive'}`}
                        >
                            {t('supervisor.contact')}
                        </button>

                        <button
                            onClick={clearErrors}
                            className="clear-errors-button"
                        >
                            {t('supervisor.clearErrors')}
                        </button>
                    </div>
                </div>
            </div>

            {/* Bottom Instrument Cluster */}
            <div className="instrument-cluster">

                {/* Combustible */}
                <div className="instrument-panel">
                    <span className="instrument-label">{t('supervisor.fuel')}</span>
                    <div className="instrument-display">
                        <span className="instrument-value">{formatValue(machineInfo?.fuel_level)}</span>
                    </div>
                </div>

                {/* Velocidad */}
                <div className="instrument-panel-centered">
                    <span className="instrument-label-left">{t('supervisor.speed')}</span>
                    <div className="speed-circle">
                        <span className="speed-value">{formatSpeed(machineInfo?.speed)}</span>
                        <span className="speed-unit">m/s</span>
                    </div>
                </div>

                {/* RPM */}
                <div className="instrument-panel">
                    <span className="instrument-label">{t('supervisor.rpm')}</span>
                    <div className="instrument-display">
                        <span className="instrument-value">{formatValue(machineInfo?.rpm)}</span>
                    </div>
                </div>

                {/* Alerta Vuelco */}
                <div className="roll-alert-panel">
                    <span className="instrument-label">{t('supervisor.rollAlert')}</span>
                    <div className="roll-alert-content">
                        {/* Alarm Icon Placeholder */}
                        {machineInfo?.cell_load_95 ? (
                            <div className="roll-warning-active">
                                ⚠ {t('supervisor.rollover')}
                            </div>
                        ) : (
                            <div className="roll-warning-inactive">⚠</div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Supervisor;
