import { Server as SocketIOServer, Socket } from "socket.io";
import { Server as HTTPServer } from "http";
import * as db from "../db";

interface GameRoomState {
  roomId: number;
  roomCode: string;
  players: Map<number, any>;
  spectators: Map<number, any>;
  currentRound: number;
  gameStatus: "waiting" | "playing" | "voting" | "ended";
}

const roomStates = new Map<number, GameRoomState>();
const playerSockets = new Map<number, string>(); // playerId -> socketId

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

      try {
        socket.join(`room-${roomId}`);
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
            currentRound: room.currentRound,
            gameStatus: room.status as any,
          };
          roomStates.set(roomId, roomState);
        }

        const playerInfo = { playerId, nickname, role, socketId: socket.id };
        if (role === "player") {
          roomState.players.set(playerId, playerInfo);
        } else {
          roomState.spectators.set(playerId, playerInfo);
        }

        // 모든 클라이언트에게 플레이어 목록 업데이트
        io.to(`room-${roomId}`).emit("players_updated", {
          players: Array.from(roomState.players.values()),
          spectators: Array.from(roomState.spectators.values()),
        });

        console.log(`[WebSocket] Player ${playerId} (${nickname}) joined room ${roomId} as ${role}`);
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

          io.to(`room-${roomId}`).emit("players_updated", {
            players: Array.from(roomState.players.values()),
            spectators: Array.from(roomState.spectators.values()),
          });

          // 방이 비어있으면 상태 제거
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
    socket.on("start_game", async (data: { roomId: number }) => {
      const { roomId } = data;

      try {
        const roomState = roomStates.get(roomId);
        if (!roomState) throw new Error("Room state not found");

        roomState.gameStatus = "playing";
        roomState.currentRound = 1;

        io.to(`room-${roomId}`).emit("game_started", {
          roundNumber: 1,
          gameMode: "meme_title",
        });

        console.log(`[WebSocket] Game started in room ${roomId}`);
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
          timeLimit: 40, // 40초
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
          playerId,
          content,
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
        const vote = await db.createVote({
          roundId,
          voterId,
          responseId,
        });

        // 응답의 투표 수 업데이트
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

      try {
        const chatMessage = await db.createChatMessage({
          roomId,
          playerId,
          message,
        });

        const player = await db.getPlayerById(playerId);

        io.to(`room-${roomId}`).emit("chat_message_received", {
          messageId: chatMessage.insertId,
          playerId,
          nickname: player?.nickname || "Unknown",
          message,
          timestamp: new Date(),
        });

        console.log(`[WebSocket] Chat message from player ${playerId} in room ${roomId}`);
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
        const reaction = await db.createEmojiReaction({
          roomId,
          playerId,
          emoji,
        });

        const player = await db.getPlayerById(playerId);

        io.to(`room-${roomId}`).emit("emoji_reaction_received", {
          reactionId: reaction.insertId,
          playerId,
          nickname: player?.nickname || "Unknown",
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

      // 플레이어 소켓 매핑에서 제거
      const entries = Array.from(playerSockets.entries());
      for (const [playerId, socketId] of entries) {
        if (socketId === socket.id) {
          playerSockets.delete(playerId);
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
