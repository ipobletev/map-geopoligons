import { useRosTopic } from '../hooks/useRosTopic';

export interface PrimerInfoMsg {
    spooler_id: number;
    byte_0: number;
    byte_1: number;
    byte_2: number;
    byte_3: number;
    byte_4: number;
    byte_5: number;
    byte_6: number;
    byte_7: number;
    spooler_count_right: number;
    spooler_count_left: number;
    booster_count_right: number;
    booster_count_left: number;
    stick_count: number;
    primer_error_code: { code: number };
    level_probe_error_code: { code: number };
}

export const usePrimerInfo = () => {
    return useRosTopic<PrimerInfoMsg>({
        topicName: '/PRIMER/info',
        messageType: 'zeus_37_msgs/PrimerInfo',
        throttleRate: 1000 // Update once per second is likely sufficient for UI
    });
};
