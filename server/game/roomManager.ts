import type { Server as SocketIOServer, Socket } from "socket.io";
import {
  C2S,
  S2C,
  TIMERS_SEC,
  MAX_ROUNDS,
  type GamePhase,
  type PublicRoomState,
  type JoinRoomPayload,
} from "../../shared/game";
import * as db from "../db";

interface InternalPlayer {
  id: number;
  nickname: string;
  score: number;
  hasSubmitted: boolean;
  hasVoted: boolean;
  socketId: string | null;
}

interface InternalSubmission {
  id: string;
  playerId: number;
  nickname: string;
  content: string;
  votes: number;
}

interface Room {
  roomId: number;
  roomCode: string;
  hostPlayerId: number;
  phase: GamePhase;
  roundNumber: number;
  maxRounds: number;
  imageUrl: string | null;
  players: Map<number, InternalPlayer>;
  submissions: InternalSubmission[];
  votes: Map<number, string>; // voterId -> submissionId
  timer: ReturnType<typeof setTimeout> | null;
  timerEndsAt: number | null;
  winnerSubmissionId: string | null;
}

const rooms = new Map<number, Room>();
const playerToRoom = new Map<number, number>();
let io: SocketIOServer | null = null;

function randomImageUrl(roomId: number, round: number): string {
  return `https://picsum.photos/seed/memeparty-${roomId}-${round}/800/500`;
}

function clearTimer(room: Room) {
  if (room.timer) {
    clearTimeout(room.timer);
    room.timer = null;
  }
}

function getTimerSeconds(room: Room): number | null {
  if (!room.timerEndsAt) return null;
  return Math.max(0, Math.ceil((room.timerEndsAt - Date.now()) / 1000));
}

function toPublicState(room: Room, viewerPlayerId?: number): PublicRoomState {
  const phase = room.phase;
  let submissions = room.submissions.map((s) => ({
    id: s.id,
    content: s.content,
    voteCount: s.votes,
  }));

  if (phase === "VOTING") {
    submissions = submissions.map((s) => {
      const internal = room.submissions.find((x) => x.id === s.id)!;
      if (internal.playerId === viewerPlayerId) {
        return { ...s, content: "(내 답변)", authorId: internal.playerId };
      }
      return s;
    });
  }

  if (phase === "RESULT" || phase === "NEXT_ROUND") {
    submissions = room.submissions.map((s) => {
      const internal = room.submissions.find((x) => x.id === s.id)!;
      return {
        id: s.id,
        content: s.content,
        voteCount: s.votes,
        authorId: internal.playerId,
        authorNickname: internal.nickname,
      };
    });
  }

  const winner = room.winnerSubmissionId
    ? room.submissions.find((s) => s.id === room.winnerSubmissionId)
    : null;

  return {
    roomId: room.roomId,
    roomCode: room.roomCode,
    hostPlayerId: room.hostPlayerId,
    phase: room.phase,
    roundNumber: room.roundNumber,
    maxRounds: room.maxRounds,
    imageUrl: room.imageUrl,
    players: Array.from(room.players.values()).map((p) => ({
      id: p.id,
      nickname: p.nickname,
      score: p.score,
      hasSubmitted: p.hasSubmitted,
      hasVoted: p.hasVoted,
      isConnected: !!p.socketId,
    })),
    submissions,
    timerSeconds: getTimerSeconds(room),
    winnerSubmissionId: room.winnerSubmissionId,
    winnerNickname: winner?.nickname ?? null,
  };
}

function broadcast(room: Room) {
  if (!io) return;
  for (const player of room.players.values()) {
    if (player.socketId) {
      io.to(player.socketId).emit(S2C.ROOM_UPDATED, toPublicState(room, player.id));
    }
  }
}

function schedulePhase(room: Room, delayMs: number, next: () => void) {
  clearTimer(room);
  room.timerEndsAt = Date.now() + delayMs;
  room.timer = setTimeout(() => {
    room.timer = null;
    room.timerEndsAt = null;
    next();
  }, delayMs);
}

function resetRoundFlags(room: Room) {
  for (const p of room.players.values()) {
    p.hasSubmitted = false;
    p.hasVoted = false;
  }
  room.submissions = [];
  room.votes.clear();
  room.winnerSubmissionId = null;
}

function allSubmitted(room: Room): boolean {
  const active = Array.from(room.players.values()).filter((p) => p.socketId);
  if (active.length === 0) return false;
  return active.every((p) => p.hasSubmitted);
}

function allVoted(room: Room): boolean {
  const active = Array.from(room.players.values()).filter((p) => p.socketId);
  if (active.length === 0) return false;
  return active.every((p) => p.hasVoted);
}

function startSubmittingPhase(room: Room) {
  room.phase = "PLAYING";
  room.imageUrl = randomImageUrl(room.roomId, room.roundNumber);
  broadcast(room);
  io?.to(`room-${room.roomId}`).emit(S2C.GAME_STARTED, {
    roundNumber: room.roundNumber,
    imageUrl: room.imageUrl,
  });

  schedulePhase(room, TIMERS_SEC.PLAYING * 1000, () => {
    room.phase = "SUBMITTING";
    resetRoundFlags(room);
    room.submissions = [];
    broadcast(room);
    io?.to(`room-${room.roomId}`).emit(S2C.ROUND_STARTED, {
      roundNumber: room.roundNumber,
      timerSeconds: TIMERS_SEC.SUBMITTING,
    });

    schedulePhase(room, TIMERS_SEC.SUBMITTING * 1000, () => startVotingPhase(room));
  });
}

function startVotingPhase(room: Room) {
  if (room.submissions.length === 0) {
    room.phase = "WAITING";
    broadcast(room);
    return;
  }

  room.phase = "VOTING";
  broadcast(room);
  io?.to(`room-${room.roomId}`).emit(S2C.VOTE_STARTED, {
    roundNumber: room.roundNumber,
    timerSeconds: TIMERS_SEC.VOTING,
  });

  schedulePhase(room, TIMERS_SEC.VOTING * 1000, () => showResult(room));
}

function showResult(room: Room) {
  room.phase = "RESULT";
  let top = room.submissions[0];
  for (const s of room.submissions) {
    if (s.votes > top.votes) top = s;
  }
  if (top) {
    room.winnerSubmissionId = top.id;
    const winner = room.players.get(top.playerId);
    if (winner) winner.score += top.votes + 1;
  }

  broadcast(room);
  io?.to(`room-${room.roomId}`).emit(S2C.RESULT_UPDATED, {
    winnerSubmissionId: room.winnerSubmissionId,
    winnerNickname: top?.nickname ?? null,
  });

  schedulePhase(room, TIMERS_SEC.RESULT * 1000, () => goNextRound(room));
}

function goNextRound(room: Room) {
  if (room.roundNumber >= room.maxRounds) {
    room.phase = "WAITING";
    room.roundNumber = 0;
    room.imageUrl = null;
    resetRoundFlags(room);
    broadcast(room);
    return;
  }

  room.phase = "NEXT_ROUND";
  broadcast(room);
  io?.to(`room-${room.roomId}`).emit(S2C.NEXT_ROUND, {
    roundNumber: room.roundNumber + 1,
  });

  schedulePhase(room, 1500, () => {
    room.roundNumber += 1;
    startSubmittingPhase(room);
  });
}

async function ensureRoom(roomId: number, roomCode: string): Promise<Room> {
  let room = rooms.get(roomId);
  if (room) return room;

  const dbRoom = await db.getRoomById(roomId);
  if (!dbRoom) throw new Error("Room not found");

  const dbPlayers = await db.getPlayersByRoomId(roomId);
  const sorted = [...dbPlayers].sort(
    (a, b) => new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime(),
  );

  room = {
    roomId,
    roomCode: roomCode || dbRoom.roomCode,
    hostPlayerId: sorted[0]?.id ?? 0,
    phase: "WAITING",
    roundNumber: 0,
    maxRounds: MAX_ROUNDS,
    imageUrl: null,
    players: new Map(),
    submissions: [],
    votes: new Map(),
    timer: null,
    timerEndsAt: null,
    winnerSubmissionId: null,
  };

  for (const p of dbPlayers) {
    room.players.set(p.id, {
      id: p.id,
      nickname: p.nickname,
      score: p.score,
      hasSubmitted: false,
      hasVoted: false,
      socketId: null,
    });
  }

  rooms.set(roomId, room);
  return room;
}

export function initRoomManager(socketServer: SocketIOServer) {
  io = socketServer;

  io.on("connection", (socket: Socket) => {
    console.log(`[Game] socket connected: ${socket.id}`);

    socket.on(C2S.JOIN_ROOM, async (data: JoinRoomPayload, ack?: (r: unknown) => void) => {
      try {
        const { roomId, roomCode, playerId, nickname } = data;
        const room = await ensureRoom(roomId, roomCode);

        await socket.join(`room-${roomId}`);
        playerToRoom.set(playerId, roomId);

        let player = room.players.get(playerId);
        if (!player) {
          player = {
            id: playerId,
            nickname,
            score: 0,
            hasSubmitted: false,
            hasVoted: false,
            socketId: socket.id,
          };
          room.players.set(playerId, player);
        } else {
          player.nickname = nickname;
          player.socketId = socket.id;
        }

        if (!room.hostPlayerId) room.hostPlayerId = playerId;

        console.log(`[Game] JOIN_ROOM player=${playerId} room=${roomId}`);
        socket.emit(S2C.ROOM_UPDATED, toPublicState(room, playerId));
        broadcast(room);
        ack?.({ ok: true });
      } catch (err) {
        console.error("[Game] JOIN_ROOM error:", err);
        socket.emit(S2C.ERROR, { message: "방 입장에 실패했습니다." });
        ack?.({ ok: false });
      }
    });

    socket.on(C2S.LEAVE_ROOM, (data: { roomId: number; playerId: number }) => {
      handleLeave(data.roomId, data.playerId, socket);
    });

    socket.on(C2S.START_GAME, (data: { roomId: number; playerId: number }) => {
      const room = rooms.get(data.roomId);
      if (!room) return;
      if (room.hostPlayerId !== data.playerId) {
        socket.emit(S2C.ERROR, { message: "방장만 게임을 시작할 수 있습니다." });
        return;
      }
      if (room.phase !== "WAITING") {
        socket.emit(S2C.ERROR, { message: "이미 게임이 진행 중입니다." });
        return;
      }
      if (room.players.size < 1) {
        socket.emit(S2C.ERROR, { message: "플레이어가 부족합니다." });
        return;
      }

      clearTimer(room);
      room.roundNumber = 1;
      resetRoundFlags(room);
      console.log(`[Game] START_GAME room=${room.roomId}`);
      startSubmittingPhase(room);
    });

    socket.on(C2S.SUBMIT_ANSWER, (data: { roomId: number; playerId: number; content: string }) => {
      const room = rooms.get(data.roomId);
      if (!room || room.phase !== "SUBMITTING") return;

      const player = room.players.get(data.playerId);
      if (!player || player.hasSubmitted) return;

      const trimmed = data.content.trim();
      if (!trimmed) return;

      player.hasSubmitted = true;
      room.submissions.push({
        id: `${data.playerId}-${Date.now()}`,
        playerId: data.playerId,
        nickname: player.nickname,
        content: trimmed,
        votes: 0,
      });

      broadcast(room);
      if (allSubmitted(room)) {
        clearTimer(room);
        startVotingPhase(room);
      }
    });

    socket.on(C2S.SUBMIT_VOTE, (data: { roomId: number; playerId: number; submissionId: string }) => {
      const room = rooms.get(data.roomId);
      if (!room || room.phase !== "VOTING") return;

      const player = room.players.get(data.playerId);
      if (!player || player.hasVoted) return;

      const submission = room.submissions.find((s) => s.id === data.submissionId);
      if (!submission) return;
      if (submission.playerId === data.playerId) return;

      player.hasVoted = true;
      room.votes.set(data.playerId, data.submissionId);
      submission.votes += 1;

      broadcast(room);
      if (allVoted(room)) {
        clearTimer(room);
        showResult(room);
      }
    });

    socket.on("disconnect", () => {
      for (const [playerId, roomId] of playerToRoom.entries()) {
        const room = rooms.get(roomId);
        if (!room) continue;
        const player = room.players.get(playerId);
        if (player?.socketId === socket.id) {
          handleLeave(roomId, playerId, socket, false);
          break;
        }
      }
    });
  });
}

function handleLeave(roomId: number, playerId: number, socket: Socket, removeFromDb = true) {
  const room = rooms.get(roomId);
  if (!room) return;

  const player = room.players.get(playerId);
  if (player) player.socketId = null;

  playerToRoom.delete(playerId);
  socket.leave(`room-${roomId}`);

  broadcast(room);

  const connected = Array.from(room.players.values()).some((p) => p.socketId);
  if (!connected) {
    clearTimer(room);
    rooms.delete(roomId);
  }

  console.log(`[Game] LEAVE_ROOM player=${playerId} room=${roomId}`);
}

export function getRoomForTest(roomId: number): Room | undefined {
  return rooms.get(roomId);
}
