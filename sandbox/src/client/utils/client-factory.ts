import { io, Socket } from "socket.io-client";
import chalk from "chalk";
import { ClientType, ClientMessage } from "./socket-helpers";

/**
 * Interface defining the methods available on a client
 * Extends Socket to include all socket.io methods
 */
export interface SocketClient extends Omit<Socket, "emit"> {
	emit: (
		event: string,
		data: any,
		target?: ClientType[],
		callback?: (response: any) => void
	) => SocketClient;
}

/**
 * Configuration options for creating a client
 */
export interface ClientConfig {
	source: string;
	port?: number;
	host?: string;
}

/**
 * Creates a new socket client with standardized methods
 * Uses a Proxy to forward all Socket methods while preserving custom emit behavior
 * @param config - Configuration options for the client
 * @returns A proxied client instance with all Socket methods plus custom functionality
 */
export function createClient(config: ClientConfig): SocketClient {
	const { source, port = 8080, host = "localhost" } = config;

	console.log(chalk.cyan(`\n⚡ Starting ${source} Client...\n`));

	const socket = io(`http://${host}:${port}`, {
		auth: { source },
	});

	function emit(
		event: string,
		data: any,
		target?: ClientType[],
		callback?: (response: any) => void
	): SocketClient {
		if (target) {
			target.forEach((type) => {
				socket.emit(event, { ...data, target: type }, callback);
			});
		} else {
			socket.emit(event, data, callback);
		}
		return socket as SocketClient;
	}

	// Create a proxy that forwards all methods from the socket
	// while preserving our custom emit functionality
	return new Proxy<SocketClient>(socket as SocketClient, {
		get(target, prop, receiver) {
			if (prop === "emit") {
				return emit;
			}
			return Reflect.get(target, prop, receiver);
		},
	});
}
