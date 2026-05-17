import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { io, Socket } from "socket.io-client";

export interface Player {
  playerId: number;
  nickname: string;
  role: "player" | "spectator";
  score?: number;
  level?: number;
  socketId: string;
}

interface JoinRoomPayload {
  roomId: number;
  playerId: number;
  nickname: string;
  role: "player" | "spectator";
}

export interface GameContextType {
  socket: Socket | null;
  isConnected: boolean;
  roomId: number | null;
  playerId: number | null;
  roomCode: string | null;
  players: Player[];
  spectators: Player[];
  gameStatus: "waiting" | "playing" | "voting" | "ended" | null;
  currentRound: number;
  
  // Actions
  joinRoom: (roomId: number, playerId: number, nickname: string, role: "player" | "spectator", roomCode?: string) => void;
  leaveRoom: () => void;
  startGame: () => void;
  startRound: (roundId: number) => void;
  submitResponse: (roundId: number, playerId: number, content: string) => void;
  submitVote: (roundId: number, voterId: number, responseId: number) => void;
  endRound: (roundId: number) => void;
  sendChatMessage: (message: string) => void;
  sendEmojiReaction: (emoji: string) => void;
}

const GameContext = createContext<GameContextType | undefined>(undefined);

export function GameProvider({ children }: { children: React.ReactNode }) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [roomId, setRoomId] = useState<number | null>(null);
  const [playerId, setPlayerId] = useState<number | null>(null);
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [spectators, setSpectators] = useState<Player[]>([]);
  const [gameStatus, setGameStatus] = useState<"waiting" | "playing" | "voting" | "ended" | null>(null);
  const [currentRound, setCurrentRound] = useState(0);

  const socketRef = useRef<Socket | null>(null);
  const pendingJoinRef = useRef<JoinRoomPayload | null>(null);

  const emitJoinRoom = useCallback((payload: JoinRoomPayload) => {
    const activeSocket = socketRef.current;
    if (!activeSocket) {
      console.warn("[Socket] emitJoinRoom: socket not initialized, queuing", payload);
      pendingJoinRef.current = payload;
      return;
    }

    if (!activeSocket.connected) {
      console.log("[Socket] emitJoinRoom: not connected yet, queuing", payload);
      pendingJoinRef.current = payload;
      return;
    }

    console.log("[Socket] join_room emit:", payload);
    activeSocket.emit("join_room", payload);
    pendingJoinRef.current = null;
  }, []);

  // Initialize socket connection
  useEffect(() => {
    const newSocket = io(window.location.origin, {
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
    });

    socketRef.current = newSocket;

    newSocket.on("connect", () => {
      console.log("[Socket] Connected:", newSocket.id);
      setIsConnected(true);

      if (pendingJoinRef.current) {
        console.log("[Socket] Replaying pending join_room on connect:", pendingJoinRef.current);
        newSocket.emit("join_room", pendingJoinRef.current);
        pendingJoinRef.current = null;
      }
    });

    newSocket.on("disconnect", () => {
      console.log("[Socket] Disconnected");
      setIsConnected(false);
    });

    newSocket.on("players_updated", (data: { players: Player[]; spectators: Player[] }) => {
      console.log("[Socket] players_updated:", {
        playerCount: data.players.length,
        players: data.players,
        spectatorCount: data.spectators.length,
      });
      setPlayers(data.players);
      setSpectators(data.spectators);
    });

    newSocket.on("room_joined", (data: { players: Player[]; spectators: Player[]; roomId: number }) => {
      console.log("[Socket] room_joined success:", {
        roomId: data.roomId,
        playerCount: data.players.length,
        players: data.players,
      });
      setPlayers(data.players);
      setSpectators(data.spectators);
    });

    newSocket.on("game_started", (data: { roundNumber: number; gameMode: string }) => {
      setGameStatus("playing");
      setCurrentRound(data.roundNumber);
    });

    newSocket.on("round_started", (data: { roundId: number; roundNumber: number; timeLimit: number }) => {
      setGameStatus("playing");
      setCurrentRound(data.roundNumber);
    });

    newSocket.on("round_ended", () => {
      setGameStatus("voting");
    });

    newSocket.on("error", (data: { message: string }) => {
      console.error("[Socket] Error:", data.message);
    });

    setSocket(newSocket);

    return () => {
      socketRef.current = null;
      pendingJoinRef.current = null;
      newSocket.disconnect();
    };
  }, []);

  const joinRoom = useCallback((
    roomId: number,
    playerId: number,
    nickname: string,
    role: "player" | "spectator",
    code?: string,
  ) => {
    const payload: JoinRoomPayload = { roomId, playerId, nickname, role };

    console.log("[Socket] joinRoom called:", { ...payload, roomCode: code, connected: socketRef.current?.connected });

    setRoomId(roomId);
    setPlayerId(playerId);
    if (code) setRoomCode(code);

    pendingJoinRef.current = payload;
    emitJoinRoom(payload);
  }, [emitJoinRoom]);

  const leaveRoom = useCallback(() => {
    const activeSocket = socketRef.current;
    if (!activeSocket || !roomId || !playerId) return;

    console.log("[Socket] leave_room emit:", { roomId, playerId });
    activeSocket.emit("leave_room", { roomId, playerId });

    pendingJoinRef.current = null;
    setRoomId(null);
    setPlayerId(null);
    setRoomCode(null);
    setPlayers([]);
    setSpectators([]);
    setGameStatus(null);
    setCurrentRound(0);
  }, [roomId, playerId]);

  const startGame = useCallback(() => {
    if (!socketRef.current || !roomId) return;
    socketRef.current.emit("start_game", { roomId });
  }, [roomId]);

  const startRound = useCallback((roundId: number) => {
    if (!socketRef.current || !roomId) return;
    socketRef.current.emit("start_round", { roomId, roundId });
  }, [roomId]);

  const submitResponse = useCallback((roundId: number, playerId: number, content: string) => {
    if (!socketRef.current || !roomId) return;
    socketRef.current.emit("submit_response", { roomId, roundId, playerId, content });
  }, [roomId]);

  const submitVote = useCallback((roundId: number, voterId: number, responseId: number) => {
    if (!socketRef.current || !roomId) return;
    socketRef.current.emit("submit_vote", { roomId, roundId, voterId, responseId });
  }, [roomId]);

  const endRound = useCallback((roundId: number) => {
    if (!socketRef.current || !roomId) return;
    socketRef.current.emit("end_round", { roomId, roundId });
  }, [roomId]);

  const sendChatMessage = useCallback((message: string) => {
    if (!socketRef.current || !roomId || !playerId) return;
    socketRef.current.emit("chat_message", { roomId, playerId, message });
  }, [roomId, playerId]);

  const sendEmojiReaction = useCallback((emoji: string) => {
    if (!socketRef.current || !roomId || !playerId) return;
    socketRef.current.emit("emoji_reaction", { roomId, playerId, emoji });
  }, [roomId, playerId]);

  const value: GameContextType = {
    socket,
    isConnected,
    roomId,
    playerId,
    roomCode,
    players,
    spectators,
    gameStatus,
    currentRound,
    joinRoom,
    leaveRoom,
    startGame,
    startRound,
    submitResponse,
    submitVote,
    endRound,
    sendChatMessage,
    sendEmojiReaction,
  };

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame() {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error("useGame must be used within GameProvider");
  }
  return context;
}
