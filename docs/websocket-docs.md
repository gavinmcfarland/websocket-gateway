# WebSocket Client and Server Documentation

This documentation covers the usage of the WebSocketClient and WebSocketServer classes for real-time bidirectional communication.

## WebSocketClient

The WebSocketClient class provides a reliable WebSocket connection with automatic reconnection capabilities. It works in both Node.js and browser environments, automatically using the appropriate event system (EventEmitter for Node.js, EventTarget for browsers).

### Constructor

```typescript
const client = new WebSocketClient(url: string, source: string);
```

- `url`: The WebSocket server URL to connect to
- `source`: A unique identifier for this client

### Methods

#### send(type: string, payload?: any): Promise<void>

Sends a message to the server. Messages are automatically queued if the connection is down.

```typescript
// Example: Send a chat message
await client.send("chat-message", {
  message: "Hello world!",
  timestamp: Date.now(),
});
```

#### on(event: string, callback: (data: any) => Promise<void>)

Registers an event listener for incoming messages. If the callback returns a value, it's automatically sent back as a response.

```typescript
// Example: Listen for chat messages
client.on("chat-message", async (data) => {
  console.log(`Received message: ${data.message}`);
  // Optionally return a value to send a response
  return { status: "received" };
});
```

### Auto-Reconnection

The WebSocketClient uses the `reconnecting-websocket` library to automatically handle connection drops and reconnection attempts. Any messages sent during disconnection are queued and will be sent when the connection is re-established.

## WebSocketServer

The WebSocketServer class manages WebSocket connections from multiple clients, handles client tracking, and provides broadcasting capabilities.

### Constructor

```typescript
const server = new WebSocketServer(port: number);
```

- `port`: The port number to listen on

### Methods

#### sendTo(source: string, type: string, payload?: any): void

Sends a message to a specific client identified by their source.

```typescript
// Example: Send a private message to a specific client
server.sendTo("client123", "private-message", {
  message: "This is for you only",
});
```

#### broadcast(type: string, payload?: any, excludeSource?: string): void

Broadcasts a message to all connected clients, optionally excluding the source client.

```typescript
// Example: Broadcast a message to all clients except sender
server.broadcast(
  "announcement",
  {
    message: "Server is restarting in 5 minutes",
  },
  "admin-client"
);
```

#### on(event: string, callback: (data: any) => void): void

Registers an event listener for incoming messages.

```typescript
// Example: Handle chat messages
server.on("chat-message", ({ source, payload }) => {
  console.log(`Message from ${source}: ${payload.message}`);
  // Broadcast the message to all other clients
  server.broadcast("chat-message", payload, source);
});
```

#### close(): void

Gracefully shuts down the WebSocket server.

```typescript
server.close();
```

### Client Management

The server automatically manages client connections and includes:

- Client tracking with unique source identifiers
- Automatic removal of disconnected clients
- Ping/pong mechanism to detect stale connections (30-second interval)

### Error Handling

Both client and server implementations include built-in error handling:

- Connection errors are automatically handled with reconnection attempts (client)
- Invalid messages are caught and logged (server)
- Stale connections are automatically cleaned up (server)

### Example: Chat Application

Here's a complete example showing how to create a simple chat application:

```typescript
// Server setup
const server = new WebSocketServer(8080);

server.on("chat-message", ({ source, payload }) => {
  // Broadcast received messages to all clients
  server.broadcast("chat-message", {
    sender: source,
    message: payload.message,
    timestamp: Date.now(),
  });
});

// Client setup
const client = new WebSocketClient("ws://localhost:8080", "user123");

// Send a message
await client.send("chat-message", {
  message: "Hello everyone!",
});

// Listen for messages
client.on("chat-message", async (data) => {
  console.log(`${data.sender}: ${data.message}`);
  return { received: true };
});
```
