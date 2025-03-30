import { createServer } from "node:http";
import * as fs from "node:fs";
import { dirname, join } from "node:path";
import { roomStore } from "./shared/store";
import { createSocketServer } from "websocket-gateway/server";
import { fileURLToPath } from "node:url";

// Create HTTP server
const httpServer = createServer((req, res) => {
	const __filename = fileURLToPath(import.meta.url);
	const __dirname = dirname(__filename);

	if (req.url === "/" || req.url?.startsWith("/?type=")) {
		fs.readFile(join(__dirname, "client.html"), (err, content) => {
			if (err) {
				res.writeHead(500);
				res.end("Error loading client.html");
				return;
			}
			res.writeHead(200, { "Content-Type": "text/html" });
			res.end(content);
		});
	} else if (req.url?.startsWith("/client/")) {
		// Serve client-side files
		const filePath = join(__dirname, req.url);
		fs.readFile(filePath, (err, content) => {
			if (err) {
				res.writeHead(404);
				res.end("File not found");
				return;
			}
			const ext = req.url.split(".").pop();
			const contentType =
				ext === "js" ? "application/javascript" : "text/plain";
			res.writeHead(200, { "Content-Type": contentType });
			res.end(content);
		});
	} else {
		res.writeHead(404);
		res.end("Not found");
	}
});

// Create Socket.IO server
const io = createSocketServer({ httpServer });

// Handle socket connections
io.on("connection", (socket) => {
	const room = socket.handshake.auth.room as string;
	console.log(`Client connected: ${socket.id} (${room})`);

	// Join room for client type
	socket.join(room);
	socket.data.room = room;

	// Add to room store
	roomStore.addMember(room, {
		id: socket.id,
		room,
	});

	// Handle messages to specific client types
	socket.on("MESSAGE_TO_TYPE", ({ targetType, message }) => {
		console.log(`Message from ${room} to ${targetType}:`, message);
		io.to(targetType).emit("MESSAGE_FROM_TYPE", {
			room: room,
			message,
		});
	});

	// Handle disconnect
	socket.on("disconnect", () => {
		console.log(`Client disconnected: ${socket.id} (${room})`);
		roomStore.removeMember(room, socket.id);
		io.emit("ROOM_STATE", roomStore.getState());
	});

	// Broadcast updated room state
	const rooms = roomStore.getState();
	io.emit("ROOM_STATE", rooms);
});

const PORT = process.env.PORT || 8080;
httpServer.listen(PORT, () => {
	console.log(`Server running on http://localhost:${PORT}`);
	console.log(`Figma client: http://localhost:${PORT}/?type=figma`);
	console.log(`Browser client: http://localhost:${PORT}/?type=browser`);
});
