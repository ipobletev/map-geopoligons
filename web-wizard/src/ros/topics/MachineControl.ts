import * as ROSLIB from 'roslib';
import RosConnection from '../RosConnection';

export const toggleMachineOn = (state: boolean) => {
    const connection = RosConnection.getInstance();
    const topic = new ROSLIB.Topic({
        ros: connection.getRos(),
        name: '/GUI/machine_on',
        messageType: 'std_msgs/Bool'
    });
    const msg = new (ROSLIB as any).Message({ data: state });
    topic.publish(msg);
};

export const toggleMachineOperative = (state: boolean) => {
    const connection = RosConnection.getInstance();
    const topic = new ROSLIB.Topic({
        ros: connection.getRos(),
        name: '/GUI/machine_start',
        messageType: 'std_msgs/Bool'
    });
    const msg = new (ROSLIB as any).Message({ data: state });
    topic.publish(msg);
};
