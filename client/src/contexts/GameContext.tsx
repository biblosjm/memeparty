import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";

export interface Player {
  playerId: number;
  nickname: string;
  role: "player" | "spectator";
  score?: number;
  level?: number;
  socketId: string;
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
  joinRoom: (roomId: number, playerId: number, nickname: string, role: "player" | "spectator") => void;
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

  // Initialize socket connection
  useEffect(() => {
    const newSocket = io(window.location.origin, {
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
    });

    newSocket.on("connect", () => {
      console.log("[Socket] Connected:", newSocket.id);
      setIsConnected(true);
    });

    newSocket.on("disconnect", () => {
      console.log("[Socket] Disconnected");
      setIsConnected(false);
    });

    newSocket.on("players_updated", (data: { players: Player[]; spectators: Player[] }) => {
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

    newSocket.on("round_ended", (data: { roundId: number; results: any[]; winner: any }) => {
      setGameStatus("voting");
    });

    newSocket.on("error", (data: { message: string }) => {
      console.error("[Socket] Error:", data.message);
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, []);

  const joinRoom = useCallback((roomId: number, playerId: number, nickname: string, role: "player" | "spectator") => {
    if (!socket) return;

    setRoomId(roomId);
    setPlayerId(playerId);

    socket.emit("join_room", {
      roomId,
      playerId,
      nickname,
      role,
    });
  }, [socket]);

  const leaveRoom = useCallback(() => {
    if (!socket || !roomId || !playerId) return;

    socket.emit("leave_room", {
      roomId,
      playerId,
    });

    setRoomId(null);
    setPlayerId(null);
    setRoomCode(null);
    setPlayers([]);
    setSpectators([]);
    setGameStatus(null);
    setCurrentRound(0);
  }, [socket, roomId, playerId]);

  const startGame = useCallback(() => {
    if (!socket || !roomId) return;

    socket.emit("start_game", {
      roomId,
    });
  }, [socket, roomId]);

  const startRound = useCallback((roundId: number) => {
    if (!socket || !roomId) return;

    socket.emit("start_round", {
      roomId,
      roundId,
    });
  }, [socket, roomId]);

  const submitResponse = useCallback((roundId: number, playerId: number, content: string) => {
    if (!socket || !roomId) return;

    socket.emit("submit_response", {
      roomId,
      roundId,
      playerId,
      content,
    });
  }, [socket, roomId]);

  const submitVote = useCallback((roundId: number, voterId: number, responseId: number) => {
    if (!socket || !roomId) return;

    socket.emit("submit_vote", {
      roomId,
      roundId,
      voterId,
      responseId,
    });
  }, [socket, roomId]);

  const endRound = useCallback((roundId: number) => {
    if (!socket || !roomId) return;

    socket.emit("end_round", {
      roomId,
      roundId,
    });
  }, [socket, roomId]);

  const sendChatMessage = useCallback((message: string) => {
    if (!socket || !roomId || !playerId) return;

    socket.emit("chat_message", {
      roomId,
      playerId,
      message,
    });
  }, [socket, roomId, playerId]);

  const sendEmojiReaction = useCallback((emoji: string) => {
    if (!socket || !roomId || !playerId) return;

    socket.emit("emoji_reaction", {
      roomId,
      playerId,
      emoji,
    });
  }, [socket, roomId, playerId]);

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
