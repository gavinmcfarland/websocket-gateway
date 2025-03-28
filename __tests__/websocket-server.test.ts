import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { createServer as createHttpServer } from "node:http";
import chalk from "chalk";
import { roomStore } from "../src/stores/socketRoomStore";
import { createClient } from "../sandbox/src/client/utils/client-factory";
import { createServer } from "../sandbox/src/server/utils/server-factory";
import type { SocketServer } from "../sandbox/src/server/utils/server-factory";

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
	let io: SocketServer;
	let httpServer: ReturnType<typeof createHttpServer>;
	const PORT = 8080;

	beforeEach(() => {
		log.server("Starting server on port", PORT);
		httpServer = createHttpServer();
		io = createServer({
			httpServer,
			cors: {
				origin: "*",
			},
			serverOptions: {
				// Add any additional Socket.IO options here
			},
		});
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
			const client = createClient({ source: "test", port: PORT });

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

		const client1 = createClient({ source: "test1", port: PORT });
		const client2 = createClient({ source: "test2", port: PORT });

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
			const client1 = createClient({
				source: "client1",
				port: PORT,
			});
			const client2 = createClient({
				source: "client2",
				port: PORT,
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
			const browserClient = createClient({
				source: "browser",
				port: PORT,
			});
			const figmaClient1 = createClient({
				source: "figma",
				port: PORT,
			});
			const figmaClient2 = createClient({
				source: "figma",
				port: PORT,
			});
			const nodeClient = createClient({
				source: "node",
				port: PORT,
			});

			// Track received messages for figma clients
			let figmaMessagesReceived = 0;

			io.on("connection", (socket) => {
				const source = socket.handshake.auth.source;
				log.server(`Client ${socket.id} connected as ${source}`);

				// Helper function to route messages
				const routeMessage = (eventName: string, message: any) => {
					io.route(socket, eventName, {
						...message,
						source,
					});
				};

				// Specific event handling
				socket.on("LOAD_CONTENT", (message) => {
					log.server(`Received LOAD_CONTENT from ${source}`);
					routeMessage("CONTENT_LOADED", message);
				});
			});

			// Set up listeners for Figma clients
			const figmaMessageHandler = (data: any) => {
				log.client(
					`Figma client received content: ${JSON.stringify(data)}`
				);
				expect(data.source).toBe("browser");
				expect(data.content).toBe("Updated design content");
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

			figmaClient1.on("CONTENT_LOADED", figmaMessageHandler);
			figmaClient2.on("CONTENT_LOADED", figmaMessageHandler);

			// Node client should not receive Figma messages
			nodeClient.on("CONTENT_LOADED", () => {
				throw new Error("Node client should not receive this message");
			});

			// Wait for all clients to connect
			Promise.all([
				new Promise<void>((resolve) =>
					browserClient.on("connect", resolve)
				),
				new Promise<void>((resolve) =>
					figmaClient1.on("connect", resolve)
				),
				new Promise<void>((resolve) =>
					figmaClient2.on("connect", resolve)
				),
				new Promise<void>((resolve) =>
					nodeClient.on("connect", resolve)
				),
			]).then(() => {
				log.client("Browser sending content update to figma clients");
				browserClient.emit("LOAD_CONTENT", {
					target: "figma",
					content: "Updated design content",
				});

				// Test that node client can't send to figma clients
				nodeClient.emit("LOAD_CONTENT", {
					target: "figma",
					content: "This should not be received",
				});
			});
		});
	}, 10000);

	test("Server can list all rooms and their members", async () => {
		const browserClient = createClient({
			source: "browser",
			port: PORT,
		});
		const figmaClient1 = createClient({
			source: "figma",
			port: PORT,
		});
		const figmaClient2 = createClient({
			source: "figma",
			port: PORT,
		});

		// Set up connection handler to join rooms
		io.on("connection", (socket) => {
			const source = socket.handshake.auth.source;
			log.server(`Client ${socket.id} connected as ${source}`);
			socket.join(source);
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
		const browserClient = createClient({
			source: "browser",
			port: PORT,
		});
		const figmaClient1 = createClient({
			source: "figma",
			port: PORT,
		});
		const figmaClient2 = createClient({
			source: "figma",
			port: PORT,
		});
		const nodeClient = createClient({ source: "node", port: PORT });

		// Track client IDs for verification
		const clientIds: Record<string, string> = {};

		// Set up connection handler
		io.on("connection", (socket) => {
			const source = socket.handshake.auth.source as string;
			socket.join(source);
			clientIds[socket.id] = source;
			log.server(`Client ${socket.id} connected as ${source}`);

			roomStore.addMember(source, {
				id: socket.id,
				source: source,
			});

			socket.on("disconnect", () => {
				log.server(`Client ${socket.id} disconnected`);
				roomStore.removeMember(source, socket.id);
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
						const source = clientIds[socketId];
						return `${source}:${socketId}`;
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
