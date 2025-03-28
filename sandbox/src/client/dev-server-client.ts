import { io } from "socket.io-client";
import { createInterface } from "node:readline";
import chalk from "chalk";

/**
 * Client class for connecting to and interacting with the development server
 */
export class DevServerClient {
	private socket = io("http://localhost:8080", {
		auth: { clientType: "dev" },
	});

	public emit(event: string, data: any, callback?: (response: any) => void) {
		this.socket.emit(event, data, callback);
	}

	constructor() {
		console.log(chalk.cyan("\n⚡ Starting Dev Server Client...\n"));
		// ... rest of the code stays the same
	}
	// ... rest of the class stays the same
}

// Start the client
new DevServerClient();
