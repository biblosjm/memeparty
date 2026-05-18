/**
 * MemeParty MVP — shared game types & socket contract
 * Server is the single source of truth for room/game state.
 */

export const GAME_PHASES = [
  "WAITING",
  "PLAYING",
  "SUBMITTING",
  "VOTING",
  "RESULT",
  "NEXT_ROUND",
] as const;

export type GamePhase = (typeof GAME_PHASES)[number];

export const TIMERS_SEC = {
  PLAYING: 3,
  SUBMITTING: 30,
  VOTING: 15,
  RESULT: 5,
} as const;

export const MAX_ROUNDS = 3;

/** Client → Server */
export const C2S = {
  JOIN_ROOM: "JOIN_ROOM",
  LEAVE_ROOM: "LEAVE_ROOM",
  START_GAME: "START_GAME",
  SUBMIT_ANSWER: "SUBMIT_ANSWER",
  SUBMIT_VOTE: "SUBMIT_VOTE",
} as const;

/** Server → Client */
export const S2C = {
  ROOM_UPDATED: "ROOM_UPDATED",
  GAME_STARTED: "GAME_STARTED",
  ROUND_STARTED: "ROUND_STARTED",
  VOTE_STARTED: "VOTE_STARTED",
  RESULT_UPDATED: "RESULT_UPDATED",
  NEXT_ROUND: "NEXT_ROUND",
  ERROR: "ERROR",
} as const;

export interface PublicPlayer {
  id: number;
  nickname: string;
  score: number;
  hasSubmitted: boolean;
  hasVoted: boolean;
  isConnected: boolean;
}

/** Voting uses opaque id; author hidden until RESULT */
export interface PublicSubmission {
  id: string;
  content: string;
  voteCount: number;
  authorId?: number;
  authorNickname?: string;
}

export interface PublicRoomState {
  roomId: number;
  roomCode: string;
  hostPlayerId: number;
  phase: GamePhase;
  roundNumber: number;
  maxRounds: number;
  imageUrl: string | null;
  players: PublicPlayer[];
  submissions: PublicSubmission[];
  timerSeconds: number | null;
  winnerSubmissionId: string | null;
  winnerNickname: string | null;
}

export interface JoinRoomPayload {
  roomId: number;
  roomCode: string;
  playerId: number;
  nickname: string;
}

export interface SubmitAnswerPayload {
  roomId: number;
  playerId: number;
  content: string;
}

export interface SubmitVotePayload {
  roomId: number;
  playerId: number;
  submissionId: string;
}
