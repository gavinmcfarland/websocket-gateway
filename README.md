# WebSocket Gateway

A robust WebSocket implementation providing both server and client capabilities.

## Installation

```bash
npm install
```

## Project Structure

```
.
├── src/
│   ├── websocket-server.ts
│   └── websocket-client.ts
├── test/
│   └── websocket-server.test.ts
└── docs/
    └── websocket-docs.md
```

## Usage

### WebSocket Server

```typescript
import { WebSocketServer } from "./src/websocket-server";

const server = new WebSocketServer();
server.start();
```

### WebSocket Client

```typescript
import { WebSocketClient } from "./src/websocket-client";

const client = new WebSocketClient();
client.connect();
```

## Testing

Run the test suite using:

```bash
npm test
```

Tests are configured using Vitest as indicated by the `vitest.config.ts` file.

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
