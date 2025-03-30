import { createClient, SocketClient } from "../../../src/client.js";
import { ClientType, ClientMessage } from "./utils/socket-helpers";
import { createInterface } from "node:readline";
import chalk from "chalk";

/**
 * Client class for connecting to and interacting with the development server
 */
export class DevServerClient implements SocketClient {
	private client: SocketClient;

	constructor() {
		this.client = createClient({ clientType: "dev" });
		console.log(chalk.cyan("\n⚡ Starting Dev Server Client...\n"));
	}

	get socket() {
		return this.client.socket;
	}

	public emit(event: string, data: any, callback?: (response: any) => void) {
		this.client.emit(event, data, callback);
	}

	/**
	 * Sends a message to clients of a specific type
	 * @param targetType - The type of client to send the message to
	 * @param message - The message payload to send
	 * @param callback - Optional callback to handle the response
	 */
	public toTarget(
		targetType: ClientType,
		message: ClientMessage,
		callback?: (response: any) => void
	) {
		this.client.toTarget(targetType, message, callback);
	}
}
