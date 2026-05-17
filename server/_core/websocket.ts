import { Server as SocketIOServer, Socket } from "socket.io";
import { Server as HTTPServer } from "http";
import * as db from "../db";

interface PlayerInfo {
  playerId: number;
  nickname: string;
  role: "player" | "spectator";
  socketId: string;
}

interface GameRoomState {
  roomId: number;
  roomCode: string;
  players: Map<number, PlayerInfo>;
  spectators: Map<number, PlayerInfo>;
  currentRound: number;
  currentRoundId: number | null;
  gameStatus: "waiting" | "playing" | "voting" | "ended";
  gameMode: string;
}

function getPlayerNickname(roomState: GameRoomState | undefined, playerId: number): string {
  if (!roomState) return "Unknown";
  return (
    roomState.players.get(playerId)?.nickname ??
    roomState.spectators.get(playerId)?.nickname ??
    "Unknown"
  );
}

function buildGameStatePayload(roomState: GameRoomState) {
  return {
    gameStatus: roomState.gameStatus,
    currentRound: roomState.currentRound,
    currentRoundId: roomState.currentRoundId,
    gameMode: roomState.gameMode,
  };
}

const roomStates = new Map<number, GameRoomState>();
const playerSockets = new Map<number, string>(); // playerId -> socketId

function buildPlayersPayload(roomState: GameRoomState) {
  return {
    players: Array.from(roomState.players.values()),
    spectators: Array.from(roomState.spectators.values()),
  };
}

async function syncPlayersFromDatabase(roomState: GameRoomState, roomId: number) {
  const dbPlayers = await db.getPlayersByRoomId(roomId);

  for (const dbPlayer of dbPlayers) {
    const existingSocketId = playerSockets.get(dbPlayer.id) ?? "";
    const info: PlayerInfo = {
      playerId: dbPlayer.id,
      nickname: dbPlayer.nickname,
      role: dbPlayer.role as "player" | "spectator",
      socketId: existingSocketId,
    };

    if (dbPlayer.role === "spectator") {
      roomState.spectators.set(dbPlayer.id, info);
    } else {
      roomState.players.set(dbPlayer.id, info);
    }
  }
}

function removePlayerFromAllRooms(playerId: number, io: SocketIOServer) {
  for (const [roomId, roomState] of Array.from(roomStates.entries())) {
    const removedFromPlayers = roomState.players.delete(playerId);
    const removedFromSpectators = roomState.spectators.delete(playerId);

    if (removedFromPlayers || removedFromSpectators) {
      const payload = buildPlayersPayload(roomState);
      io.to(`room-${roomId}`).emit("players_updated", payload);
      console.log(`[WebSocket] Player ${playerId} removed from room ${roomId} on disconnect`);

      if (roomState.players.size === 0 && roomState.spectators.size === 0) {
        roomStates.delete(roomId);
      }
    }
  }
}

export function setupWebSocket(httpServer: HTTPServer) {
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  io.on("connection", (socket: Socket) => {
    console.log(`[WebSocket] Client connected: ${socket.id}`);

    /**
     * 플레이어가 방에 입장
     */
    socket.on("join_room", async (data: { roomId: number; playerId: number; nickname: string; role: "player" | "spectator" }) => {
      const { roomId, playerId, nickname, role } = data;

      console.log(`[WebSocket] join_room received:`, { roomId, playerId, nickname, role, socketId: socket.id });

      try {
        await socket.join(`room-${roomId}`);
        playerSockets.set(playerId, socket.id);

        let roomState = roomStates.get(roomId);
        if (!roomState) {
          const room = await db.getRoomById(roomId);
          if (!room) throw new Error("Room not found");

          roomState = {
            roomId,
            roomCode: room.roomCode,
            players: new Map(),
            spectators: new Map(),
            currentRound: room.currentRound || 0,
            currentRoundId: null,
            gameStatus: room.status === "playing" ? "playing" : "waiting",
            gameMode: room.gameMode,
          };
          roomStates.set(roomId, roomState);
        }

        // DB에 저장된 모든 플레이어를 room state에 동기화
        await syncPlayersFromDatabase(roomState, roomId);

        // 현재 접속한 플레이어의 socket 정보 업데이트
        const playerInfo: PlayerInfo = { playerId, nickname, role, socketId: socket.id };
        if (role === "player") {
          roomState.players.set(playerId, playerInfo);
          roomState.spectators.delete(playerId);
        } else {
          roomState.spectators.set(playerId, playerInfo);
          roomState.players.delete(playerId);
        }

        const payload = buildPlayersPayload(roomState);
        const gameState = buildGameStatePayload(roomState);

        io.to(`room-${roomId}`).emit("players_updated", payload);
        io.to(`room-${roomId}`).emit("game_state_updated", gameState);
        socket.emit("room_joined", {
          success: true,
          roomId,
          roomCode: roomState.roomCode,
          ...payload,
          ...gameState,
        });

        console.log(`[WebSocket] Player ${playerId} (${nickname}) joined room ${roomId} (${roomState.roomCode}), total players: ${payload.players.length}`);
      } catch (error) {
        console.error("[WebSocket] Error joining room:", error);
        socket.emit("error", { message: "Failed to join room" });
      }
    });

    /**
     * 플레이어가 방에서 퇴장
     */
    socket.on("leave_room", async (data: { roomId: number; playerId: number }) => {
      const { roomId, playerId } = data;

      try {
        socket.leave(`room-${roomId}`);
        playerSockets.delete(playerId);

        const roomState = roomStates.get(roomId);
        if (roomState) {
          roomState.players.delete(playerId);
          roomState.spectators.delete(playerId);

          const payload = buildPlayersPayload(roomState);
          io.to(`room-${roomId}`).emit("players_updated", payload);

          if (roomState.players.size === 0 && roomState.spectators.size === 0) {
            roomStates.delete(roomId);
          }
        }

        console.log(`[WebSocket] Player ${playerId} left room ${roomId}`);
      } catch (error) {
        console.error("[WebSocket] Error leaving room:", error);
      }
    });

    /**
     * 게임 시작
     */
    socket.on("start_game", async (data: { roomId: number; playerId?: number }) => {
      const { roomId } = data;

      console.log(`[WebSocket] start_game received:`, data);

      try {
        const roomState = roomStates.get(roomId);
        if (!roomState) throw new Error("Room state not found");

        const room = await db.getRoomById(roomId);
        if (!room) throw new Error("Room not found");

        let roundId = roomState.currentRoundId;
        if (!roundId) {
          try {
            await db.updateRoomStatus(roomId, "playing");
            const roundResult = await db.createGameRound({
              roomId,
              roundNumber: 1,
              status: "playing",
              gameMode: room.gameMode,
            });
            roundId = roundResult.insertId;
          } catch (dbError) {
            console.warn("[WebSocket] DB round creation failed, using in-memory round:", dbError);
            roundId = Date.now();
          }
        }

        roomState.gameStatus = "playing";
        roomState.currentRound = 1;
        roomState.currentRoundId = roundId;

        const gameStartedPayload = {
          roundNumber: 1,
          roundId,
          gameMode: roomState.gameMode,
        };
        const gameState = buildGameStatePayload(roomState);

        io.to(`room-${roomId}`).emit("game_started", gameStartedPayload);
        io.to(`room-${roomId}`).emit("game_state_updated", gameState);
        io.to(`room-${roomId}`).emit("round_started", {
          roundId,
          roundNumber: 1,
          timeLimit: 40,
        });

        console.log(`[WebSocket] Game started in room ${roomId}, roundId: ${roundId}`);
      } catch (error) {
        console.error("[WebSocket] Error starting game:", error);
        socket.emit("error", { message: "Failed to start game" });
      }
    });

    /**
     * 라운드 시작
     */
    socket.on("start_round", async (data: { roomId: number; roundId: number }) => {
      const { roomId, roundId } = data;

      try {
        const roomState = roomStates.get(roomId);
        if (!roomState) throw new Error("Room state not found");

        roomState.gameStatus = "playing";

        io.to(`room-${roomId}`).emit("round_started", {
          roundId,
          roundNumber: roomState.currentRound,
          timeLimit: 40,
        });

        console.log(`[WebSocket] Round ${roomState.currentRound} started in room ${roomId}`);
      } catch (error) {
        console.error("[WebSocket] Error starting round:", error);
        socket.emit("error", { message: "Failed to start round" });
      }
    });

    /**
     * 응답 제출
     */
    socket.on("submit_response", async (data: { roomId: number; roundId: number; playerId: number; content: string }) => {
      const { roomId, roundId, playerId, content } = data;

      try {
        const response = await db.createGameResponse({
          roundId,
          playerId,
          content,
          voteCount: 0,
          isCorrect: false,
        });

        io.to(`room-${roomId}`).emit("response_submitted", {
          responseId: response.insertId,
          id: response.insertId,
          playerId,
          content,
          voteCount: 0,
        });

        console.log(`[WebSocket] Response submitted by player ${playerId} in round ${roundId}`);
      } catch (error) {
        console.error("[WebSocket] Error submitting response:", error);
        socket.emit("error", { message: "Failed to submit response" });
      }
    });

    /**
     * 투표 제출
     */
    socket.on("submit_vote", async (data: { roomId: number; roundId: number; voterId: number; responseId: number }) => {
      const { roomId, roundId, voterId, responseId } = data;

      try {
        await db.createVote({
          roundId,
          voterId,
          responseId,
        });

        const responses = await db.getResponsesByRoundId(roundId);
        const response = responses.find(r => r.id === responseId);
        if (response) {
          await db.updateResponseVotes(responseId, response.voteCount + 1);
        }

        io.to(`room-${roomId}`).emit("vote_submitted", {
          responseId,
          voteCount: response ? response.voteCount + 1 : 1,
        });

        console.log(`[WebSocket] Vote submitted by player ${voterId} for response ${responseId}`);
      } catch (error) {
        console.error("[WebSocket] Error submitting vote:", error);
        socket.emit("error", { message: "Failed to submit vote" });
      }
    });

    /**
     * 라운드 종료 및 결과 공개
     */
    socket.on("end_round", async (data: { roomId: number; roundId: number }) => {
      const { roomId, roundId } = data;

      try {
        const roomState = roomStates.get(roomId);
        if (!roomState) throw new Error("Room state not found");

        roomState.gameStatus = "voting";

        const responses = await db.getResponsesByRoundId(roundId);
        const sortedResponses = responses.sort((a, b) => b.voteCount - a.voteCount);

        io.to(`room-${roomId}`).emit("round_ended", {
          roundId,
          results: sortedResponses,
          winner: sortedResponses[0],
        });

        console.log(`[WebSocket] Round ${roundId} ended in room ${roomId}`);
      } catch (error) {
        console.error("[WebSocket] Error ending round:", error);
        socket.emit("error", { message: "Failed to end round" });
      }
    });

    /**
     * 채팅 메시지
     */
    socket.on("chat_message", async (data: { roomId: number; playerId: number; message: string }) => {
      const { roomId, playerId, message } = data;

      console.log(`[WebSocket] chat_message received:`, { roomId, playerId, message });

      try {
        const roomState = roomStates.get(roomId);
        const nickname = getPlayerNickname(roomState, playerId);

        let messageId = Date.now();
        try {
          const chatMessage = await db.createChatMessage({ roomId, playerId, message });
          if (chatMessage.insertId) messageId = chatMessage.insertId;
        } catch (dbError) {
          console.warn("[WebSocket] Chat DB persist failed, broadcasting anyway:", dbError);
        }

        const payload = {
          messageId,
          playerId,
          nickname,
          message,
          timestamp: new Date(),
        };

        io.to(`room-${roomId}`).emit("chat_message_received", payload);
        console.log(`[WebSocket] Chat broadcast to room-${roomId}:`, payload);
      } catch (error) {
        console.error("[WebSocket] Error sending chat message:", error);
        socket.emit("error", { message: "Failed to send message" });
      }
    });

    /**
     * 이모지 반응
     */
    socket.on("emoji_reaction", async (data: { roomId: number; playerId: number; emoji: string }) => {
      const { roomId, playerId, emoji } = data;

      try {
        const roomState = roomStates.get(roomId);
        const nickname = getPlayerNickname(roomState, playerId);

        let reactionId = Date.now();
        try {
          const reaction = await db.createEmojiReaction({ roomId, playerId, emoji });
          if (reaction.insertId) reactionId = reaction.insertId;
        } catch (dbError) {
          console.warn("[WebSocket] Emoji DB persist failed, broadcasting anyway:", dbError);
        }

        io.to(`room-${roomId}`).emit("emoji_reaction_received", {
          reactionId,
          playerId,
          nickname,
          emoji,
          timestamp: new Date(),
        });

        console.log(`[WebSocket] Emoji reaction from player ${playerId} in room ${roomId}`);
      } catch (error) {
        console.error("[WebSocket] Error sending emoji reaction:", error);
        socket.emit("error", { message: "Failed to send reaction" });
      }
    });

    /**
     * 연결 해제
     */
    socket.on("disconnect", () => {
      console.log(`[WebSocket] Client disconnected: ${socket.id}`);

      const entries = Array.from(playerSockets.entries());
      for (const [pid, socketId] of entries) {
        if (socketId === socket.id) {
          playerSockets.delete(pid);
          removePlayerFromAllRooms(pid, io);
          break;
        }
      }
    });
  });

  return io;
}

export function getPlayerSocket(playerId: number): string | undefined {
  return playerSockets.get(playerId);
}

export function getRoomState(roomId: number): GameRoomState | undefined {
  return roomStates.get(roomId);
}
