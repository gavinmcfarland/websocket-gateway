import WebSocket, { WebSocketServer as WSServer } from "ws";
import { EventEmitter } from "events";

interface Client {
	ws: WebSocket;
	source: string;
	isAlive: boolean;
}

export class WebSocketServer {
	private wss: WSServer;
	private clients: Map<string, Client>;
	private eventSystem: EventEmitter;
	private pingInterval: NodeJS.Timeout;

	constructor(port: number) {
		this.wss = new WSServer({ port });
		this.clients = new Map();
		this.eventSystem = new EventEmitter();

		this.wss.on("connection", this._handleConnection.bind(this));

		this.pingInterval = setInterval(this._pingClients.bind(this), 30000);

		// console.log(`WebSocket Server started on port ${port}`);
	}

	private _handleConnection(ws: WebSocket): void {
		// console.log("New client connected");

		ws.on("pong", () => {
			for (const client of this.clients.values()) {
				if (client.ws === ws) {
					client.isAlive = true;
					break;
				}
			}
		});

		ws.on("message", (message: string) => {
			try {
				const data = JSON.parse(message.toString());
				const { type, source, ...payload } = data;

				if (!this.clients.has(source)) {
					this.clients.set(source, { ws, source, isAlive: true });
					console.log(`Client registered: ${source}`);
				} else {
					const existingClient = this.clients.get(source)!;
					if (existingClient.ws !== ws) {
						existingClient.ws = ws;
						existingClient.isAlive = true;
						console.log(`Client reconnected: ${source}`);
					}
				}

				this.eventSystem.emit(type, { source, payload });
			} catch (error) {
				console.error("Error handling message:", error);
			}
		});

		ws.on("close", () => {
			for (const client of this.clients.values()) {
				if (client.ws === ws) {
					client.isAlive = false;
					console.log(`Client connection closed: ${client.source}`);
					break;
				}
			}
		});
	}

	private _pingClients(): void {
		this.clients.forEach((client, source) => {
			if (client.ws.readyState === WebSocket.OPEN) {
				if (!client.isAlive) {
					this.clients.delete(source);
					console.log(`Client removed due to inactivity: ${source}`);
					return;
				}

				client.isAlive = false;
				client.ws.ping();
			}
		});
	}

	// Send message to a specific client
	public sendTo(source: string, type: string, payload: any = {}): void {
		const client = this.clients.get(source);
		if (client && client.ws.readyState === WebSocket.OPEN) {
			const message = JSON.stringify({ type, ...payload });
			client.ws.send(message);
		}
	}

	// Broadcast message to all connected clients
	public broadcast(
		type: string,
		payload: any = {},
		excludeSource?: string
	): void {
		console.log(`Broadcasting message type ${type} to all clients`);
		console.log("Current clients:", Array.from(this.clients.keys()));

		const message = JSON.stringify({ type, ...payload });
		this.clients.forEach((client, source) => {
			if (
				source !== excludeSource &&
				client.ws.readyState === WebSocket.OPEN
			) {
				console.log(`Sending broadcast to client: ${source}`);
				client.ws.send(message);
			}
		});
	}

	// Listen for custom events
	public on(event: string, callback: (data: any) => void): void {
		this.eventSystem.on(event, callback);
	}

	// Close the server
	public close(): void {
		clearInterval(this.pingInterval);
		this.wss.close();
	}
}
