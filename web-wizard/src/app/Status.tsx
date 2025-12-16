
import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { usePrimerInfo } from '../ros/topics/PrimerInfo';
import { useInclination } from '../ros/topics/Inclination';
import { useMachineInfo } from '../ros/topics/MachineInfo';
import {
    Fuel, Battery, Thermometer, Droplet
} from 'lucide-react';
import '../styles/components/Status.css';

// --- Sub-components ---

// 1. Dieci Info Icon Button
const DieciIcon = ({
    icon: Icon, label, alert = false
}: {
    icon: any, label: string, alert?: boolean
}) => (
    <div className="dieci-icon-container">
        <div className={`dieci-icon-box ${alert ? 'dieci-icon-box-alert' : 'dieci-icon-box-normal'}`}>
            <Icon size={40} strokeWidth={1.5} />
        </div>
        <span className={`dieci-icon-label ${alert ? 'dieci-icon-label-alert' : 'dieci-icon-label-normal'}`}>{label}</span>
    </div>
);

// 2. Inclination Box
const InclinationBox = ({ label, value }: { label: string, value: string | number }) => (
    <div className="inclination-box">
        <span className="inclination-label">{label}</span>
        <span className="inclination-value">{value}°</span>
    </div>
);

// 3. Sensor Status Item
const SensorItem = ({ label, status = 'idle' }: { label: string, status?: 'ok' | 'error' | 'idle' }) => {
    // Default / Idle styling
    let statusClass = 'sensor-item-idle';

    // Status logic
    if (status === 'error') statusClass = 'sensor-item-error';
    if (status === 'ok') statusClass = 'sensor-item-ok';

    return (
        <div className={`sensor-item ${statusClass}`}>
            {label}
        </div>
    );
};

// 4. Input Field Display
const InfoField = ({ label, value }: { label: string, value: string | number }) => (
    <div className="info-field-container">
        <div className="info-field-box">
            <span className="info-field-label">{label}</span>
            <span className="info-field-value">{value}</span>
        </div>
    </div>
);

const NumberDisplay = ({ value }: { value: number | string }) => (
    <div className="number-display">
        {value}
    </div>
);

// --- Helper Functions ---
const unpackBits = (byte: number): boolean[] => {
    const bits: boolean[] = [];
    for (let i = 0; i < 8; i++) {
        bits.push(((byte >> i) & 1) === 1);
    }
    return bits;
};

// --- Layout Helpers ---
const GridItem = ({ label, active }: { label: string | number, active: boolean }) => (
    <div className={`grid-item ${active ? 'grid-item-active' : 'grid-item-inactive'}`}>
        {label}
    </div>
);

const Status: React.FC<{ isConnected: boolean }> = ({ isConnected }) => {
    const { t } = useTranslation();
    const { data: primerData } = usePrimerInfo();
    const { data: inclinationData } = useInclination();
    const { data: machineData } = useMachineInfo();

    // UI State
    const [activePrimerTab, setActivePrimerTab] = useState<'general' | 'racks_spoolers' | 'racks_colihues' | 'racks_booster'>('general');

    // Derived Data
    const fuelLow = (machineData?.fuel_level ?? 100) < 20;
    const batteryLow = (machineData?.main_battery_voltage ?? 24) < 12.5;
    const tempAlert = false;
    const oilAlert = false;

    const statusBits = useMemo(() => {
        if (!primerData) return { sp: [], cg: [] };

        const bytes = [
            primerData.byte_0, primerData.byte_1, primerData.byte_2, primerData.byte_3,
            primerData.byte_4, primerData.byte_5, primerData.byte_6, primerData.byte_7
        ];

        const allBits = bytes.flatMap(unpackBits);

        // sp: 1-30 are bits 0-29
        const sp = allBits.slice(0, 30);

        // cg: 1-30 are bits 31-60 (approximate mapping based on file analysis)
        // Bit 31 is byte_3[7] (cg_1)
        // Bits 32-39 are byte_4 (cg_2..9) etc.
        // Let's manually construct cg based on information_manager.py logic logic
        const b3 = unpackBits(primerData.byte_3);
        const b4 = unpackBits(primerData.byte_4);
        const b5 = unpackBits(primerData.byte_5);
        const b6 = unpackBits(primerData.byte_6);
        const b7 = unpackBits(primerData.byte_7);

        const cg = [
            b3[7],         // cg_1
            ...b4,         // cg_2..9
            ...b5,         // cg_10..17
            ...b6,         // cg_18..25
            ...b7.slice(0, 5) // cg_26..30
        ];

        return { sp, cg };
    }, [primerData]);

    // RENDER HELPERS
    // Spooler Grid Helper (Columns: 15..11, 10..6, 5..1)
    const renderSpoolerPanel = (startIdx: number) => {
        // Assume startIdx = 0 for Left Panel (Items 1-15), startIdx = 15 for Right Panel (Items 16-30)
        // VISUAL: Image shows Panel 1 has 15,14,13.. (Col 1), 10.. (Col 2), 5.. (Col 1)
        // LOGIC: We map bits `startIdx` to `startIdx + 14`

        // Column 1 (displayed left): Buttons 5, 4, 3, 2, 1?
        // Image shows: Left Panel
        // Col 1 (Leftmost): 15, 14, 13, 12, 11
        // Col 2 (Middle)  : 10, 9, 8, 7, 6
        // Col 3 (Rightmost): 5, 4, 3, 2, 1

        const renderColumn = (topNum: number, count: number) => (
            <div className="spooler-column">
                {Array.from({ length: count }).map((_, i) => {
                    const num = topNum - i; // e.g. 15, 14, 13
                    // array index (0-based) for num (1-based) is num - 1
                    // But if we are in second panel (16-30), num is e.g. 30.
                    const active = statusBits.sp[num - 1] ?? false;
                    return <GridItem key={num} label={num} active={active} />;
                })}
            </div>
        );

        const offset = startIdx === 0 ? 0 : 15;

        return (
            <div className="spooler-panel">
                {/* Columns are inverted visually (left to right: High to low numbers? Wait)
                     Image 1: 
                     Left Panel ("Rack Derecho"??)
                     Col 1: 15..11
                     Col 2: 10..6
                     Col 3: 5..1
                 */}
                {renderColumn(15 + offset, 5)}
                {renderColumn(10 + offset, 5)}
                {renderColumn(5 + offset, 5)}
            </div>
        );
    };

    // Booster Grid Helper
    const renderBoosterPanel = (startIdx: number) => {
        // Image 3:
        // Col 1: 1..7
        // Col 2: 9..15
        // Bottom Center: 8
        const items = statusBits.cg.slice(startIdx, startIdx + 15);

        // items[0] is cg_1 (or cg_16)
        // we map items 0..6 to Col 1 (1..7)
        // item 7 is '8'
        // items 8..14 to Col 2 (9..15)

        return (
            <div className="booster-panel">
                <div className="booster-columns-container">
                    {/* Col 1: 1..7 */}
                    <div className="booster-column">
                        {Array.from({ length: 7 }).map((_, i) => (
                            <GridItem key={i} label={startIdx + i + 1} active={items[i]} />
                        ))}
                    </div>
                    {/* Col 2: 9..15 */}
                    <div className="booster-column">
                        {Array.from({ length: 7 }).map((_, i) => (
                            <GridItem key={i} label={startIdx + i + 1 + 8} active={items[i + 8]} />
                        ))}
                    </div>
                </div>
                {/* Item 8 */}
                <GridItem key="8" label={startIdx + 8} active={items[7]} />
            </div>
        );
    };


    return (
        <div className="status-container">
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

            {/* TOP SECTION: Dieci Info & Titles */}
            <div className="status-top-section">
                {/* Icons Group */}
                <div className="dieci-section">
                    <h3 className="dieci-title">{t('status.dieciInfo')}</h3>
                    <div className="dieci-icons-wrapper">
                        <DieciIcon icon={Fuel} label={t('status.fuel')} alert={fuelLow} />
                        <DieciIcon icon={Battery} label={t('status.battery')} alert={batteryLow} />
                        <DieciIcon icon={Thermometer} label={t('status.tempAlert')} alert={tempAlert} />
                        <DieciIcon icon={Droplet} label={t('status.oilPressureAlert')} alert={oilAlert} />
                    </div>
                </div>

                {/* Inclination Dieci */}
                <div className="inclination-wrapper">
                    <InclinationBox label={t('status.rollInclination')} value={inclinationData?.machine_roll_deg?.toFixed(1) ?? '0.0'} />
                    <InclinationBox label={t('status.pitchInclination')} value={inclinationData?.machine_pitch_deg?.toFixed(1) ?? '0.0'} />
                </div>
            </div>

            {/* SPLIT SECTION */}
            <div className="status-mid-section">

                {/* LEFT COLUMN: Sensors Sidebar */}
                <div className="status-sidebar">
                    <h3 className="sidebar-section-title">
                        {t('status.sensorsInfo')}
                    </h3>

                    {/* Laser Group */}
                    <div className="sensor-group">
                        <h4 className="sensor-group-title">{t('status.laser')}</h4>
                        <div className="sensor-list">
                            <SensorItem label={t('status.laserRight')} />
                            <SensorItem label={t('status.laserLeft')} />
                            <SensorItem label={t('status.laserFront')} />
                            <SensorItem label={t('status.laserRear')} />
                        </div>
                    </div>

                    {/* IMU Group */}
                    <div className="sensor-group">
                        <h4 className="sensor-group-title">{t('status.imu')}</h4>
                        <div className="sensor-list">
                            <SensorItem label={t('status.imuRight')} />
                            <SensorItem label={t('status.imuLeft')} />
                            <SensorItem label={t('status.imuFront')} />
                            <SensorItem label={t('status.imuRear')} />
                        </div>
                    </div>

                    {/* Others Group */}
                    <div className="sensor-group">
                        <h4 className="sensor-group-title">{t('status.others')}</h4>
                        <div className="sensor-list">
                            <SensorItem label={t('status.primer')} />
                            <SensorItem label={t('status.porometer')} />
                            <SensorItem label={t('status.gnss')} />
                        </div>
                    </div>
                </div>

                {/* CENTRE/RIGHT COLUMN */}
                <div className="status-main-content">

                    {/* Primer Information Container */}
                    <div className="primer-container">
                        <div className="primer-header">
                            <h3 className="primer-header-title">{t('status.primerInfo')}</h3>
                        </div>

                        <div className="primer-content-wrapper">
                            {/* Vertical Tabs */}
                            <div className="vertical-tabs-container">
                                {[
                                    { id: 'general', label: t('status.general') },
                                    { id: 'racks_spoolers', label: t('status.racksSpoolers') },
                                    { id: 'racks_colihues', label: t('status.racksColihues') },
                                    { id: 'racks_booster', label: t('status.racksBooster') }
                                ].map(tab => (
                                    <button
                                        key={tab.id}
                                        onClick={() => setActivePrimerTab(tab.id as any)}
                                        className={`vertical-tab
                                            ${activePrimerTab === tab.id
                                                ? 'vertical-tab-active'
                                                : ''
                                            }`}
                                    >
                                        {tab.label}
                                    </button>
                                ))}
                            </div>

                            {/* Content Area */}
                            <div className="primer-main-content">

                                {activePrimerTab === 'general' && (
                                    <div className="tab-content-container">
                                        {/* Counts Card - Takes up available space */}
                                        <div className="general-card">
                                            <h4 className="card-title">{t('status.generalCounts')}</h4>
                                            <div className="general-info-list">
                                                <InfoField label={t('status.spoolersRight')} value={primerData?.spooler_count_right ?? '-'} />
                                                <InfoField label={t('status.spoolersLeft')} value={primerData?.spooler_count_left ?? '-'} />
                                                <InfoField label={t('status.boosterRight')} value={primerData?.booster_count_right ?? '-'} />
                                                <InfoField label={t('status.boosterLeft')} value={primerData?.booster_count_left ?? '-'} />
                                                <InfoField label={t('status.colihues')} value={primerData?.stick_count ?? '-'} />
                                            </div>
                                        </div>

                                        {/* Controls/Inclination Card - Takes up sidebar space but fills height */}
                                        <div className="controls-card">
                                            <div>
                                                <h4 className="inclinometer-title">{t('status.inclinometer')}</h4>
                                                <div className="inclinometer-group">
                                                    <InclinationBox label={t('status.rollInclination')} value={inclinationData?.primer_roll_deg?.toFixed(1) ?? '0.0'} />
                                                    <InclinationBox label={t('status.pitchInclination')} value={inclinationData?.primer_pitch_deg?.toFixed(1) ?? '0.0'} />
                                                </div>
                                            </div>

                                            <div className="w-full">
                                                <button className="check-calibration-btn">
                                                    {t('status.checkCalibration')}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {activePrimerTab === 'racks_spoolers' && (
                                    <div className="flex w-full h-full gap-8">
                                        <div className="rack-container">
                                            <span className="rack-title">{t('status.rackRight')}</span>
                                            <div className="panel-wrapper">
                                                {renderSpoolerPanel(0)}
                                            </div>
                                        </div>
                                        <div className="rack-container">
                                            <span className="rack-title">{t('status.rackLeft')}</span>
                                            <div className="panel-wrapper">
                                                {renderSpoolerPanel(15)}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {activePrimerTab === 'racks_colihues' && (
                                    <div className="colihues-container">
                                        <h4 className="colihues-title">{t('status.colihuesStatus')}</h4>
                                        <div className="colihues-grid">
                                            {[0, 10, 20].map(offset => (
                                                <div key={offset} className="colihues-column">
                                                    {Array.from({ length: 10 }).map((_, i) => (
                                                        <GridItem key={i} label={offset + i + 1} active={false} />
                                                    ))}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {activePrimerTab === 'racks_booster' && (
                                    <div className="flex w-full h-full gap-1">
                                        <div className="rack-container-booster">
                                            <span className="rack-title-booster">{t('status.rackRight')}</span>
                                            <div className="panel-wrapper">
                                                {renderBoosterPanel(0)}
                                            </div>
                                        </div>
                                        <div className="rack-container-booster">
                                            <span className="rack-title-booster">{t('status.rackLeft')}</span>
                                            <div className="panel-wrapper">
                                                {renderBoosterPanel(15)}
                                            </div>
                                        </div>
                                    </div>
                                )}

                            </div>
                        </div>
                    </div>

                    {/* Batteries Section */}
                    <div className="batteries-section">
                        <h3 className="batteries-title">{t('status.batteriesInfo')}</h3>
                        <div className="batteries-wrapper">
                            <div className="battery-item">
                                <span className="battery-label">{t('status.mainBatteryVoltage')}</span>
                                <NumberDisplay value={machineData?.main_battery_voltage?.toFixed(1) ?? '24.0'} />
                            </div>
                            <div className="battery-item">
                                <span className="battery-label">{t('status.auxBatteryVoltage')}</span>
                                <NumberDisplay value={(machineData as any)?.aux_battery_voltage?.toFixed(1) ?? '24.0'} />
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
};

export default Status;
