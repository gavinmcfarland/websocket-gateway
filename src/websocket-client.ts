import ReconnectingWebSocket from "reconnecting-websocket";
import { EventEmitter } from "events";

export class WebSocketClient {
	url: string;
	source: string;
	private queue: any[];
	private ws: ReconnectingWebSocket;
	private eventSystem: EventEmitter | EventTarget;

	constructor(url: string, source: string) {
		this.url = url;
		this.source = source;
		this.queue = [];
		this.ws = new ReconnectingWebSocket(url);

		// Listen for WebSocket open event to flush any queued messages
		this.ws.addEventListener("open", () => {
			this._flushQueue();
			if (this.eventSystem instanceof EventEmitter) {
				this.eventSystem.emit("open", {});
			} else {
				const event = new CustomEvent("open", { detail: {} });
				this.eventSystem.dispatchEvent(event);
			}
		});

		// Listen for WebSocket message events and handle them
		this.ws.addEventListener("message", (event) =>
			this._handleMessage(event)
		);

		// Initialize event system (EventEmitter for Node.js, EventTarget for Browser)
		if (typeof window !== "undefined") {
			this.eventSystem = new EventTarget(); // Browser-specific
		} else {
			this.eventSystem = new (require("events").EventEmitter)(); // Node.js-specific
		}
	}

	// Flush any queued messages when the connection is open
	private _flushQueue() {
		this.queue.forEach(({ type, payload, resolve, reject }) => {
			if (this.ws.readyState === WebSocket.OPEN) {
				this.ws.send(
					JSON.stringify({ type, source: this.source, ...payload })
				);
				resolve();
			} else {
				this.queue.push({ type, payload, resolve, reject });
			}
		});
		this.queue = [];
	}

	// Handle incoming messages and trigger events
	private _handleMessage(event: MessageEvent) {
		const data = JSON.parse(event.data);
		console.log("Received:", data);

		// Trigger custom event based on message type
		if (this.eventSystem instanceof EventEmitter) {
			this.eventSystem.emit(data.type, data);
		} else {
			// Browser EventTarget
			const customEvent = new CustomEvent(data.type, { detail: data });
			this.eventSystem.dispatchEvent(customEvent);
		}
	}

	// Wrapper for sending messages that checks the condition specific to the message
	public send(type: string, payload: any = {}): Promise<void> {
		return new Promise((resolve, reject) => {
			const message = JSON.stringify({
				type,
				source: this.source,
				...payload,
			});

			// Send the message immediately if conditions are met
			if (this.ws.readyState === WebSocket.OPEN) {
				this.ws.send(message);
				resolve();
			} else {
				// Queue message if WebSocket is not open
				this.queue.push({
					type,
					payload,
					resolve,
					reject,
				});
			}
		});
	}

	// Listen for custom events
	public on(event: string, callback: (data: any) => Promise<void>) {
		if (typeof window !== "undefined") {
			(this.eventSystem as EventTarget).addEventListener(
				event,
				async (e) => {
					const result = await callback((e as CustomEvent).detail);
					if (result !== undefined) {
						this.send(`${event}:response`, { result });
					}
				}
			);
		} else {
			(this.eventSystem as EventEmitter).on(event, async (data) => {
				const result = await callback(data);
				if (result !== undefined) {
					this.send(`${event}:response`, { result });
				}
			});
		}
	}
}
