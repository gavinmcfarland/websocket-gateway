# Web Socket Documentation

Experimenting with a Socket.IO gateway for cross-client communication.

## Client

### Creating a client

Provide a room name to join.

```ts
const client = createClient({
    room: "room1",
    port: 8080,
    host: "localhost",
});
```

### Sending a message

Send message with any event name and an optional list of rooms it should send to.

```ts
client.emit("EVENT_NAME", {
    message,
    room: ["room1", "room2"],
});
```

## Server

### Creating a websocketserver

Create a server with cors and server options.

```ts
const server = createSocketServer({
    httpServer,
    cors: cors ?? {
        origin: "*",
    },
    ...serverOptions,
});
```
