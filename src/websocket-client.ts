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
    this.ws.addEventListener("message", (event) => this._handleMessage(event));

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
        this.ws.send(JSON.stringify({ type, source: this.source, ...payload }));
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
  public on(event: string, callback: (data: any) => void | Promise<void>) {
    if (typeof window !== "undefined") {
      (this.eventSystem as EventTarget).addEventListener(event, async (e) => {
        const result = await Promise.resolve(
          callback((e as CustomEvent).detail)
        );
        if (result !== undefined) {
          this.send(`${event}:response`, { result });
        }
      });
    } else {
      (this.eventSystem as EventEmitter).on(event, async (data) => {
        const result = await Promise.resolve(callback(data));
        if (result !== undefined) {
          this.send(`${event}:response`, { result });
        }
      });
    }
  }

  /**
   * Remove an event listener for the specified event
   * @param event The event name to stop listening to
   * @param callback The callback function to remove
   */
  public off(event: string, callback: (data: any) => void | Promise<void>) {
    if (typeof window !== "undefined") {
      (this.eventSystem as EventTarget).removeEventListener(
        event,
        callback as EventListener
      );
    } else {
      (this.eventSystem as EventEmitter).off(event, callback);
    }
  }

  // Close the WebSocket connection
  public close() {
    if (this.ws) {
      this.ws.close();
    }

    // Clear any queued messages
    this.queue = [];

    // Remove all event listeners if using EventEmitter
    if (this.eventSystem instanceof EventEmitter) {
      this.eventSystem.removeAllListeners();
    }
  }

  /**
   * Force closes the WebSocket connection immediately without waiting for the closing handshake.
   * This should be used only in emergency situations or when a normal close is not possible.
   */
  public terminate() {
    if (this.ws) {
      // Force close with code 1000 (normal closure)
      this.ws.close(1000, "Terminated");
    }

    // Clear any queued messages
    this.queue = [];

    // Remove all event listeners if using EventEmitter
    if (this.eventSystem instanceof EventEmitter) {
      this.eventSystem.removeAllListeners();
    }
  }

  /**
   * Listen for a custom event once. The listener will be automatically removed after being triggered.
   * @param event The event name to listen to
   * @param callback The callback function to execute when the event occurs
   */
  public once(event: string, callback: (data: any) => void | Promise<void>) {
    if (typeof window !== "undefined") {
      const wrappedCallback = async (e: Event) => {
        (this.eventSystem as EventTarget).removeEventListener(
          event,
          wrappedCallback
        );
        const result = await Promise.resolve(
          callback((e as CustomEvent).detail)
        );
        if (result !== undefined) {
          this.send(`${event}:response`, { result });
        }
      };
      (this.eventSystem as EventTarget).addEventListener(
        event,
        wrappedCallback
      );
    } else {
      (this.eventSystem as EventEmitter).once(event, async (data) => {
        const result = await Promise.resolve(callback(data));
        if (result !== undefined) {
          this.send(`${event}:response`, { result });
        }
      });
    }
  }
}
