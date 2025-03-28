import { Server } from "socket.io";
import { io as Client } from "socket.io-client";
import { createServer } from "node:http";

const PORT = 8080;

// Create HTTP server
const httpServer = createServer();

// Create Socket.IO server
const io = new Server(httpServer);

// Create Socket.IO client
const client = Client(`http://localhost:${PORT}`);

// Server connection handling
io.on("connection", (socket) => {
  console.log("Client connected!");

  socket.on("message", (data) => {
    console.log("Server received:", data);
    // Echo the message back
    socket.emit("message", `Server echo: ${data}`);
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected!");
  });
});

// Client event handlers
client.on("connect", () => {
  console.log("Connected to server!");
  client.emit("message", "Hello from client!");
});

client.on("message", (data) => {
  console.log("Client received:", data);
});

client.on("disconnect", () => {
  console.log("📴 Client disconnected");
});

// Error handlers
client.on("connect_error", (error) => {
  console.error("Client connection error:", error);
});

// Start the server
httpServer.listen(PORT, () => {
  console.log(`\n🚀 Server is running on http://localhost:${PORT}`);
  console.log("ℹ️  Press Ctrl+C to stop the server\n");
});

// Graceful shutdown handling
const shutdown = async () => {
  console.log("\n🚨 Shutdown initiated");

  try {
    console.log("📝 Closing client connection...");
    client.close();

    console.log("📝 Closing server...");
    await new Promise<void>((resolve) => {
      io.close(() => {
        console.log("✅ Socket.IO server closed");
        resolve();
      });
    });

    await new Promise<void>((resolve) => {
      httpServer.close(() => {
        console.log("✅ HTTP server closed");
        resolve();
      });
    });

    console.log("👋 Graceful shutdown complete");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error during shutdown:", error);
    process.exit(1);
  }
};

// Register shutdown handlers
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
