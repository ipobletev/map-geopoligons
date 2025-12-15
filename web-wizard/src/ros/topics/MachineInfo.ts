import { useRosTopic } from '../hooks/useRosTopic';

// Based on zeus_37_msgs/Zeus37Info (implied from python code)
export interface MachineInfoMsg {
    speed: number;
    rpm: number;
    fuel_level: number;
    main_battery_voltage: number;
    cell_load_95: boolean;
    contact_indicator: boolean;
    machine_on_status: boolean; // machine_on state
    mode_op_autonomous: boolean;
    mode_op_manual: boolean;
    in_ros_emergency_stop: boolean;
    estop_rc: boolean;
    estop_dieci: boolean;
    estop_remote_dieci: boolean;
    emergency_stop_code: { code: number };
}

export const useMachineInfo = () => {
    return useRosTopic<MachineInfoMsg>({
        topicName: '/MACHINE/info',
        messageType: 'zeus_37_msgs/Zeus37Info',
        throttleRate: 100 // 10hz max
    });
};
