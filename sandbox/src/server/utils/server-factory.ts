import { Server, ServerOptions } from "socket.io";
import chalk from "chalk";
import type { Server as HttpServer } from "node:http";

/**
 * Interface defining the methods available on the server
 * Extends Socket.IO Server to include any custom methods
 */
export interface SocketServer extends Omit<Server, "emit"> {
	// Add custom emit method signature if needed
	emit: (
		event: string,
		data: any,
		callback?: (response: any) => void
	) => SocketServer;
	route: (socket: any, eventName: string, message: any) => void;
}

/**
 * Configuration options for creating a server
 */
export interface ServerConfig {
	httpServer: HttpServer;
	cors?: {
		origin: string | string[];
		credentials?: boolean;
	};
	serverOptions?: Partial<ServerOptions>;
}

/**
 * Routes a message to the specified target clients
 */
function routeMessage(
	io: Server,
	socket: any,
	eventName: string,
	message: any,
	clientSource: string
) {
	// Broadcast to all except sender if no target
	if (!message?.target) {
		socket.broadcast.emit(eventName, {
			...message,
			source: clientSource,
		});
		return;
	}

	// Route to specific targets
	const targetClients = Array.from(io.sockets.sockets.values()).filter(
		(client) => client.handshake.auth.source === message.target
	);

	if (targetClients.length > 0) {
		const messageToSend = {
			...message,
			source: clientSource,
		};

		for (const targetClient of targetClients) {
			targetClient.emit(eventName, messageToSend);
		}
	}
}

/**
 * Creates a new Socket.IO server instance that attaches to an existing HTTP server
 * @param config - Configuration options for the server
 * @returns A proxied Socket.IO server instance with custom functionality
 */
export function createServer(config: ServerConfig): SocketServer {
	const { httpServer, cors, serverOptions = {} } = config;

	console.log(chalk.cyan(`\n⚡ Initializing Socket.IO Server...\n`));

	const io = new Server(httpServer, {
		cors: cors ?? {
			origin: "*",
		},
		...serverOptions,
	});

	// Add any middleware or custom event handlers here
	io.use((socket, next) => {
		const source = socket.handshake.auth.source;
		if (!source) {
			return next(new Error("Source not provided"));
		}
		console.log(chalk.green(`Client connected from source: ${source}`));
		next();
	});

	// Connection handler for message routing
	io.on("connection", (socket) => {
		const clientSource = socket.handshake.auth.source;

		// This handler automatically routes ALL incoming events
		socket.onAny((eventName, message) => {
			routeMessage(io, socket, eventName, message, clientSource);
		});

		// Manual routing
		(socket as any).route = (eventName: string, message: any) => {
			routeMessage(io, socket, eventName, message, clientSource);
		};
	});

	// Custom emit function
	function emit(
		event: string,
		data: any,
		callback?: (response: any) => void
	): SocketServer {
		io.emit(event, data, callback);
		return proxy;
	}

	// Create a proxy that forwards all methods from the server
	// while preserving our custom emit functionality
	const proxy = new Proxy<SocketServer>(io as unknown as SocketServer, {
		get(target, prop, receiver) {
			if (prop === "emit") {
				return emit;
			}
			if (prop === "route") {
				return (socket: any, eventName: string, message: any) => {
					routeMessage(
						io,
						socket,
						eventName,
						message,
						socket.handshake.auth.source
					);
				};
			}
			return Reflect.get(target, prop, receiver);
		},
	});

	return proxy;
}
