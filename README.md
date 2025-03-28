# Socket.IO Gateway

Experimenting with a Socket.IO gateway for cross-client communication.

## Installation

```bash
npm install
```

## Features

-   Client connection management
-   Broadcast messaging
-   Direct messaging to specific clients
-   Client type categorization (browser, figma, node)
-   Room-based messaging for client types

## Usage

### Creating a server

```typescript
import { Server } from "socket.io";
import { createServer } from "node:http";

const httpServer = createServer();
const io = new Server(httpServer);

// Handle connections
io.on("connection", (socket) => {
    // Access client type from auth
    const clientType = socket.handshake.auth.clientType;

    // Add socket to its type room
    socket.join(clientType);

    // Handle typed messages
    socket.on("MESSAGE_TO_TYPE", ({ targetType, message }) => {
        io.to(targetType).emit("MESSAGE_FROM_TYPE", {
            fromType: socket.data.clientType,
            message,
        });
    });
});

httpServer.listen(8080);
```

### Creating a client

```typescript
import { io as Client } from "socket.io-client";

// Connect with client type
const client = Client("http://localhost:8080", {
    auth: { clientType: "browser" },
});

// Send message to specific client type
client.emit("MESSAGE_TO_TYPE", {
    targetType: "figma",
    message: "Hello Figma clients!",
});

// Listen for typed messages
client.on("MESSAGE_FROM_TYPE", ({ fromType, message }) => {
    console.log(`Message from ${fromType}: ${message}`);
});
```

## Client Tracking

The gateway maintains a record of all connected clients by their type using Sets:

```typescript
// Track connected clients by type
const clients = {
    browser: new Set(),
    figma: new Set(),
    node: new Set(),
};

// Add client on connection
io.on("connection", (socket) => {
    const clientType = socket.handshake.auth.clientType;
    clients[clientType].add(socket.id);

    // Remove client on disconnect
    socket.on("disconnect", () => {
        clients[clientType].delete(socket.id);
    });
});

// Example usage:
// Get all browser clients
const browserClients = clients.browser;

// Get count of connected Figma clients
const figmaClientCount = clients.figma.size;

// Check if specific client is connected
const isClientConnected = clients.node.has(socketId);
```

## Sending messages to specific client types

Any client can send a message to all clients of a specific type using the `MESSAGE_TO_TYPE` event:

```typescript
// Send a message to all Figma clients
client.emit("MESSAGE_TO_TYPE", {
    targetType: "figma", // The client type to send to
    message: "Hello Figma!", // The message content (can be any serializable data)
});
```

### Receiving Typed Messages

Clients receive messages sent to their type through the `MESSAGE_FROM_TYPE` event:

```typescript
// Listen for messages sent to this client's type
client.on("MESSAGE_FROM_TYPE", ({ fromType, message }) => {
    console.log(`Message from ${fromType}: ${message}`);
});
```

The received message includes:

-   `fromType`: The client type of the sender (e.g., "browser", "figma", "node")
-   `message`: The message content that was sent

### Example Use Cases

1. Browser sending UI updates to Figma:

```typescript
browserClient.emit("MESSAGE_TO_TYPE", {
    targetType: "figma",
    message: { action: "updateColor", color: "#FF0000" },
});
```

2. Node sending file changes to browsers:

```typescript
nodeClient.emit("MESSAGE_TO_TYPE", {
    targetType: "browser",
    message: { action: "fileChanged", path: "/src/app.ts" },
});
```

3. Figma sending selection updates to Node:

```typescript
figmaClient.emit("MESSAGE_TO_TYPE", {
    targetType: "node",
    message: { action: "highlight", component: "Button" },
});
```

## Supported Events

### Built-in Socket.IO Events

| Event        | Description                | Payload           |
| ------------ | -------------------------- | ----------------- |
| `connection` | Fired when client connects | Socket instance   |
| `disconnect` | Fired when client leaves   | Disconnect reason |

### Custom Gateway Events

| Event               | Description                              | Payload                                |
| ------------------- | ---------------------------------------- | -------------------------------------- |
| `MESSAGE_TO_TYPE`   | Send message to specific client type     | `{ targetType: string, message: any }` |
| `MESSAGE_FROM_TYPE` | Receive message from another client type | `{ fromType: string, message: any }`   |
| `MESSAGE_ALL`       | Send message to all clients              | `{ message: any }`                     |
| `MESSAGE_DIRECT`    | Send to specific client                  | `{ targetId: string, message: any }`   |

### Examples

```typescript
// Send to all Figma clients
client.emit("MESSAGE_TO_TYPE", {
    targetType: "figma",
    message: "Hello Figma!",
});

// Listen for messages from other client types
client.on("MESSAGE_FROM_TYPE", ({ fromType, message }) => {
    console.log(`Message from ${fromType}: ${message}`);
});

// Send to everyone
client.emit("MESSAGE_ALL", {
    message: "Hello everyone!",
});

// Send to specific client
client.emit("MESSAGE_DIRECT", {
    targetId: "recipient_socket_id",
    message: "Hello specific client!",
});
```

## Client Types

The system supports different client types that can be specified in the connection auth:

-   `browser`
-   `figma`
-   `node`

## Creating Custom Events

Socket.IO allows you to create custom events by simply emitting and listening for your chosen event names:

### On the Server

```typescript
// In your server code
io.on("connection", (socket) => {
    // Create a custom event listener
    socket.on("my_custom_event", (data) => {
        console.log("Received:", data);

        // Emit a response with another custom event
        socket.emit("my_response_event", {
            status: "received",
        });
    });
});
```

### On the Client

```typescript
// In your client code
client.emit("my_custom_event", {
    someData: "Hello server!",
});

client.on("my_response_event", (data) => {
    console.log("Server responded:", data);
});
```

Custom events in this gateway:

-   `MESSAGE_TO_TYPE`: For sending messages to specific client types
-   `MESSAGE_FROM_TYPE`: For receiving messages from other clients
-   `MESSAGE_ALL`: For sending messages to all connected clients
-   `MESSAGE_DIRECT`: For sending messages to specific clients

Note: While you can name custom events anything you want, it's important to maintain consistency between server and client code to ensure messages are properly routed.
