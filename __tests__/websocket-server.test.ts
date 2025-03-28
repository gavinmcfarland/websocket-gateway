import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { Server } from "socket.io";
import { io as Client } from "socket.io-client";
import { createServer } from "node:http";
import chalk from "chalk";

const log = {
  server: (...args: any[]) => console.log(`${chalk.cyan("[server]")}`, ...args),
  client: (...args: any[]) =>
    console.log(`${chalk.yellow("[client]")}`, ...args),
};

// Force vitest to use chalk colors
chalk.level = 2;

describe("SocketIO Server", () => {
  let io: Server;
  let httpServer: ReturnType<typeof createServer>;
  const PORT = 8080;

  beforeEach(() => {
    log.server("Starting server on port", PORT);
    httpServer = createServer();
    io = new Server(httpServer);
    httpServer.listen(PORT);
    log.server("Server started");
  });

  afterEach(() => {
    io.close();
    httpServer.close();
  });

  test("Server starts and accepts connections", () => {
    return new Promise<void>((done) => {
      const client = Client(`http://localhost:${PORT}`, {
        forceNew: true,
      });

      io.on("connection", (socket) => {
        socket.on("test", (payload) => {
          expect(payload.message).toBe("Hello Server");
          client.close();
          done();
        });
      });

      client.on("connect", () => {
        setTimeout(() => {
          client.emit("test", { message: "Hello Server" });
        }, 100);
      });
    });
  });

  test("Server can broadcast messages", async () => {
    log.server("Starting broadcast test");

    const client1 = Client(`http://localhost:${PORT}`, { forceNew: true });
    const client2 = Client(`http://localhost:${PORT}`, { forceNew: true });

    // Create a promise that resolves when both clients receive the message
    const messagesReceived = new Promise<void>((resolve) => {
      let receivedCount = 0;
      const messageHandler = (data: any) => {
        log.client(`Received broadcast message:`, data);
        expect(data.message).toBe("Broadcast Test");
        receivedCount++;
        log.client(`Received count: ${receivedCount}`);
        if (receivedCount === 2) {
          resolve();
        }
      };

      client1.on("broadcast", messageHandler);
      client2.on("broadcast", messageHandler);
    });

    // Wait for both clients to connect
    await Promise.all([
      new Promise<void>((resolve) => client1.on("connect", resolve)),
      new Promise<void>((resolve) => client2.on("connect", resolve)),
    ]);

    log.server("Broadcasting message...");
    io.emit("broadcast", {
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
      client1.close();
      client2.close();
    } catch (error) {
      console.error("Test failed:", error);
      client1.close();
      client2.close();
      throw error;
    }
  });

  test("Server can send message to specific client", () => {
    return new Promise<void>((done) => {
      const client1 = Client(`http://localhost:${PORT}`, { forceNew: true });
      const client2 = Client(`http://localhost:${PORT}`, { forceNew: true });

      let client2Id: string;

      io.on("connection", (socket) => {
        socket.on("register", (clientId) => {
          if (clientId === "client2") {
            client2Id = socket.id;
          }
        });
      });

      client2.on("directMessage", (data) => {
        expect(data.message).toBe("Direct Message Test");
        client1.close();
        client2.close();
        done();
      });

      Promise.all([
        new Promise<void>((resolve) => client1.on("connect", resolve)),
        new Promise<void>((resolve) => client2.on("connect", resolve)),
      ]).then(() => {
        client1.emit("register", "client1");
        client2.emit("register", "client2");

        setTimeout(() => {
          io.to(client2Id).emit("directMessage", {
            message: "Direct Message Test",
          });
        }, 100);
      });
    });
  });

  test("Client can send message to specific client type", () => {
    return new Promise<void>((done) => {
      const browserClient = Client(`http://localhost:${PORT}`, {
        forceNew: true,
        auth: { clientType: "browser" },
      });
      const figmaClient1 = Client(`http://localhost:${PORT}`, {
        forceNew: true,
        auth: { clientType: "figma" },
      });
      const figmaClient2 = Client(`http://localhost:${PORT}`, {
        forceNew: true,
        auth: { clientType: "figma" },
      });
      const vscodeClient = Client(`http://localhost:${PORT}`, {
        forceNew: true,
        auth: { clientType: "vscode" },
      });

      // Track received messages for figma clients
      let figmaMessagesReceived = 0;

      io.on("connection", (socket) => {
        const clientType = socket.handshake.auth.clientType;
        log.server(`Client ${socket.id} connected as ${clientType}`);
        socket.data.clientType = clientType;
        socket.join(clientType);

        socket.on("message_to_type", ({ targetType, message }) => {
          log.server(
            `Sending message to ${targetType} from ${socket.data.clientType}`
          );
          io.to(targetType).emit("typed_message", {
            fromType: socket.data.clientType,
            message,
          });
        });
      });

      // Set up listeners for Figma clients
      const figmaMessageHandler = (data: any) => {
        log.client(`Figma client received message: ${JSON.stringify(data)}`);
        expect(data.fromType).toBe("browser");
        expect(data.message).toBe("Hello Figma clients!");
        figmaMessagesReceived++;

        // Both Figma clients should receive the message
        if (figmaMessagesReceived === 2) {
          browserClient.close();
          figmaClient1.close();
          figmaClient2.close();
          vscodeClient.close();
          done();
        }
      };

      figmaClient1.on("typed_message", figmaMessageHandler);
      figmaClient2.on("typed_message", figmaMessageHandler);

      // VSCode client should not receive Figma messages
      vscodeClient.on("typed_message", () => {
        throw new Error("VSCode client should not receive this message");
      });

      // Wait for all clients to connect
      Promise.all([
        new Promise<void>((resolve) => {
          browserClient.on("connect", () => {
            log.client("Browser client connected");
            resolve();
          });
        }),
        new Promise<void>((resolve) => {
          figmaClient1.on("connect", () => {
            log.client("Figma client 1 connected");
            resolve();
          });
        }),
        new Promise<void>((resolve) => {
          figmaClient2.on("connect", () => {
            log.client("Figma client 2 connected");
            resolve();
          });
        }),
        new Promise<void>((resolve) => {
          vscodeClient.on("connect", () => {
            log.client("VSCode client connected");
            resolve();
          });
        }),
      ]).then(() => {
        setTimeout(() => {
          log.server("Sending message from browser to figma clients");
          browserClient.emit("message_to_type", {
            targetType: "figma",
            message: "Hello Figma clients!",
          });
        }, 100);
      });
    });
  }, 10000);
});
