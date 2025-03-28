import { Socket } from "socket.io-client";

/**
 * Types of clients that can receive messages
 */
export type ClientType = "figma" | "dev-server" | "test";

/**
 * Message structure for client communication
 */
export interface ClientMessage {
	timeStamp: string;
	type: string;
	[key: string]: any;
}

/**
 * Sends a message to clients of a specific type
 * @param socket - The socket.io client instance
 * @param targetType - The type of client to send the message to
 * @param message - The message payload to send
 * @param callback - Optional callback to handle the response
 */
export function sendMessageToTarget(
	socket: Socket,
	targetType: ClientType,
	message: ClientMessage,
	callback?: (response: any) => void
) {
	socket.emit(
		"MESSAGE_TO_TYPE",
		{
			targetType,
			message,
		},
		callback
	);
}

interface TypedMessage {
	targetType: ClientType;
	message: {
		type: string;
		data: any;
	};
}

/**
 * Handles messages targeted to specific client types
 * @param socket The socket instance to attach the handler to
 * @param clientType The type of client this handler is for
 * @param messageHandler Callback to handle the received message
 */
export function handleTypedMessages(
	socket: Socket,
	clientType: ClientType,
	messageHandler: (type: string, data: any) => void
): void {
	socket.on("MESSAGE_TO_TYPE", (message: TypedMessage) => {
		if (message.targetType === clientType) {
			messageHandler(message.message.type, message.message.data);
		}
	});
}

export function sendMessage(socket: WebSocket, message: any) {
	const payload = {
		target: message.clientType,
		data: message.data,
	};

	socket.send(JSON.stringify(payload));
}

export function handleIncomingMessage(message: any) {
	const { target, source, data } = JSON.parse(message);
}
