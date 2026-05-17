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

export interface ChatMessage {
  messageId: number;
  playerId: number;
  nickname: string;
  message: string;
  timestamp: Date;
}

interface JoinRoomPayload {
  roomId: number;
  playerId: number;
  nickname: string;
  role: "player" | "spectator";
}

interface PendingEmit {
  event: string;
  payload: Record<string, unknown>;
}

export interface GameContextType {
  socket: Socket | null;
  isConnected: boolean;
  roomId: number | null;
  playerId: number | null;
  roomCode: string | null;
  players: Player[];
  spectators: Player[];
  chatMessages: ChatMessage[];
  gameStatus: "waiting" | "playing" | "voting" | "ended" | null;
  currentRound: number;
  currentRoundId: number | null;
  
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

const SOCKET_URL = typeof window !== "undefined" ? window.location.origin : "";

export function GameProvider({ children }: { children: React.ReactNode }) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [roomId, setRoomId] = useState<number | null>(null);
  const [playerId, setPlayerId] = useState<number | null>(null);
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [spectators, setSpectators] = useState<Player[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [gameStatus, setGameStatus] = useState<"waiting" | "playing" | "voting" | "ended" | null>(null);
  const [currentRound, setCurrentRound] = useState(0);
  const [currentRoundId, setCurrentRoundId] = useState<number | null>(null);

  const socketRef = useRef<Socket | null>(null);
  const roomIdRef = useRef<number | null>(null);
  const playerIdRef = useRef<number | null>(null);
  const lastJoinRef = useRef<JoinRoomPayload | null>(null);
  const pendingEmitsRef = useRef<PendingEmit[]>([]);

  const setSession = useCallback((sessionRoomId: number, sessionPlayerId: number, code?: string) => {
    roomIdRef.current = sessionRoomId;
    playerIdRef.current = sessionPlayerId;
    setRoomId(sessionRoomId);
    setPlayerId(sessionPlayerId);
    if (code) setRoomCode(code);
    console.log("[Socket] session set:", {
      roomId: sessionRoomId,
      playerId: sessionPlayerId,
      roomCode: code,
    });
  }, []);

  const emitJoinRoom = useCallback((payload: JoinRoomPayload) => {
    lastJoinRef.current = payload;
    const activeSocket = socketRef.current;

    if (!activeSocket?.connected) {
      console.log("[Socket] join_room queued (socket not connected yet):", payload);
      return;
    }

    console.log("[Socket] join_room emit:", payload);
    activeSocket.emit("join_room", payload);
  }, []);

  const flushPendingEmits = useCallback(() => {
    const activeSocket = socketRef.current;
    if (!activeSocket?.connected) return;

    const queue = [...pendingEmitsRef.current];
    pendingEmitsRef.current = [];

    for (const { event, payload } of queue) {
      console.log(`[Socket] flushing queued ${event}:`, payload);
      activeSocket.emit(event, payload);
    }
  }, []);

  const emitToRoom = useCallback((event: string, payload: Record<string, unknown>) => {
    const activeSocket = socketRef.current;
    const activeRoomId = roomIdRef.current;
    const activePlayerId = playerIdRef.current;

    if (!activeRoomId) {
      console.warn(`[Socket] ${event}: roomId not set`, { payload, activePlayerId });
      return false;
    }

    const fullPayload = {
      roomId: activeRoomId,
      ...(activePlayerId != null ? { playerId: activePlayerId } : {}),
      ...payload,
    };

    if (!activeSocket?.connected) {
      console.warn(`[Socket] ${event}: socket not connected, queuing`, fullPayload);
      pendingEmitsRef.current.push({ event, payload: fullPayload });
      return false;
    }

    console.log(`[Socket] ${event} emit:`, fullPayload);
    activeSocket.emit(event, fullPayload);
    return true;
  }, []);

  useEffect(() => {
    console.log("[Socket] Initializing connection to:", SOCKET_URL);

    const newSocket = io(SOCKET_URL, {
      path: "/socket.io",
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: Infinity,
      autoConnect: true,
    });

    socketRef.current = newSocket;

    newSocket.on("connect", () => {
      console.log("[Socket] connect event:", {
        id: newSocket.id,
        connected: newSocket.connected,
        url: SOCKET_URL,
      });
      setIsConnected(true);

      const joinPayload = lastJoinRef.current;
      if (joinPayload) {
        console.log("[Socket] join_room on connect:", joinPayload);
        newSocket.emit("join_room", joinPayload);
      }

      flushPendingEmits();
    });

    newSocket.on("disconnect", (reason) => {
      console.log("[Socket] disconnect:", reason);
      setIsConnected(false);
    });

    newSocket.on("connect_error", (error) => {
      console.error("[Socket] connect_error:", error.message, error);
      setIsConnected(false);
    });

    newSocket.on("players_updated", (data: { players: Player[]; spectators: Player[] }) => {
      console.log("[Socket] players_updated:", { playerCount: data.players.length });
      setPlayers(data.players);
      setSpectators(data.spectators);
    });

    newSocket.on("room_joined", (data: {
      players: Player[];
      spectators: Player[];
      roomId: number;
      gameStatus?: "waiting" | "playing" | "voting" | "ended";
      currentRound?: number;
      currentRoundId?: number | null;
    }) => {
      console.log("[Socket] room_joined:", data);
      setPlayers(data.players);
      setSpectators(data.spectators);
      if (data.gameStatus) setGameStatus(data.gameStatus);
      if (data.currentRound !== undefined) setCurrentRound(data.currentRound);
      if (data.currentRoundId !== undefined) setCurrentRoundId(data.currentRoundId ?? null);
    });

    newSocket.on("game_state_updated", (data: {
      gameStatus: "waiting" | "playing" | "voting" | "ended";
      currentRound: number;
      currentRoundId?: number | null;
    }) => {
      console.log("[Socket] game_state_updated:", data);
      setGameStatus(data.gameStatus);
      setCurrentRound(data.currentRound);
      if (data.currentRoundId !== undefined) setCurrentRoundId(data.currentRoundId ?? null);
    });

    newSocket.on("game_started", (data: { roundNumber: number; roundId?: number; gameMode: string }) => {
      console.log("[Socket] game_started:", data);
      setGameStatus("playing");
      setCurrentRound(data.roundNumber);
      if (data.roundId) setCurrentRoundId(data.roundId);
    });

    newSocket.on("round_started", (data: { roundId: number; roundNumber: number; timeLimit: number }) => {
      console.log("[Socket] round_started:", data);
      setGameStatus("playing");
      setCurrentRound(data.roundNumber);
      setCurrentRoundId(data.roundId);
    });

    newSocket.on("round_ended", () => {
      console.log("[Socket] round_ended");
      setGameStatus("voting");
    });

    newSocket.on("chat_message_received", (data: ChatMessage) => {
      console.log("[Socket] chat_message_received:", data);
      setChatMessages((prev) => [...prev, { ...data, timestamp: new Date(data.timestamp) }]);
    });

    newSocket.on("error", (data: { message: string }) => {
      console.error("[Socket] server error:", data.message);
    });

    setSocket(newSocket);

    return () => {
      console.log("[Socket] Cleaning up socket");
      newSocket.removeAllListeners();
      newSocket.disconnect();
      socketRef.current = null;
    };
  }, [flushPendingEmits]);

  const joinRoom = useCallback((
    joinRoomId: number,
    joinPlayerId: number,
    nickname: string,
    role: "player" | "spectator",
    code?: string,
  ) => {
    const payload: JoinRoomPayload = {
      roomId: joinRoomId,
      playerId: joinPlayerId,
      nickname,
      role,
    };

    console.log("[Socket] joinRoom called:", {
      ...payload,
      roomCode: code,
      socketConnected: socketRef.current?.connected ?? false,
    });

    // Session is set immediately — does not wait for socket connection
    setSession(joinRoomId, joinPlayerId, code);
    setGameStatus("waiting");
    setChatMessages([]);

    emitJoinRoom(payload);
  }, [setSession, emitJoinRoom]);

  const leaveRoom = useCallback(() => {
    const activeSocket = socketRef.current;
    const activeRoomId = roomIdRef.current;
    const activePlayerId = playerIdRef.current;

    if (activeSocket?.connected && activeRoomId && activePlayerId) {
      console.log("[Socket] leave_room emit:", { roomId: activeRoomId, playerId: activePlayerId });
      activeSocket.emit("leave_room", { roomId: activeRoomId, playerId: activePlayerId });
    }

    lastJoinRef.current = null;
    pendingEmitsRef.current = [];
    roomIdRef.current = null;
    playerIdRef.current = null;
    setRoomId(null);
    setPlayerId(null);
    setRoomCode(null);
    setPlayers([]);
    setSpectators([]);
    setChatMessages([]);
    setGameStatus(null);
    setCurrentRound(0);
    setCurrentRoundId(null);
  }, []);

  const startGame = useCallback(() => {
    emitToRoom("start_game", {});
  }, [emitToRoom]);

  const startRound = useCallback((roundId: number) => {
    emitToRoom("start_round", { roundId });
  }, [emitToRoom]);

  const submitResponse = useCallback((roundId: number, submitPlayerId: number, content: string) => {
    emitToRoom("submit_response", { roundId, playerId: submitPlayerId, content });
  }, [emitToRoom]);

  const submitVote = useCallback((roundId: number, voterId: number, responseId: number) => {
    emitToRoom("submit_vote", { roundId, voterId, responseId });
  }, [emitToRoom]);

  const endRound = useCallback((roundId: number) => {
    emitToRoom("end_round", { roundId });
  }, [emitToRoom]);

  const sendChatMessage = useCallback((message: string) => {
    const activePlayerId = playerIdRef.current;
    if (!activePlayerId) {
      console.warn("[Socket] chat_message: playerId not set — call joinRoom first");
      return;
    }
    emitToRoom("chat_message", { message });
  }, [emitToRoom]);

  const sendEmojiReaction = useCallback((emoji: string) => {
    const activePlayerId = playerIdRef.current;
    if (!activePlayerId) return;
    emitToRoom("emoji_reaction", { emoji });
  }, [emitToRoom]);

  const value: GameContextType = {
    socket,
    isConnected,
    roomId,
    playerId,
    roomCode,
    players,
    spectators,
    chatMessages,
    gameStatus,
    currentRound,
    currentRoundId,
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
