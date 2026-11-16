import { WebSocketServer, WebSocket } from "ws";
import { createHmac, timingSafeEqual, randomUUID } from "node:crypto";
const secret = process.env.REALTIME_SECRET;
if (!secret || secret.length < 32)
  throw new Error("REALTIME_SECRET must contain at least 32 characters");
const allowedOrigin = process.env.REALTIME_ORIGIN || "http://localhost:4321";
const rooms = new Map();
const server = new WebSocketServer({
  port: Number(process.env.REALTIME_PORT) || 3002,
  host: process.env.REALTIME_HOST || "127.0.0.1",
  maxPayload: 8192,
  verifyClient: (info) => info.origin === allowedOrigin,
});
server.on("connection", (socket) => {
  const lifetime = setTimeout(
    () => socket.close(4001, "Session expired"),
    7200000,
  );
  let identity;
  let count = 0;
  let windowStart = Date.now();
  const connectionId = randomUUID();
  const timer = setTimeout(
    () => socket.close(4001, "Authentication required"),
    5000,
  );
  socket.on("message", (raw) => {
    try {
      if (Date.now() - windowStart > 1000) {
        windowStart = Date.now();
        count = 0;
      }
      if (++count > 35) return socket.close(4008, "Rate limit");
      const data = JSON.parse(raw.toString());
      if (!identity) {
        if (data.type !== "auth" || typeof data.ticket !== "string")
          return socket.close(4001);
        const [content, sig] = data.ticket.split(".");
        const expected = createHmac("sha256", secret).update(content).digest();
        const actual = Buffer.from(sig || "", "hex");
        if (
          actual.length !== expected.length ||
          !timingSafeEqual(actual, expected)
        )
          return socket.close(4001);
        const claims = JSON.parse(Buffer.from(content, "base64").toString());
        if (claims.exp < Date.now() || !claims.workspace || !claims.user)
          return socket.close(4001);
        identity = claims;
        clearTimeout(timer);
        if (!rooms.has(identity.workspace))
          rooms.set(identity.workspace, new Set());
        rooms.get(identity.workspace).add(socket);
        socket.send(JSON.stringify({ type: "ready" }));
        return;
      }
      let message;
      if (
        data.type === "cursor" &&
        Number.isFinite(data.x) &&
        Number.isFinite(data.y) &&
        typeof data.space === "string"
      ) {
        message = {
          type: "cursor",
          id: connectionId,
          name: identity.name,
          userId:String(identity.user),
          space: data.space.slice(0, 100),
          x: data.x,
          y: data.y,
          action: ["editing", "moving"].includes(data.action)
            ? data.action
            : "viewing",
          nodeId:
            typeof data.nodeId === "string" &&
            /^[a-zA-Z0-9 _-]{1,100}$/.test(data.nodeId)
              ? data.nodeId
              : "",
        };
      } else if (data.type === "invalidate") {
        message = { type: "invalidate" };
      }
      if (message)
        for (const peer of rooms.get(identity.workspace) || [])
          if (peer !== socket && peer.readyState === WebSocket.OPEN)
            peer.send(JSON.stringify(message));
    } catch {
      socket.close(4000, "Invalid message");
    }
  });
  socket.on("close", () => {
    clearTimeout(lifetime);
    clearTimeout(timer);
    if (identity) {
      const room = rooms.get(identity.workspace);
      room?.delete(socket);
      if (!room?.size) rooms.delete(identity.workspace);
    }
  });
  socket.on("error", () => {});
});
const heartbeat = setInterval(() => {
  for (const client of server.clients) {
    if (client.isAlive === false) {
      client.terminate();
      continue;
    }
    client.isAlive = false;
    client.ping();
  }
}, 30000);
server.on("connection", (client) => {
  client.isAlive = true;
  client.on("pong", () => (client.isAlive = true));
});
server.on("close", () => clearInterval(heartbeat));
server.once("listening", () => console.log(
  "Órbita realtime listening on port " + (process.env.REALTIME_PORT || 3002),
));
