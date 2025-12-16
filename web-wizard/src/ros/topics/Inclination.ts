import { useRosTopic } from '../hooks/useRosTopic';

export interface FilteredInclinMsg {
    primer_pitch_deg: number;
    primer_roll_deg: number;
    machine_pitch_deg: number;
    machine_roll_deg: number;
}

export const useInclination = () => {
    return useRosTopic<FilteredInclinMsg>({
        topicName: '/NAV/security_layer/filtered_inclin',
        messageType: 'enaex_msgs/FilteredInclin',
        throttleRate: 500
    });
};
