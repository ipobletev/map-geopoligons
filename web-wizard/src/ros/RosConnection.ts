import * as ROSLIB from 'roslib';
import EventEmitter from 'eventemitter3';

class RosConnection extends EventEmitter {
    private static instance: RosConnection;
    public ros: ROSLIB.Ros;
    private isConnected: boolean = false;
    private url: string = 'ws://localhost:9090';

    private constructor() {
        super();
        this.ros = new ROSLIB.Ros({
            url: this.url
        });

        this.setupListeners();
    }

    public static getInstance(): RosConnection {
        if (!RosConnection.instance) {
            RosConnection.instance = new RosConnection();
        }
        return RosConnection.instance;
    }

    private setupListeners(): void {
        this.ros.on('connection', () => {
            console.log('Connected to websocket server.');
            this.isConnected = true;
            this.emit('connection');
        });

        this.ros.on('error', (error) => {
            console.log('Error connecting to websocket server: ', error);
            this.emit('error', error);
        });

        this.ros.on('close', () => {
            console.log('Connection to websocket server closed.');
            this.isConnected = false;
            this.emit('close');

            // Auto reconnect attempt after 3 seconds
            setTimeout(() => {
                if (!this.isConnected) {
                    this.connect();
                }
            }, 3000);
        });
    }

    public connect(url?: string): void {
        if (url) {
            this.url = url;
        }

        // Check if already connected or connecting
        if (this.ros.isConnected) return;

        try {
            this.ros.connect(this.url);
        } catch (e) {
            console.error("Failed to connect:", e);
        }
    }

    public getRos(): ROSLIB.Ros {
        return this.ros;
    }
}

export default RosConnection;
