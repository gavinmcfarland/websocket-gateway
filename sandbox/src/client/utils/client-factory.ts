import { io, Socket } from "socket.io-client";
import chalk from "chalk";
import { ClientType, ClientMessage } from "./socket-helpers";

/**
 * Interface defining the methods available on a client
 */
export interface SocketClient {
	socket: Socket;
	emit: (
		event: string,
		data: any,
		clientTypes?: ClientType[],
		callback?: (response: any) => void
	) => void;
}

/**
 * Configuration options for creating a client
 */
export interface ClientConfig {
	clientType: ClientType;
	port?: number;
	host?: string;
}

/**
 * Creates a new socket client with standardized methods
 * @param config - Configuration options for the client
 * @returns A client instance with standard methods
 */
export function createClient(config: ClientConfig): SocketClient {
	const { clientType, port = 8080, host = "localhost" } = config;

	console.log(chalk.cyan(`\n⚡ Starting ${clientType} Client...\n`));

	const socket = io(`http://${host}:${port}`, {
		auth: { clientType },
	});

	return {
		socket,

		emit(
			event: string,
			data: any,
			clientTypes?: ClientType[],
			callback?: (response: any) => void
		) {
			if (clientTypes) {
				clientTypes.forEach((type) => {
					socket.emit(event, { ...data, clientType: type }, callback);
				});
			} else {
				socket.emit(event, data, callback);
			}
		},
	};
}
