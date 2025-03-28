import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { Server } from "socket.io";
import { io as Client } from "socket.io-client";
import { createServer } from "node:http";
import chalk from "chalk";
import { roomStore } from "../src/stores/socketRoomStore";

const log = {
	server: (...args: any[]) =>
		console.log(`${chalk.cyan("[server]")}`, ...args),
	client: (...args: any[]) =>
		console.log(`${chalk.yellow("[client]")}`, ...args),
	generic: (...args: any[]) =>
		console.log(`${chalk.blue("[test]")}`, ...args),
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
		roomStore.clear(); // Clear the store before each test
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

			client1.on("MESSAGE_ALL", messageHandler);
			client2.on("MESSAGE_ALL", messageHandler);
		});

		// Wait for both clients to connect
		await Promise.all([
			new Promise<void>((resolve) => client1.on("connect", resolve)),
			new Promise<void>((resolve) => client2.on("connect", resolve)),
		]);

		log.server("Broadcasting message...");
		io.emit("MESSAGE_ALL", {
			message: "Broadcast Test",
		});

		// Add timeout to messagesReceived promise
		const timeoutPromise = new Promise((_, reject) => {
			setTimeout(() => reject(new Error("Broadcast timeout")), 2000);
		});

		// Wait for both clients to receive the message or timeout
		try {
			await Promise.race([messagesReceived, timeoutPromise]);
			log.generic("✓ Broadcast test completed successfully");
			client1.close();
			client2.close();
		} catch (error) {
			log.generic("✗ Broadcast test failed:", error);
			client1.close();
			client2.close();
			throw error;
		}
	});

	test("Server can send message to specific client", () => {
		return new Promise<void>((done) => {
			const client1 = Client(`http://localhost:${PORT}`, {
				forceNew: true,
			});
			const client2 = Client(`http://localhost:${PORT}`, {
				forceNew: true,
			});

			let client2Id: string;

			io.on("connection", (socket) => {
				socket.on("register", (clientId) => {
					if (clientId === "client2") {
						client2Id = socket.id;
					}
				});
			});

			client2.on("MESSAGE_DIRECT", (data) => {
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
					io.to(client2Id).emit("MESSAGE_DIRECT", {
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
			const nodeClient = Client(`http://localhost:${PORT}`, {
				forceNew: true,
				auth: { clientType: "node" },
			});

			// Track received messages for figma clients
			let figmaMessagesReceived = 0;

			io.on("connection", (socket) => {
				const clientType = socket.handshake.auth.clientType;
				log.server(`Client ${socket.id} connected as ${clientType}`);
				socket.data.clientType = clientType;
				socket.join(clientType);

				socket.on("MESSAGE_TO_TYPE", ({ targetType, message }) => {
					log.server(
						`Sending message to ${targetType} from ${socket.data.clientType}`
					);
					io.to(targetType).emit("MESSAGE_FROM_TYPE", {
						fromType: socket.data.clientType,
						message,
					});
				});
			});

			// Set up listeners for Figma clients
			const figmaMessageHandler = (data: any) => {
				log.client(
					`Figma client received message: ${JSON.stringify(data)}`
				);
				expect(data.fromType).toBe("browser");
				expect(data.message).toBe("Hello Figma clients!");
				figmaMessagesReceived++;

				// Both Figma clients should receive the message
				if (figmaMessagesReceived === 2) {
					browserClient.close();
					figmaClient1.close();
					figmaClient2.close();
					nodeClient.close();
					done();
				}
			};

			figmaClient1.on("MESSAGE_FROM_TYPE", figmaMessageHandler);
			figmaClient2.on("MESSAGE_FROM_TYPE", figmaMessageHandler);

			// Node client should not receive Figma messages
			nodeClient.on("MESSAGE_FROM_TYPE", () => {
				throw new Error("Node client should not receive this message");
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
					nodeClient.on("connect", () => {
						log.client("Node client connected");
						resolve();
					});
				}),
			]).then(() => {
				log.client("Browser sending message to figma clients");
				browserClient.emit("MESSAGE_TO_TYPE", {
					targetType: "figma",
					message: "Hello Figma clients!",
				});
			});
		});
	}, 10000);

	test("Server can list all rooms and their members", async () => {
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

		// Set up connection handler to join rooms
		io.on("connection", (socket) => {
			const clientType = socket.handshake.auth.clientType;
			log.server(`Client ${socket.id} connected as ${clientType}`);
			socket.join(clientType);
		});

		// Helper function to get room details
		const getRoomDetails = async () => {
			const rooms = io.sockets.adapter.rooms;
			const roomDetails: { [key: string]: string[] } = {};

			for (const [room, sockets] of rooms.entries()) {
				// Skip socket ID rooms
				if (!io.sockets.sockets.has(room)) {
					roomDetails[room] = Array.from(sockets);
				}
			}

			return roomDetails;
		};

		// Wait for all clients to connect
		await Promise.all([
			new Promise<void>((resolve) =>
				browserClient.on("connect", resolve)
			),
			new Promise<void>((resolve) => figmaClient1.on("connect", resolve)),
			new Promise<void>((resolve) => figmaClient2.on("connect", resolve)),
		]);

		// Give Socket.IO time to process room assignments
		await new Promise((resolve) => setTimeout(resolve, 100));

		// Helper function to check if rooms are ready
		const areRoomsReady = async () => {
			const rooms = await getRoomDetails();
			return rooms.browser?.length === 1 && rooms.figma?.length === 2;
		};

		// Wait for rooms to be ready with timeout
		const waitForRooms = async (timeoutMs = 2000) => {
			const startTime = Date.now();
			while (Date.now() - startTime < timeoutMs) {
				if (await areRoomsReady()) {
					return true;
				}
				await new Promise((resolve) => setTimeout(resolve, 50)); // Small delay between checks
			}
			throw new Error("Rooms were not ready within timeout period");
		};

		// Replace the fixed timeout with a polling mechanism
		await waitForRooms();

		// Get and verify room details
		const rooms = await getRoomDetails();
		log.generic("Current room state:", rooms);

		// Verify room existence
		expect(rooms).toHaveProperty("browser");
		expect(rooms).toHaveProperty("figma");

		// Verify room sizes
		expect(rooms["browser"].length).toBe(1);
		expect(rooms["figma"].length).toBe(2);

		// Clean up
		browserClient.close();
		figmaClient1.close();
		figmaClient2.close();
	});

	test("Server tracks connected client types state correctly", async () => {
		// Set up subscription to room store first to see all changes
		const unsubscribe = roomStore.subscribe((rooms) => {
			log.generic("Room store state:", JSON.stringify(rooms, null, 2));
		});

		// Create clients but don't connect yet
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
		const nodeClient = Client(`http://localhost:${PORT}`, {
			forceNew: true,
			auth: { clientType: "node" },
		});

		// Track client IDs for verification
		const clientIds: Record<string, string> = {};

		// Set up connection handler
		io.on("connection", (socket) => {
			const clientType = socket.handshake.auth.clientType as string;
			socket.join(clientType);
			clientIds[socket.id] = clientType;
			log.server(`Client ${socket.id} connected as ${clientType}`);

			roomStore.addMember(clientType, {
				id: socket.id,
				clientType,
			});

			socket.on("disconnect", () => {
				log.server(`Client ${socket.id} disconnected`);
				roomStore.removeMember(clientType, socket.id);
			});
		});

		// Helper function to get room members
		const getRoomMembers = () => {
			const rooms = io.sockets.adapter.rooms;
			const roomMembers: Record<string, string[]> = {};

			for (const [room, sockets] of rooms.entries()) {
				// Skip socket ID rooms
				if (!io.sockets.sockets.has(room)) {
					roomMembers[room] = Array.from(sockets).map((socketId) => {
						const clientType = clientIds[socketId];
						return `${clientType}:${socketId}`;
					});
				}
			}
			return roomMembers;
		};

		// Connect all clients with minimal delay
		log.generic("Starting client connections...");
		await Promise.all([
			browserClient.connect(),
			figmaClient1.connect(),
			figmaClient2.connect(),
			nodeClient.connect(),
		]);
		await new Promise((resolve) => setTimeout(resolve, 50));

		// Verify initial state
		let rooms = getRoomMembers();
		expect(rooms.browser).toHaveLength(1);
		expect(rooms.figma).toHaveLength(2);
		expect(rooms.node).toHaveLength(1);

		// Disconnect clients with minimal delay
		log.generic("Disconnecting figma client 1...");
		figmaClient1.close();
		await new Promise((resolve) => setTimeout(resolve, 50));

		log.generic("Disconnecting browser client...");
		browserClient.close();
		await new Promise((resolve) => setTimeout(resolve, 50));

		rooms = getRoomMembers();
		expect(rooms.figma).toHaveLength(1);
		expect(rooms.browser).toBeUndefined();
		expect(rooms.node).toHaveLength(1);

		// Clean up remaining clients
		figmaClient2.close();
		nodeClient.close();
		unsubscribe();

		await new Promise((resolve) => setTimeout(resolve, 50));
	}, 5000); // Reduced timeout to 5 seconds
});
