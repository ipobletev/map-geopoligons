import { useEffect, useState } from 'react';
import * as ROSLIB from 'roslib';
import RosConnection from '../RosConnection';

interface UseRosTopicProps {
    topicName: string;
    messageType: string;
    throttleRate?: number;
}

export const useRosTopic = <T>(props: UseRosTopicProps) => {
    const [data, setData] = useState<T | null>(null);
    const [isConnected, setIsConnected] = useState(false);

    useEffect(() => {
        const connection = RosConnection.getInstance();
        const ros = connection.getRos();

        const checkConnection = () => {
            setIsConnected(ros.isConnected);
        };

        connection.on('connection', checkConnection);
        connection.on('close', checkConnection);
        checkConnection(); // Initial check

        const topic = new ROSLIB.Topic({
            ros: ros,
            name: props.topicName,
            messageType: props.messageType,
            throttle_rate: props.throttleRate
        });

        const handleMessage = (message: any) => {
            setData(message as T);
        };

        topic.subscribe(handleMessage);

        return () => {
            topic.unsubscribe(handleMessage);
            connection.off('connection', checkConnection);
            connection.off('close', checkConnection);
        };
    }, [props.topicName, props.messageType]);

    return { data, isConnected };
};
