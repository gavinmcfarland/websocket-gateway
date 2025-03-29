import { createClient } from "websocket-gateway";
import chalk from "chalk";
import { createInterface } from "node:readline";

class MonitorCLI {
	constructor() {
		console.clear();
		console.log(chalk.cyan.bold("📡 WebSocket Monitor CLI\n"));

		const socket = createClient({
			room: "monitor",
			clientType: "cli-monitor",
		});

		socket.on("connect", () => {
			console.log(chalk.green("✓ Connected to server\n"));
		});

		socket.on("ROOM_STATE", (rooms) => {
			console.clear();
			this.displayRooms(rooms);
		});

		socket.on("message", (data) => {
			this.displayMessage(data);
		});

		// Handle exit
		const rl = createInterface({
			input: process.stdin,
			output: process.stdout,
		});

		rl.on("SIGINT", () => {
			console.clear();
			process.exit(0);
		});
	}

	private displayRooms(
		rooms: Record<string, Array<{ id: string; type: string }>>
	) {
		console.log(chalk.cyan.bold("📡 WebSocket Monitor CLI\n"));

		Object.entries(rooms).forEach(([room, clients]) => {
			console.log(chalk.yellow(`\n${room} (${clients.length} clients):`));
			clients.forEach((client) => {
				console.log(chalk.white(`  └─ ${client.id} (${client.type})`));
			});
		});

		console.log(chalk.dim("\nPress Ctrl+C to exit"));
	}

	private displayMessage(data: {
		from: string;
		room: string;
		content: string;
	}) {
		console.log(
			chalk.gray(`\n[${new Date().toLocaleTimeString()}] `),
			chalk.blue(`${data.from} (${data.room}): `),
			chalk.white(data.content)
		);
	}
}

// Start the CLI
new MonitorCLI();
