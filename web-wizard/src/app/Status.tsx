
import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { usePrimerInfo } from '../ros/topics/PrimerInfo';
import { useInclination } from '../ros/topics/Inclination';
import { useMachineInfo } from '../ros/topics/MachineInfo';
import {
    Fuel, Battery, Thermometer, Droplet,
    Settings
} from 'lucide-react';

// --- Sub-components ---

// 1. Dieci Info Icon Button
const DieciIcon = ({
    icon: Icon, label, alert = false
}: {
    icon: any, label: string, alert?: boolean
}) => (
    <div className="flex flex-col items-center">
        <div className={`
w-20 h-20 rounded-lg border-2 flex items-center justify-center mb-1 bg-white shadow-sm
            ${alert ? 'border-red-500 text-red-500 bg-red-50' : 'border-gray-400 text-gray-600'}
`}>
            <Icon size={40} strokeWidth={1.5} />
        </div>
        <span className={`text-sm font-medium text-center leading-tight max-w-[100px] ${alert ? 'text-red-600' : 'text-gray-600'} `}>{label}</span>
    </div>
);

// 2. Inclination Box
const InclinationBox = ({ label, value }: { label: string, value: string | number }) => (
    <div className="flex flex-col items-center justify-center w-36 h-24 bg-white rounded-xl border border-gray-300 shadow-sm">
        <span className="text-sm font-medium text-gray-600 mb-1 text-center px-1 leading-tight">{label}</span>
        <span className="text-2xl font-bold text-gray-800">{value}°</span>
    </div>
);

// 3. Sensor Status Item
const SensorItem = ({ label, status = 'idle' }: { label: string, status?: 'ok' | 'error' | 'idle' }) => {
    // Default / Idle styling
    let bg = 'bg-white border-gray-300 text-gray-600';

    // Status logic (can be expanded)
    if (status === 'error') bg = 'bg-red-100 border-red-500 text-red-700';
    if (status === 'ok') bg = 'bg-[#e6f4ea] border-[#1e8e3e] text-[#1e8e3e]';

    return (
        <div className={`border rounded px-3 py-1.5 text-sm font-medium shadow-sm text-center mb-2 transition-colors ${bg} `}>
            {label}
        </div>
    );
};

// 4. Input Field Display
const InfoField = ({ label, value }: { label: string, value: string | number }) => (
    <div className="flex flex-col mb-4">
        <div className="bg-white border border-gray-400 rounded-lg h-12 px-4 flex items-center justify-between shadow-sm">
            <span className="text-slate-700 font-medium whitespace-nowrap mr-4">{label}</span>
            <span className="font-mono font-bold text-lg text-slate-800">{value}</span>
        </div>
    </div>
);

const NumberDisplay = ({ value }: { value: number | string }) => (
    <div className="bg-slate-700 text-white font-mono text-4xl px-4 py-1 rounded border-2 border-slate-500 shadow-inner min-w-[80px] text-center">
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
    <div className={`
w-14 h-8 flex items-center justify-center rounded border border-gray-800 text-sm font-bold shadow-sm transition-colors
        ${active ? 'bg-[#1B8819] text-white' : 'bg-white text-gray-800'}
`}>
        {label}
    </div>
);

const Status: React.FC = () => {
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
            <div className="flex flex-col gap-4">
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
            <div className="flex gap-6 bg-slate-50 p-6 rounded-2xl border border-slate-100 shadow-inner">
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
            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 shadow-inner flex flex-col items-center gap-6">
                <div className="flex gap-6">
                    {/* Col 1: 1..7 */}
                    <div className="flex flex-col gap-4">
                        {Array.from({ length: 7 }).map((_, i) => (
                            <GridItem key={i} label={startIdx + i + 1} active={items[i]} />
                        ))}
                    </div>
                    {/* Col 2: 9..15 */}
                    <div className="flex flex-col gap-4">
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
        <div className="flex flex-col h-full bg-[#e6e7eb] p-6 gap-6 font-sans text-slate-800 overflow-hidden">

            {/* TOP SECTION: Dieci Info & Titles */}
            <div className="flex items-start justify-between z-10 shrink-0">
                {/* Icons Group */}
                <div className="flex flex-col gap-2">
                    <h3 className="text-gray-600 font-medium ml-1">{t('status.dieciInfo')}</h3>
                    <div className="flex gap-6">
                        <DieciIcon icon={Fuel} label={t('status.fuel')} alert={fuelLow} />
                        <DieciIcon icon={Battery} label={t('status.battery')} alert={batteryLow} />
                        <DieciIcon icon={Thermometer} label={t('status.tempAlert')} alert={tempAlert} />
                        <DieciIcon icon={Droplet} label={t('status.oilPressureAlert')} alert={oilAlert} />
                    </div>
                </div>

                {/* Inclination Dieci */}
                <div className="flex gap-4 items-end">
                    <InclinationBox label={t('status.rollInclination')} value={inclinationData?.machine_roll_deg?.toFixed(1) ?? '0.0'} />
                    <InclinationBox label={t('status.pitchInclination')} value={inclinationData?.machine_pitch_deg?.toFixed(1) ?? '0.0'} />
                </div>
            </div>

            {/* SPLIT SECTION */}
            <div className="flex flex-1 gap-6 min-h-0">

                {/* LEFT COLUMN: Sensors Sidebar */}
                <div className="w-52 flex flex-col gap-3 overflow-y-auto pr-1">
                    <h3 className="text-gray-600 font-medium flex items-center justify-between">
                        {t('status.sensorsInfo')}
                        <Settings size={16} className="text-blue-500" />
                    </h3>

                    {/* Laser Group */}
                    <div className="bg-white rounded-xl p-3 shadow-sm border border-gray-200">
                        <h4 className="text-xs font-bold uppercase text-gray-400 mb-2">{t('status.laser')}</h4>
                        <div className="flex flex-col gap-2">
                            <SensorItem label={t('status.laserRight')} />
                            <SensorItem label={t('status.laserLeft')} />
                            <SensorItem label={t('status.laserFront')} />
                            <SensorItem label={t('status.laserRear')} />
                        </div>
                    </div>

                    {/* IMU Group */}
                    <div className="bg-white rounded-xl p-3 shadow-sm border border-gray-200">
                        <h4 className="text-xs font-bold uppercase text-gray-400 mb-2">{t('status.imu')}</h4>
                        <div className="flex flex-col gap-2">
                            <SensorItem label={t('status.imuRight')} />
                            <SensorItem label={t('status.imuLeft')} />
                            <SensorItem label={t('status.imuFront')} />
                            <SensorItem label={t('status.imuRear')} />
                        </div>
                    </div>

                    {/* Others Group */}
                    <div className="bg-white rounded-xl p-3 shadow-sm border border-gray-200">
                        <h4 className="text-xs font-bold uppercase text-gray-400 mb-2">{t('status.others')}</h4>
                        <div className="flex flex-col gap-2">
                            <SensorItem label={t('status.primer')} />
                            <SensorItem label={t('status.porometer')} />
                            <SensorItem label={t('status.gnss')} />
                        </div>
                    </div>
                </div>

                {/* CENTRE/RIGHT COLUMN */}
                <div className="flex-1 flex flex-col gap-6 min-w-0">

                    {/* Primer Information Container */}
                    <div className="bg-gray-200 rounded-lg flex flex-1 min-h-0 border border-gray-300 shadow-sm overflow-hidden flex-col">
                        <div className="bg-white px-4 py-2 border-b border-gray-300">
                            <h3 className="text-lg font-medium text-slate-700">{t('status.primerInfo')}</h3>
                        </div>

                        <div className="flex flex-1 min-h-0">
                            {/* Vertical Tabs */}
                            <div className="w-12 bg-gray-300 flex flex-col pt-2 border-r border-gray-400 shrink-0 gap-y-1 rounded-tl-lg rounded-bl-lg h-full">
                                {[
                                    { id: 'general', label: t('status.general') },
                                    { id: 'racks_spoolers', label: t('status.racksSpoolers') },
                                    { id: 'racks_colihues', label: t('status.racksColihues') },
                                    { id: 'racks_booster', label: t('status.racksBooster') }
                                ].map(tab => (
                                    <button
                                        key={tab.id}
                                        onClick={() => setActivePrimerTab(tab.id as any)}
                                        className={`flex-grow flex items-center justify-center text-sm font-bold tracking-wide transition-colors
                                            ${activePrimerTab === tab.id
                                                ? 'bg-[#e6e7eb] text-slate-800'
                                                : 'text-gray-500 hover:bg-gray-200'
                                            }`}
                                        style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
                                    >
                                        {tab.label}
                                    </button>
                                ))}
                            </div>

                            {/* Content Area */}
                            <div className="flex-1 p-6 bg-[#e6e7eb] overflow-hidden flex flex-col">

                                {activePrimerTab === 'general' && (
                                    <div className="flex flex-row w-full h-full gap-8">
                                        {/* Counts Card - Takes up available space */}
                                        <div className="flex-[3] bg-white p-8 rounded-3xl shadow-sm border border-slate-200 flex flex-col justify-between">
                                            <h4 className="text-xl font-bold text-slate-700 border-b border-gray-100 pb-4">{t('status.generalCounts')}</h4>
                                            <div className="flex flex-col flex-1 justify-center gap-4">
                                                <InfoField label={t('status.spoolersRight')} value={primerData?.spooler_count_right ?? '-'} />
                                                <InfoField label={t('status.spoolersLeft')} value={primerData?.spooler_count_left ?? '-'} />
                                                <InfoField label={t('status.boosterRight')} value={primerData?.booster_count_right ?? '-'} />
                                                <InfoField label={t('status.boosterLeft')} value={primerData?.booster_count_left ?? '-'} />
                                                <InfoField label={t('status.colihues')} value={primerData?.stick_count ?? '-'} />
                                            </div>
                                        </div>

                                        {/* Controls/Inclination Card - Takes up sidebar space but fills height */}
                                        <div className="flex-[2] flex flex-col gap-6 p-8 bg-white rounded-3xl shadow-sm border border-slate-200 justify-between">
                                            <div>
                                                <h4 className="text-xl font-bold text-slate-700 w-full text-center border-b border-gray-100 pb-4 mb-8">{t('status.inclinometer')}</h4>
                                                <div className="flex flex-col gap-8 items-center">
                                                    <InclinationBox label={t('status.rollInclination')} value={inclinationData?.primer_roll_deg?.toFixed(1) ?? '0.0'} />
                                                    <InclinationBox label={t('status.pitchInclination')} value={inclinationData?.primer_pitch_deg?.toFixed(1) ?? '0.0'} />
                                                </div>
                                            </div>

                                            <div className="w-full">
                                                <button className="w-full h-24 bg-[#0055cb] hover:bg-blue-700 active:scale-95 text-white font-bold rounded-2xl shadow-lg shadow-blue-500/30 transition-all duration-200 text-center text-xl leading-tight flex items-center justify-center whitespace-pre-wrap">
                                                    {t('status.checkCalibration')}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {activePrimerTab === 'racks_spoolers' && (
                                    <div className="flex w-full h-full gap-8">
                                        <div className="flex-1 flex flex-col items-center p-8 bg-white rounded-3xl shadow-sm border border-slate-200 justify-between">
                                            <span className="text-slate-700 font-bold text-2xl border-b border-gray-100 w-full text-center pb-4">{t('status.rackRight')}</span>
                                            <div className="flex-1 flex items-center justify-center w-full">
                                                {renderSpoolerPanel(0)}
                                            </div>
                                        </div>
                                        <div className="flex-1 flex flex-col items-center p-8 bg-white rounded-3xl shadow-sm border border-slate-200 justify-between">
                                            <span className="text-slate-700 font-bold text-2xl border-b border-gray-100 w-full text-center pb-4">{t('status.rackLeft')}</span>
                                            <div className="flex-1 flex items-center justify-center w-full">
                                                {renderSpoolerPanel(15)}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {activePrimerTab === 'racks_colihues' && (
                                    <div className="flex w-full h-full bg-white p-12 rounded-3xl border border-slate-200 shadow-xl flex-col">
                                        <h4 className="text-xl font-bold text-slate-700 text-center border-b border-gray-100 pb-4 shrink-0">{t('status.colihuesStatus')}</h4>
                                        <div className="flex-1 flex items-center justify-center gap-12 w-full">
                                            {[0, 10, 20].map(offset => (
                                                <div key={offset} className="flex flex-col justify-between h-[80%]">
                                                    {Array.from({ length: 10 }).map((_, i) => (
                                                        <GridItem key={i} label={offset + i + 1} active={false} />
                                                    ))}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {activePrimerTab === 'racks_booster' && (
                                    <div className="flex w-full h-full gap-8">
                                        <div className="flex-1 flex flex-col items-center p-8 bg-white rounded-3xl shadow-sm border border-slate-200 justify-between">
                                            <span className="text-slate-700 font-bold text-2xl border-b border-gray-100 w-full text-center pb-4">{t('status.rackRight')}</span>
                                            <div className="flex-1 flex items-center justify-center w-full">
                                                {renderBoosterPanel(0)}
                                            </div>
                                        </div>
                                        <div className="flex-1 flex flex-col items-center p-8 bg-white rounded-3xl shadow-sm border border-slate-200 justify-between">
                                            <span className="text-slate-700 font-bold text-2xl border-b border-gray-100 w-full text-center pb-4">{t('status.rackLeft')}</span>
                                            <div className="flex-1 flex items-center justify-center w-full">
                                                {renderBoosterPanel(15)}
                                            </div>
                                        </div>
                                    </div>
                                )}

                            </div>
                        </div>
                    </div>

                    {/* Batteries Section */}
                    <div className="bg-white border border-gray-300 rounded-lg p-5 shadow-sm shrink-0">
                        <h3 className="text-lg font-medium text-slate-600 mb-4 ml-2">{t('status.batteriesInfo')}</h3>
                        <div className="flex gap-8 px-4 justify-center">
                            <div className="bg-slate-500 rounded-lg p-1 pr-4 pl-4 flex items-center gap-6 shadow-inset justify-between w-[400px]">
                                <span className="text-white font-medium text-lg">{t('status.mainBatteryVoltage')}</span>
                                <NumberDisplay value={machineData?.main_battery_voltage?.toFixed(1) ?? '24.0'} />
                            </div>
                            <div className="bg-slate-500 rounded-lg p-1 pr-4 pl-4 flex items-center gap-6 shadow-inset justify-between w-[400px]">
                                <span className="text-white font-medium text-lg">{t('status.auxBatteryVoltage')}</span>
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
