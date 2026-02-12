const WebSocket = require("ws");
const http = require("http");

const server = http.createServer();
const wss = new WebSocket.Server({ server });

const rooms = new Map();

wss.on("connection", (ws) => {
  ws.on("message", (msg) => {
    const data = JSON.parse(msg);

    const { room, type, payload } = data;
    console.log('[dev] message received:', data);

    if (!rooms.has(room)) rooms.set(room, new Set());
    rooms.get(room).add(ws);

    // 广播给房间内其他人
    rooms.get(room).forEach(client => {
      if (client !== ws && client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ type, payload }));
      }
    });
  });

  ws.on("close", () => {
    rooms.forEach(set => set.delete(ws));
  });
});

server.listen(8081, () => {
  console.log("Signaling server running on ws://localhost:8081");
});
