import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { createServer as createHttpServer } from "node:http";
import chalk from "chalk";
import { createClient } from "../src/client";
import { createServer } from "../src/server";
import type { SocketServer } from "../src/server";

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
	});

	afterEach(() => {
		io.close();
		httpServer.close();
	});

	test("Server starts and accepts connections", () => {
		return new Promise<void>((done) => {
			const client = createClient({
				room: "test",
				port: PORT,
			});

			client.on("connect", () => {
				log.generic("Client connected successfully");
				expect(client.connected).toBe(true);
				client.close();
				done();
			});
		});
	});

	test("Server can broadcast messages", async () => {
		return new Promise<void>((done) => {
			const client1 = createClient({
				room: "test",
				port: PORT,
			});
			const client2 = createClient({
				room: "test",
				port: PORT,
			});

			let messagesReceived = 0;
			const messageHandler = (data: any) => {
				log.client(`Received broadcast: ${JSON.stringify(data)}`);
				expect(data.content).toBe("Broadcast test");
				messagesReceived++;

				if (messagesReceived === 2) {
					client1.close();
					client2.close();
					done();
				}
			};

			client1.on("ANY_EVENT", messageHandler);
			client2.on("ANY_EVENT", messageHandler);

			// Wait for both clients to connect
			Promise.all([
				new Promise<void>((resolve) => client1.on("connect", resolve)),
				new Promise<void>((resolve) => client2.on("connect", resolve)),
			]).then(() => {
				// Broadcast to all clients
				io.emit("ANY_EVENT", { content: "Broadcast test" });
			});
		});
	});

	test("Server can send message to specific client", () => {
		return new Promise<void>((done) => {
			const client1 = createClient({
				room: "figma",
				port: PORT,
			});
			const client2 = createClient({
				room: "browser",
				port: PORT,
			});

			let client1ReceivedMessage = false;

			client1.on("CUSTOM_EVENT", (data) => {
				log.client(
					`Client 1 received message: ${JSON.stringify(data)}`
				);
				expect(data.content).toBe("Direct message test");
				client1ReceivedMessage = true;
			});

			client2.on("CUSTOM_EVENT", () => {
				// This should never be called
				expect(true).toBe(false);
			});

			Promise.all([
				new Promise<void>((resolve) => client1.on("connect", resolve)),
				new Promise<void>((resolve) => client2.on("connect", resolve)),
			]).then(() => {
				// Get client1's socket ID and send direct message
				const socketId = client1.id;
				if (!socketId) throw new Error("Socket ID not found");
				io.to(socketId).emit("CUSTOM_EVENT", {
					content: "Direct message test",
				});

				// Give some time to ensure message delivery
				setTimeout(() => {
					expect(client1ReceivedMessage).toBe(true);
					client1.close();
					client2.close();
					done();
				}, 1000);
			});
		});
	});

	test("Server can list all rooms and their members", async () => {
		return new Promise<void>((done) => {
			const client1 = createClient({
				room: "figma",
				port: PORT,
			});
			const client2 = createClient({
				room: "browser",
				port: PORT,
			});
			const client3 = createClient({
				room: "test",
				port: PORT,
			});

			Promise.all([
				new Promise<void>((resolve) => client1.on("connect", resolve)),
				new Promise<void>((resolve) => client2.on("connect", resolve)),
				new Promise<void>((resolve) => client3.on("connect", resolve)),
			]).then(async () => {
				const sockets = await io.fetchSockets();
				const rooms = new Set<string>();

				for (const socket of sockets) {
					for (const room of socket.rooms) {
						rooms.add(room);
					}
				}

				// Each socket automatically joins a room with its own ID
				// plus the room we specified, so we expect more than 2 rooms
				expect(rooms.size).toBeGreaterThan(2);
				expect(rooms.has("figma")).toBe(true);
				expect(rooms.has("browser")).toBe(true);
				expect(rooms.has("test")).toBe(true);

				client1.close();
				client2.close();
				client3.close();
				done();
			});
		});
	});

	test("Server tracks connected client types state correctly", async () => {
		return new Promise<void>((done) => {
			const browserClient = createClient({
				room: "browser",
				port: PORT,
			});
			const figmaClient = createClient({
				room: "figma",
				port: PORT,
			});

			Promise.all([
				new Promise<void>((resolve) =>
					browserClient.on("connect", resolve)
				),
				new Promise<void>((resolve) =>
					figmaClient.on("connect", resolve)
				),
			]).then(async () => {
				const sockets = await io.fetchSockets();
				const rooms = new Set<string>();

				for (const socket of sockets) {
					for (const room of socket.rooms) {
						rooms.add(room);
					}
				}

				expect(rooms.has("browser")).toBe(true);
				expect(rooms.has("figma")).toBe(true);

				// Disconnect one client and verify room is still maintained
				browserClient.close();

				setTimeout(async () => {
					const socketsAfterDisconnect = await io.fetchSockets();
					const roomsAfterDisconnect = new Set<string>();

					for (const socket of socketsAfterDisconnect) {
						for (const room of socket.rooms) {
							roomsAfterDisconnect.add(room);
						}
					}

					expect(roomsAfterDisconnect.has("browser")).toBe(false);
					expect(roomsAfterDisconnect.has("figma")).toBe(true);

					figmaClient.close();
					done();
				}, 1000);
			});
		});
	}, 5000);

	test("Client can send message to specific room", () => {
		return new Promise<void>((done) => {
			const browserClient = createClient({
				room: "browser",
				port: PORT,
			});
			const figmaClient1 = createClient({
				room: "figma",
				port: PORT,
			});
			const figmaClient2 = createClient({
				room: "figma",
				port: PORT,
			});
			const nodeClient = createClient({
				room: "test",
				port: PORT,
			});

			// Track received messages for figma clients
			let figmaMessagesReceived = 0;

			// Set up listeners for Figma clients
			const figmaMessageHandler = (data: any) => {
				log.client(
					`---- Figma client received content: ${JSON.stringify(
						data
					)}`
				);
				expect(data.from).toBe("browser");
				expect(data.content).toBe("Updated design content");
				figmaMessagesReceived++;

				// Both Figma clients should receive the message
				if (figmaMessagesReceived === 1) {
					browserClient.close();
					figmaClient1.close();
					figmaClient2.close();
					done();
				}
			};

			figmaClient1.on("ANY_EVENT", figmaMessageHandler);
			figmaClient2.on("ANY_EVENT", figmaMessageHandler);

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
				browserClient.emit("ANY_EVENT", {
					room: "figma",
					content: "Updated design content",
				});

				nodeClient.emit("ANY_EVENT", {
					room: "browser",
					content: "Should not be received by figma clients",
				});
			});
		});
	}, 10000);
});
