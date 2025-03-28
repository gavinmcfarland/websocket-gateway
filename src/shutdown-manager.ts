import { WebSocketServer } from "./websocket-server";
import { WebSocketClient } from "./websocket-client";
import { EventEmitter } from "node:events";

/**
 * Configuration options for the ShutdownManager
 */
interface ShutdownOptions {
  /** Timeout in milliseconds before forcing shutdown */
  timeout?: number;
  /** Whether to exit the process after shutdown */
  exitProcess?: boolean;
  /** Custom cleanup function to run before shutdown */
  cleanup?: () => Promise<void>;
  /** Callback function that runs when shutdown is initiated */
  onShutdown?: () => void;
}

/**
 * Manages graceful shutdown of WebSocket servers and clients
 */
export class ShutdownManager extends EventEmitter {
  private servers: WebSocketServer[] = [];
  private clients: WebSocketClient[] = [];
  private isShuttingDown = false;
  private options: Required<ShutdownOptions>;

  constructor(options: ShutdownOptions = {}) {
    super();
    this.options = {
      timeout: options.timeout ?? 5000,
      exitProcess: options.exitProcess ?? true,
      cleanup: options.cleanup ?? (async () => {}),
      onShutdown: options.onShutdown ?? (() => {}),
    };
  }

  /**
   * Add a WebSocket server to be managed
   */
  public addServer(server: WebSocketServer): void {
    this.servers.push(server);
  }

  /**
   * Add a WebSocket client to be managed
   */
  public addClient(client: WebSocketClient): void {
    this.clients.push(client);
  }

  /**
   * Start listening for shutdown signals
   */
  public registerShutdownHandlers(): void {
    process.on("SIGINT", () => this.shutdown());
    process.on("SIGTERM", () => this.shutdown());
  }

  /**
   * Initiate graceful shutdown of all managed connections
   */
  public async shutdown(): Promise<void> {
    if (this.isShuttingDown) {
      return;
    }

    this.isShuttingDown = true;
    console.log("🚨 Shutdown initiated - starting graceful shutdown process");

    try {
      // Call the onShutdown callback
      this.options.onShutdown();

      // Run custom cleanup if provided
      await this.options.cleanup();

      // Create promises for all clients and servers
      const clientPromises = this.clients.map((client) => {
        return new Promise<void>((resolve, reject) => {
          const clientTimeout = setTimeout(() => {
            reject(
              new Error(`Client ${client.source} failed to close in time`)
            );
          }, this.options.timeout);

          client.once("close", () => {
            clearTimeout(clientTimeout);
            resolve();
          });

          client.close();
        });
      });

      const serverPromises = this.servers.map((server) => {
        return new Promise<void>((resolve, reject) => {
          const serverTimeout = setTimeout(() => {
            reject(new Error(`Server failed to close in time`));
          }, this.options.timeout);

          server.once("close", () => {
            clearTimeout(serverTimeout);
            resolve();
          });

          server.close();
        });
      });

      // Wait for all clients and servers to close with timeout
      await Promise.all([
        Promise.all(clientPromises).catch((error) => {
          console.warn(
            "Warning: Some clients failed to close properly -",
            error.message
          );
        }),
        Promise.all(serverPromises).catch((error) => {
          console.warn(
            "Warning: Some servers failed to close properly -",
            error.message
          );
        }),
      ]);

      this.completeShutdown();
    } catch (error) {
      console.error("Error during shutdown:", error);
      this.forceExit();
    }
  }

  private completeShutdown(): void {
    console.log("✅ Graceful shutdown completed");
    this.emit("shutdown");

    if (this.options.exitProcess) {
      process.exit(0);
    }
  }

  private forceExit(): void {
    process.exit(1);
  }
}
