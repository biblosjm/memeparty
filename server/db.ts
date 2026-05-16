import { eq, and, desc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, rooms, players, gameRounds, gameResponses, gameQuestions, votes, chatMessages, emojiReactions, InsertRoom, InsertPlayer, InsertGameRound, InsertGameResponse, InsertGameQuestion, InsertVote, InsertChatMessage, InsertEmojiReaction } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

/**
 * Room queries
 */
export async function createRoom(data: InsertRoom) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(rooms).values(data);
  return { insertId: (result as any)[0]?.insertId || 0 };
}

export async function getRoomByCode(roomCode: string) {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(rooms).where(eq(rooms.roomCode, roomCode)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getRoomById(roomId: number) {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(rooms).where(eq(rooms.id, roomId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateRoomStatus(roomId: number, status: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return db.update(rooms).set({ status: status as any, updatedAt: new Date() }).where(eq(rooms.id, roomId));
}

/**
 * Player queries
 */
export async function createPlayer(data: InsertPlayer) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(players).values(data);
  return { insertId: (result as any)[0]?.insertId || 0 };
}

export async function getPlayersByRoomId(roomId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return db.select().from(players).where(eq(players.roomId, roomId));
}

export async function getPlayerById(playerId: number) {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(players).where(eq(players.id, playerId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updatePlayerScore(playerId: number, score: number, exp: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return db.update(players).set({ score, exp }).where(eq(players.id, playerId));
}

/**
 * Game Round queries
 */
export async function createGameRound(data: InsertGameRound) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(gameRounds).values(data);
  return { insertId: (result as any)[0]?.insertId || 0 };
}

export async function getCurrentRound(roomId: number) {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(gameRounds)
    .where(and(eq(gameRounds.roomId, roomId), eq(gameRounds.status, "playing")))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateRoundStatus(roundId: number, status: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return db.update(gameRounds).set({ status: status as any }).where(eq(gameRounds.id, roundId));
}

/**
 * Game Response queries
 */
export async function createGameResponse(data: InsertGameResponse) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(gameResponses).values(data);
  return { insertId: (result as any)[0]?.insertId || 0 };
}

export async function getResponsesByRoundId(roundId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return db.select().from(gameResponses).where(eq(gameResponses.roundId, roundId));
}

export async function updateResponseVotes(responseId: number, voteCount: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return db.update(gameResponses).set({ voteCount }).where(eq(gameResponses.id, responseId));
}

/**
 * Vote queries
 */
export async function createVote(data: InsertVote) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(votes).values(data);
  return { insertId: (result as any)[0]?.insertId || 0 };
}

export async function getVotesByRoundId(roundId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return db.select().from(votes).where(eq(votes.roundId, roundId));
}

/**
 * Chat Message queries
 */
export async function createChatMessage(data: InsertChatMessage) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(chatMessages).values(data);
  return { insertId: (result as any)[0]?.insertId || 0 };
}

export async function getChatMessagesByRoomId(roomId: number, limit: number = 50) {
  const db = await getDb();
  if (!db) return [];
  
  return db.select().from(chatMessages)
    .where(eq(chatMessages.roomId, roomId))
    .orderBy(desc(chatMessages.createdAt))
    .limit(limit);
}

/**
 * Emoji Reaction queries
 */
export async function createEmojiReaction(data: InsertEmojiReaction) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(emojiReactions).values(data);
  return { insertId: (result as any)[0]?.insertId || 0 };
}

export async function getEmojiReactionsByRoomId(roomId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return db.select().from(emojiReactions).where(eq(emojiReactions.roomId, roomId));
}

/**
 * Game Question queries
 */
export async function getRandomQuestion(gameMode: string) {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(gameQuestions)
    .where(eq(gameQuestions.gameMode, gameMode as any))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}
