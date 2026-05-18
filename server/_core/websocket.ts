import { Server as SocketIOServer } from "socket.io";
import { Server as HTTPServer } from "http";
import { initRoomManager } from "../game/roomManager";

/**
 * Socket.IO entry — game logic lives in server/game/roomManager.ts
 */
export function setupWebSocket(httpServer: HTTPServer) {
  const io = new SocketIOServer(httpServer, {
    cors: { origin: "*", methods: ["GET", "POST"] },
    path: "/socket.io",
  });

  initRoomManager(io);

  console.log("[WebSocket] Game room manager initialized");
  return io;
}
