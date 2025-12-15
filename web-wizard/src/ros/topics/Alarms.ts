import { useRosTopic } from '../hooks/useRosTopic';

export interface WarnMessage {
    data: string;
}

export const useWarnMessage = () => {
    return useRosTopic<WarnMessage>({
        topicName: '/GUI/warn_message',
        messageType: 'std_msgs/String'
    });
};

// Emergency stop msg is likely used for popups, but for now we observe it.
// Python code also subscribes to /GUI/emergency_stop (TempStopCodes)
export interface TempStopCodes {
    id: number;
    data: boolean;
}

export const useEmergencyStop = () => {
    return useRosTopic<TempStopCodes>({
        topicName: '/GUI/temporal_stop_msg', // Check common.yaml line 50. It says '/GUI/temporal_stop_msg' maps to inclination_emergency_topic
        messageType: 'enaex_msgs/TempStopCodes'
    });
}
