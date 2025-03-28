# Socket.IO Gateway

Experimenting with a Socket.IO gateway for cross-client communication.

## Installation

```bash
npm install
```

## Features

- Client connection management
- Broadcast messaging
- Direct messaging to specific clients
- Client type categorization (browser, figma, vscode)
- Room-based messaging for client types

## Usage

### Socket.IO Server

```typescript
import { Server } from "socket.io";
import { createServer } from "node:http";

// Create HTTP server
const httpServer = createServer();
const io = new Server(httpServer);

// Handle connections
io.on("connection", (socket) => {
  // Access client type from auth
  const clientType = socket.handshake.auth.clientType;

  // Add socket to its type room
  socket.join(clientType);

  // Handle typed messages
  socket.on("message_to_type", ({ targetType, message }) => {
    io.to(targetType).emit("typed_message", {
      fromType: socket.data.clientType,
      message,
    });
  });
});

httpServer.listen(8080);
```

### Socket.IO Client

```typescript
import { io as Client } from "socket.io-client";

// Connect with client type
const client = Client("http://localhost:8080", {
  auth: { clientType: "browser" },
});

// Send message to specific client type
client.emit("message_to_type", {
  targetType: "figma",
  message: "Hello Figma clients!",
});

// Listen for typed messages
client.on("typed_message", ({ fromType, message }) => {
  console.log(`Message from ${fromType}: ${message}`);
});
```

## Supported Events

| Event             | Description                          | Payload                                |
| ----------------- | ------------------------------------ | -------------------------------------- |
| `connection`      | Fired when client connects           | Socket instance                        |
| `message_to_type` | Send message to specific client type | `{ targetType: string, message: any }` |
| `typed_message`   | Receive message sent to client type  | `{ fromType: string, message: any }`   |
| `broadcast`       | Broadcast to all clients             | `{ message: any }`                     |
| `directMessage`   | Send to specific client              | `{ message: any }`                     |

## Client Types

The system supports different client types that can be specified in the connection auth:

- `browser`
- `figma`
- `vscode`

## Testing

Run the test suite using:

```bash
npm test
```

The test suite includes verification of:

- Basic client-server connectivity
- Broadcast messaging to all clients
- Direct messaging to specific clients
- Type-based messaging between different client categories

## Documentation

For detailed documentation, please refer to the [WebSocket Documentation](docs/websocket-docs.md).

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.
