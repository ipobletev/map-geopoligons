import { useRosTopic } from '../hooks/useRosTopic';

export interface LogMessage {
    data: string;
}

export const useGuiInfo = () => {
    return useRosTopic<LogMessage>({
        topicName: '/GUI/gui_info',
        messageType: 'std_msgs/String'
    });
};

export const useGuiLogs = () => {
    return useRosTopic<LogMessage>({
        topicName: '/GUI/gui_logs',
        messageType: 'std_msgs/String'
    });
};
