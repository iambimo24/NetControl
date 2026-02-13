const http = require("http");
const { Server } = require("socket.io");

const server = http.createServer();
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const rooms = new Map();

io.on("connection", (socket) => {
  console.log("[Server] Client connected:", socket.id);

  socket.on("message", (msg) => {
    try {
      // Socket.IO 可以直接接收 string 或 object
      const data = typeof msg === "string" ? JSON.parse(msg) : msg;
      const { room, type, payload } = data;
      
      console.log('[dev] message received:', type, 'in room:', room, payload);

      // 加入房间
      if (room) {
        socket.join(room);
        if (!rooms.has(room)) rooms.set(room, new Set());
        rooms.get(room).add(socket.id);
      }

      // 广播给房间内其他人
      socket.to(room).emit("message", JSON.stringify({ type, payload }));
      
    } catch (error) {
      console.error("[Error] Failed to parse message:", error);
    }
  });

  socket.on("disconnect", () => {
    console.log("[Server] Client disconnected:", socket.id);
    rooms.forEach((set, room) => {
      set.delete(socket.id);
      if (set.size === 0) rooms.delete(room);
    });
  });
});

server.listen(8081, () => {
  console.log("Socket.IO signaling server running on http://localhost:8081");
});
