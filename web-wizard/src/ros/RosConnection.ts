import * as ROSLIB from 'roslib';
import EventEmitter from 'eventemitter3';

class RosConnection extends EventEmitter {
    private static instance: RosConnection;
    public ros: ROSLIB.Ros;
    private isConnected: boolean = false;
    private url: string = 'ws://localhost:9090';
    private CONNECTING_INTERVAL = 10000; // 10 seconds
    private CONNECTING_DISPLAY_TIMEOUT = 3000;

    private constructor() {
        super();

        // Load from localStorage if available
        const savedUrl = localStorage.getItem('ros_url');
        if (savedUrl) {
            this.url = savedUrl;
        }

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

            // Auto reconnect sequence
            setTimeout(() => {
                if (!this.isConnected) {
                    this.connect();
                }
            }, this.CONNECTING_INTERVAL);
        });
    }

    public connect(url?: string): void {
        if (url) {
            this.url = url;
            localStorage.setItem('ros_url', url);
        }

        // Emit connecting event immediately for UI feedback
        this.emit('connecting');

        // If URL changed or we want to force reconnect
        if (this.ros.isConnected) {
            this.ros.close();
        }

        try {
            console.log(`Connecting to ${this.url}...`);
            this.ros.connect(this.url);

            // Enforce visual timeout: if not connected within timeout, cancel attempt
            setTimeout(() => {
                if (!this.isConnected) {
                    console.log('Connection timed out, forcing close.');
                    this.ros.close();
                }
            }, this.CONNECTING_DISPLAY_TIMEOUT);

        } catch (e) {
            console.error("Failed to connect:", e);
        }
    }

    public getUrl(): string {
        return this.url;
    }

    public getRos(): ROSLIB.Ros {
        return this.ros;
    }
}

export default RosConnection;
