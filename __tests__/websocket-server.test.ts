import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { WebSocketServer, WebSocketClient } from "../dist";

describe("WebSocketServer", () => {
  let server: WebSocketServer;
  const PORT = 8080;

  beforeEach(() => {
    console.log("Starting server on port", PORT);
    server = new WebSocketServer(PORT);
    console.log("Server started");
  });

  afterEach(() => {
    server.close();
  });

  test("Server starts and accepts connections", () => {
    return new Promise<void>((done) => {
      const client = new WebSocketClient(
        `ws://localhost:${PORT}`,
        "testClient"
      );

      server.on("test", ({ source, payload }) => {
        expect(source).toBe("testClient");
        expect(payload.message).toBe("Hello Server");
        done();
      });

      setTimeout(() => {
        client.send("test", { message: "Hello Server" });
      }, 100);
    });
  });

  test("Server can broadcast messages", async () => {
    console.log("Starting broadcast test");

    // Add server message logging
    server.on("register", (data) => {
      console.log("Server received register from:", data.source);
    });

    const client1 = new WebSocketClient(`ws://localhost:${PORT}`, "client1");
    const client2 = new WebSocketClient(`ws://localhost:${PORT}`, "client2");

    // Log WebSocket state changes using the public 'on' method
    client1.on("open", async () => {
      console.log("Client 1 WebSocket opened");
    });
    client2.on("open", async () => {
      console.log("Client 2 WebSocket opened");
    });

    // Add error handlers
    client1.on("error", async (error) => {
      console.error("Client 1 error:", error);
    });
    client2.on("error", async (error) => {
      console.error("Client 2 error:", error);
    });

    // Add close handlers
    client1.on("close", async (data) => {
      console.log("Client 1 closed:", data);
    });
    client2.on("close", async (data) => {
      console.log("Client 2 closed:", data);
    });

    // Create a promise that resolves when both clients receive the message
    const messagesReceived = new Promise<void>((resolve) => {
      let receivedCount = 0;
      const messageHandler = async (data: any) => {
        console.log(`Client received broadcast message:`, data);
        expect(data.message).toBe("Broadcast Test");
        receivedCount++;
        console.log(`Received count: ${receivedCount}`);
        if (receivedCount === 2) {
          resolve();
        }
      };

      client1.on("broadcast", messageHandler);
      client2.on("broadcast", messageHandler);
    });

    // Add logging to connection process
    await Promise.all([
      new Promise<void>((resolve) => {
        client1.on("open", async () => {
          console.log("Client 1 connected");
          client1.send("register", {}).then(() => {
            console.log("Client 1 registered");
            resolve();
          });
        });
      }),
      new Promise<void>((resolve) => {
        client2.on("open", async () => {
          console.log("Client 2 connected");
          client2.send("register", {}).then(() => {
            console.log("Client 2 registered");
            resolve();
          });
        });
      }),
    ]);

    // Add a small delay to ensure registrations are processed
    console.log("Waiting for registration processing...");
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Broadcast the message
    console.log("Broadcasting message...");
    server.broadcast("broadcast", {
      message: "Broadcast Test",
    });

    // Add timeout to messagesReceived promise
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error("Broadcast timeout")), 2000);
    });

    // Wait for both clients to receive the message or timeout
    try {
      await Promise.race([messagesReceived, timeoutPromise]);
      console.log("Test completed successfully");
    } catch (error) {
      console.error("Test failed:", error);
      throw error;
    }
  });

  test("Server can send message to specific client", () => {
    return new Promise<void>((done) => {
      const client1 = new WebSocketClient(`ws://localhost:${PORT}`, "client1");
      const client2 = new WebSocketClient(`ws://localhost:${PORT}`, "client2");

      client2.on("directMessage", async (data) => {
        expect(data.message).toBe("Direct Message Test");
        done();
      });

      setTimeout(() => {
        client1.send("register", {});
        client2.send("register", {});

        setTimeout(() => {
          server.sendTo("client2", "directMessage", {
            message: "Direct Message Test",
          });
        }, 100);
      }, 100);
    });
  });
});
