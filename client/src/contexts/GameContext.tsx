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

  const emitToRoom = useCallback((event: string, payload: Record<string, unknown>) => {
    const activeSocket = socketRef.current;
    const activeRoomId = roomIdRef.current;

    if (!activeSocket?.connected) {
      console.warn(`[Socket] ${event}: socket not connected`, payload);
      return false;
    }
    if (!activeRoomId) {
      console.warn(`[Socket] ${event}: roomId not set`, payload);
      return false;
    }

    console.log(`[Socket] ${event} emit:`, { roomId: activeRoomId, ...payload });
    activeSocket.emit(event, { roomId: activeRoomId, ...payload });
    return true;
  }, []);

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

    console.log("[Socket] joinRoom called:", { ...payload, roomCode: code });

    roomIdRef.current = joinRoomId;
    playerIdRef.current = joinPlayerId;
    setRoomId(joinRoomId);
    setPlayerId(joinPlayerId);
    if (code) setRoomCode(code);
    setGameStatus("waiting");
    setChatMessages([]);

    pendingJoinRef.current = payload;
    emitJoinRoom(payload);
  }, [emitJoinRoom]);

  const leaveRoom = useCallback(() => {
    const activeSocket = socketRef.current;
    const activeRoomId = roomIdRef.current;
    const activePlayerId = playerIdRef.current;

    if (activeSocket && activeRoomId && activePlayerId) {
      console.log("[Socket] leave_room emit:", { roomId: activeRoomId, playerId: activePlayerId });
      activeSocket.emit("leave_room", { roomId: activeRoomId, playerId: activePlayerId });
    }

    pendingJoinRef.current = null;
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
    const activePlayerId = playerIdRef.current;
    emitToRoom("start_game", { playerId: activePlayerId });
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
      console.warn("[Socket] chat_message: playerId not set");
      return;
    }
    emitToRoom("chat_message", { playerId: activePlayerId, message });
  }, [emitToRoom]);

  const sendEmojiReaction = useCallback((emoji: string) => {
    const activePlayerId = playerIdRef.current;
    if (!activePlayerId) return;
    emitToRoom("emoji_reaction", { playerId: activePlayerId, emoji });
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
