import express from "express";
import { createServer } from "node:http";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer as createSocketServer } from "websocket-gateway";

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const httpServer = createServer(app);

// Serve static files
app.use(express.static(join(__dirname, "public")));

// Serve the monitor UI
app.get("/", (req, res) => {
	res.sendFile(join(__dirname, "public", "monitor.html"));
});

// Create WebSocket server
const io = createSocketServer({ httpServer });

// Track connected clients
const rooms = new Map();

io.on("connection", (socket) => {
	const room = socket.handshake.auth.room || "default";
	const clientType = socket.handshake.auth.clientType || "unknown";

	// Add client to room
	if (!rooms.has(room)) {
		rooms.set(room, new Set());
	}
	rooms.get(room).add({ id: socket.id, type: clientType });

	// Join room
	socket.join(room);

	// Broadcast updated room state
	broadcastRoomState();

	// Handle client messages
	socket.on("message", (data) => {
		io.to(data.room || room).emit("message", {
			from: socket.id,
			room: data.room || room,
			content: data.content,
		});
	});

	// Handle disconnection
	socket.on("disconnect", () => {
		rooms.get(room)?.delete(socket.id);
		if (rooms.get(room)?.size === 0) {
			rooms.delete(room);
		}
		broadcastRoomState();
	});
});

function broadcastRoomState() {
	const state = {};
	for (const [room, clients] of rooms.entries()) {
		state[room] = Array.from(clients);
	}
	io.emit("ROOM_STATE", state);
}

const PORT = process.env.PORT || 8080;
httpServer.listen(PORT, () => {
	console.log(`Server running on http://localhost:${PORT}`);
});
