# Socket.IO Client Documentation

## Installation

```bash
npm install socket.io-client
# or
yarn add socket.io-client
```

## Basic Usage

```typescript
import { io } from "socket.io-client";

// Initialize connection
const socket = io("http://your-server", {
  query: { source: "client-source" },
  reconnection: true,
  reconnectionAttempts: Infinity,
});
```

## Event Handling

### Listen for events

```typescript
// Regular listener (can be called multiple times)
socket.on("message", (data) => {
  console.log("Received:", data);
});

// One-time listener (automatically removed after first event)
socket.once("one-time-event", (data) => {
  console.log("This will only fire once:", data);
});
```

### Remove listeners

```typescript
// Remove specific listener
const messageHandler = (data) => console.log(data);
socket.off("message", messageHandler);

// Remove all listeners for an event
socket.off("message");

// Remove all listeners
socket.removeAllListeners();
```

### Send messages

```typescript
// Basic emit
socket.emit("message", { text: "Hello!" });

// With acknowledgment
socket.emit("message", { text: "Hello!" }, (response) => {
  console.log("Server acknowledged:", response);
});
```

## Connection Management

### Connection events

```typescript
socket.on("connect", () => {
  console.log("Connected!");
});

socket.on("disconnect", (reason) => {
  console.log("Disconnected:", reason);
});

socket.on("connect_error", (error) => {
  console.log("Connection error:", error);
});
```

### Manual connection control

```typescript
// Disconnect
socket.disconnect();

// Reconnect
socket.connect();
```

## Advanced Options

When initializing the socket, you can pass various options:

```typescript
const socket = io("http://your-server", {
  // Automatically reconnect if connection is lost
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,

  // Add query parameters
  query: {
    source: "client-source",
    token: "auth-token",
  },

  // Transport options
  transports: ["websocket", "polling"],

  // Timeout options
  timeout: 20000,
});
```

## Best Practices

1. **Error Handling**: Always listen for connection errors

   ```typescript
   socket.on("connect_error", (error) => {
     console.error("Connection error:", error);
   });
   ```

2. **Cleanup**: Remove listeners when they're no longer needed

   ```typescript
   // In React useEffect or component cleanup
   return () => {
     socket.off("message");
     socket.disconnect();
   };
   ```

3. **Reconnection**: Socket.IO handles reconnection automatically, but you can customize the behavior
   ```typescript
   const socket = io("http://your-server", {
     reconnection: true,
     reconnectionAttempts: 5,
     reconnectionDelay: 1000, // Wait 1 second before retrying
     reconnectionDelayMax: 5000, // Maximum delay between retries
   });
   ```
