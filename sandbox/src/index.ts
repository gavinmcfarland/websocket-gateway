import { Server } from "socket.io";
import { createServer } from "node:http";
import * as fs from "node:fs";
import { dirname, join } from "node:path";
import { roomStore } from "./shared/store";

// Create HTTP server
const httpServer = createServer((req, res) => {
	// Simple router for serving HTML files
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
	} else {
		res.writeHead(404);
		res.end("Not found");
	}
});

// Create Socket.IO server
const io = new Server(httpServer);

// Handle socket connections
io.on("connection", (socket) => {
	const clientType = socket.handshake.auth.clientType as string;
	console.log(`Client connected: ${socket.id} (${clientType})`);

	// Join room for client type
	socket.join(clientType);
	socket.data.clientType = clientType;

	// Add to room store
	roomStore.addMember(clientType, {
		id: socket.id,
		clientType,
	});

	// Handle messages to specific client types
	socket.on("MESSAGE_TO_TYPE", ({ targetType, message }) => {
		console.log(`Message from ${clientType} to ${targetType}:`, message);
		io.to(targetType).emit("MESSAGE_FROM_TYPE", {
			fromType: clientType,
			message,
		});
	});

	// Handle disconnect
	socket.on("disconnect", () => {
		console.log(`Client disconnected: ${socket.id} (${clientType})`);
		roomStore.removeMember(clientType, socket.id);
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
