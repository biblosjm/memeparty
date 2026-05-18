import { io, type Socket } from "socket.io-client";
import { C2S, S2C, type PublicRoomState } from "@shared/game";

const SOCKET_URL = typeof window !== "undefined" ? window.location.origin : "";

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(SOCKET_URL, {
      path: "/socket.io",
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: Infinity,
    });

    socket.on("connect", () => {
      console.log("[Socket] connected", socket?.id);
    });

    socket.on("disconnect", (reason) => {
      console.log("[Socket] disconnected", reason);
    });

    socket.on("connect_error", (err) => {
      console.error("[Socket] connect_error", err.message);
    });
  }
  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}

export type RoomListener = (state: PublicRoomState) => void;

export function onRoomUpdated(listener: RoomListener): () => void {
  const s = getSocket();
  const handler = (state: PublicRoomState) => listener(state);
  s.on(S2C.ROOM_UPDATED, handler);
  return () => {
    s.off(S2C.ROOM_UPDATED, handler);
  };
}

export function onSocketEvent(event: string, listener: (...args: unknown[]) => void): () => void {
  const s = getSocket();
  s.on(event, listener);
  return () => s.off(event, listener);
}

export function emitJoinRoom(payload: {
  roomId: number;
  roomCode: string;
  playerId: number;
  nickname: string;
}): Promise<boolean> {
  const s = getSocket();
  return new Promise((resolve) => {
    if (!s.connected) {
      s.once("connect", () => {
        s.emit(C2S.JOIN_ROOM, payload, (res: { ok?: boolean }) => resolve(!!res?.ok));
      });
      s.connect();
    } else {
      s.emit(C2S.JOIN_ROOM, payload, (res: { ok?: boolean }) => resolve(!!res?.ok));
    }
  });
}

export function emitLeaveRoom(roomId: number, playerId: number) {
  getSocket().emit(C2S.LEAVE_ROOM, { roomId, playerId });
}

export function emitStartGame(roomId: number, playerId: number) {
  getSocket().emit(C2S.START_GAME, { roomId, playerId });
}

export function emitSubmitAnswer(roomId: number, playerId: number, content: string) {
  getSocket().emit(C2S.SUBMIT_ANSWER, { roomId, playerId, content });
}

export function emitSubmitVote(roomId: number, playerId: number, submissionId: string) {
  getSocket().emit(C2S.SUBMIT_VOTE, { roomId, playerId, submissionId });
}

export { C2S, S2C };
