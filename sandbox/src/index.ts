import {
  WebSocketServer,
  WebSocketClient,
  ShutdownManager,
} from "websocket-gateway";

// Create a WebSocket server
const server = new WebSocketServer(8080);

// Create a WebSocket client
const client = new WebSocketClient("ws://localhost:8080", "client1");

// Set up shutdown manager with longer timeout and more detailed logging
const shutdownManager = new ShutdownManager({
  timeout: 15000,
  exitProcess: true,
  cleanup: async () => {
    console.log("🧹 Starting cleanup process...");
    try {
      // First close the client and wait for its "close" event
      console.log("📝 Initiating client shutdown...");
      const clientClosePromise = new Promise<void>((resolve, reject) => {
        // Add timeout to prevent hanging
        const timeoutId = setTimeout(() => {
          reject(new Error("Client close timeout"));
        }, 5000);

        const closeHandler = () => {
          clearTimeout(timeoutId);
          console.log("✅ Client connection closed event received");
          client.off("close", closeHandler);
          resolve();
        };
        client.on("close", closeHandler);
        client.close();
      });

      await clientClosePromise;
      console.log("✅ Client cleanup complete");

      // Then close the server and wait for its "close" event
      console.log("📝 Initiating server shutdown...");
      const serverClosePromise = new Promise<void>((resolve, reject) => {
        // Add timeout to prevent hanging
        const timeoutId = setTimeout(() => {
          reject(new Error("Server close timeout"));
        }, 5000);

        const closeHandler = () => {
          clearTimeout(timeoutId);
          console.log("✅ Server close event received");
          server.off("close", closeHandler);
          resolve();
        };
        server.on("close", closeHandler);
        server.close();
      });

      await serverClosePromise;
      console.log("✅ Server cleanup complete");
    } catch (error) {
      console.error("❌ Error during cleanup:", error);
      // Force close everything if there's an error
      client.terminate?.();
      server.close();
      throw error;
    }
  },
  onShutdown: () => {
    console.log("🚨 Shutdown initiated - starting graceful shutdown process");
    console.log("👋 Closing all connections...");
  },
});

// Add server and client to shutdown manager
shutdownManager.addServer(server);
shutdownManager.addClient(client);

// Register shutdown handlers (SIGINT, SIGTERM)
shutdownManager.registerShutdownHandlers();

// Normal connection handling
server.on("connection", (socket) => {
  console.log("Client connected!");
});

client.on("open", async () => {
  console.log("Connected to server!");
  client.send("Hello from client!");
});

client.on("message", async (data) => {
  console.log("Client received:", data);
});

// Update the client event handler to properly handle closure
client.on("close", async () => {
  console.log("📴 Client disconnected cleanly");
});

// Add server close handler
server.on("close", () => {
  console.log("📴 Server shut down cleanly");
});

// Add error handlers
server.on("error", (error) => {
  console.error("Server error:", error);
});

client.on("error", (error) => {
  console.error("Client error:", error);
});

// Log instructions for testing shutdown
console.log("\n🚀 Server and client are running");
console.log("ℹ️  Press Ctrl+C to test graceful shutdown\n");
