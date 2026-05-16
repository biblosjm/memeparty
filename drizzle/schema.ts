import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, bigint, boolean, json } from "drizzle-orm/mysql-core";
import { relations } from "drizzle-orm";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Game Rooms - 게임 방
 */
export const rooms = mysqlTable("rooms", {
  id: int("id").autoincrement().primaryKey(),
  roomCode: varchar("roomCode", { length: 8 }).notNull().unique(), // 초대 코드
  status: mysqlEnum("status", ["waiting", "playing", "ended"]).default("waiting").notNull(),
  gameMode: mysqlEnum("gameMode", ["meme_title", "internet_culture", "friend_predict"]).notNull(),
  maxPlayers: int("maxPlayers").default(8).notNull(),
  currentRound: int("currentRound").default(0).notNull(),
  totalRounds: int("totalRounds").default(3).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Room = typeof rooms.$inferSelect;
export type InsertRoom = typeof rooms.$inferInsert;

/**
 * Players - 게임 플레이어
 */
export const players = mysqlTable("players", {
  id: int("id").autoincrement().primaryKey(),
  roomId: int("roomId").notNull(),
  nickname: varchar("nickname", { length: 64 }).notNull(),
  role: mysqlEnum("role", ["player", "spectator"]).default("player").notNull(),
  score: int("score").default(0).notNull(),
  level: int("level").default(1).notNull(),
  exp: int("exp").default(0).notNull(),
  winStreak: int("winStreak").default(0).notNull(),
  isMvp: boolean("isMvp").default(false).notNull(),
  joinedAt: timestamp("joinedAt").defaultNow().notNull(),
  leftAt: timestamp("leftAt"),
});

export type Player = typeof players.$inferSelect;
export type InsertPlayer = typeof players.$inferInsert;

/**
 * Game Rounds - 게임 라운드
 */
export const gameRounds = mysqlTable("gameRounds", {
  id: int("id").autoincrement().primaryKey(),
  roomId: int("roomId").notNull(),
  roundNumber: int("roundNumber").notNull(),
  status: mysqlEnum("status", ["waiting", "playing", "voting", "ended"]).default("waiting").notNull(),
  gameMode: mysqlEnum("gameMode", ["meme_title", "internet_culture", "friend_predict"]).notNull(),
  questionId: int("questionId"),
  imageUrl: text("imageUrl"), // AI 생성 이미지 URL
  startedAt: timestamp("startedAt"),
  endedAt: timestamp("endedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type GameRound = typeof gameRounds.$inferSelect;
export type InsertGameRound = typeof gameRounds.$inferInsert;

/**
 * Game Questions - 게임 문제
 */
export const gameQuestions = mysqlTable("gameQuestions", {
  id: int("id").autoincrement().primaryKey(),
  gameMode: mysqlEnum("gameMode", ["meme_title", "internet_culture", "friend_predict"]).notNull(),
  content: text("content").notNull(), // 문제 내용
  options: json("options"), // 선택지 (객관식)
  correctAnswer: text("correctAnswer"), // 정답
  difficulty: mysqlEnum("difficulty", ["easy", "medium", "hard"]).default("medium").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type GameQuestion = typeof gameQuestions.$inferSelect;
export type InsertGameQuestion = typeof gameQuestions.$inferInsert;

/**
 * Game Responses - 플레이어 응답
 */
export const gameResponses = mysqlTable("gameResponses", {
  id: int("id").autoincrement().primaryKey(),
  roundId: int("roundId").notNull(),
  playerId: int("playerId").notNull(),
  content: text("content").notNull(), // 답변 내용
  voteCount: int("voteCount").default(0).notNull(),
  isCorrect: boolean("isCorrect").default(false), // 정답 여부
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type GameResponse = typeof gameResponses.$inferSelect;
export type InsertGameResponse = typeof gameResponses.$inferInsert;

/**
 * Votes - 투표
 */
export const votes = mysqlTable("votes", {
  id: int("id").autoincrement().primaryKey(),
  roundId: int("roundId").notNull(),
  voterId: int("voterId").notNull(),
  responseId: int("responseId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Vote = typeof votes.$inferSelect;
export type InsertVote = typeof votes.$inferInsert;

/**
 * Emoji Reactions - 이모지 반응
 */
export const emojiReactions = mysqlTable("emojiReactions", {
  id: int("id").autoincrement().primaryKey(),
  roomId: int("roomId").notNull(),
  playerId: int("playerId").notNull(),
  emoji: varchar("emoji", { length: 10 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type EmojiReaction = typeof emojiReactions.$inferSelect;
export type InsertEmojiReaction = typeof emojiReactions.$inferInsert;

/**
 * Chat Messages - 채팅 메시지
 */
export const chatMessages = mysqlTable("chatMessages", {
  id: int("id").autoincrement().primaryKey(),
  roomId: int("roomId").notNull(),
  playerId: int("playerId").notNull(),
  message: text("message").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ChatMessage = typeof chatMessages.$inferSelect;
export type InsertChatMessage = typeof chatMessages.$inferInsert;