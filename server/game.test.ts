import { describe, it, expect, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock context for testing
function createMockContext(): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("game.createRoom", () => {
  it("should create a room with a valid roomCode", async () => {
    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.game.createRoom({
      nickname: "TestPlayer",
      gameMode: "meme_title",
    });

    expect(result).toHaveProperty("roomId");
    expect(result).toHaveProperty("roomCode");
    expect(result).toHaveProperty("playerId");
    expect(result.roomCode).toMatch(/^[A-Za-z0-9]{8}$/);
  });

  it("should reject invalid nickname", async () => {
    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);

    try {
      await caller.game.createRoom({
        nickname: "",
        gameMode: "meme_title",
      });
      expect.fail("Should have thrown an error");
    } catch (error) {
      expect(error).toBeDefined();
    }
  });

  it("should support all game modes", async () => {
    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);

    const modes = ["meme_title", "internet_culture", "friend_predict"] as const;

    for (const mode of modes) {
      const result = await caller.game.createRoom({
        nickname: `Player_${mode}`,
        gameMode: mode,
      });

      expect(result.roomId).toBeGreaterThan(0);
      expect(result.roomCode).toBeDefined();
    }
  });
});

describe("game.joinRoom", () => {
  let roomCode: string;
  let roomId: number;

  beforeEach(async () => {
    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);

    const createResult = await caller.game.createRoom({
      nickname: "Creator",
      gameMode: "meme_title",
    });

    roomCode = createResult.roomCode;
    roomId = createResult.roomId;
  });

  it("should allow a player to join an existing room", async () => {
    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.game.joinRoom({
      roomCode,
      nickname: "JoinedPlayer",
      role: "player",
    });

    expect(result).toHaveProperty("roomId");
    expect(result).toHaveProperty("playerId");
    expect(result.roomId).toBe(roomId);
  });

  it("should reject joining a non-existent room", async () => {
    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);

    try {
      await caller.game.joinRoom({
        roomCode: "INVALID123",
        nickname: "Player",
        role: "player",
      });
      expect.fail("Should have thrown an error");
    } catch (error) {
      expect(error).toBeDefined();
    }
  });

  it("should support spectator role", async () => {
    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.game.joinRoom({
      roomCode,
      nickname: "Spectator",
      role: "spectator",
    });

    expect(result.playerId).toBeGreaterThan(0);
  });
});

describe("game.getRoom", () => {
  let roomCode: string;

  beforeEach(async () => {
    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);

    const createResult = await caller.game.createRoom({
      nickname: "Creator",
      gameMode: "meme_title",
    });

    roomCode = createResult.roomCode;
  });

  it("should retrieve room information", async () => {
    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.game.getRoom({
      roomCode,
    });

    expect(result).toHaveProperty("room");
    expect(result).toHaveProperty("players");
    expect(result.room.roomCode).toBe(roomCode);
    expect(Array.isArray(result.players)).toBe(true);
  });

  it("should include players in the room", async () => {
    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);

    // Add another player
    await caller.game.joinRoom({
      roomCode,
      nickname: "Player2",
      role: "player",
    });

    const result = await caller.game.getRoom({
      roomCode,
    });

    expect(result.players.length).toBeGreaterThanOrEqual(2);
  });
});

describe("game.submitResponse", () => {
  let roomId: number;
  let playerId: number;
  let roundId: number;

  beforeEach(async () => {
    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);

    // Create room
    const createResult = await caller.game.createRoom({
      nickname: "Player",
      gameMode: "meme_title",
    });

    roomId = createResult.roomId;
    playerId = createResult.playerId;

    // Start game (creates first round)
    const gameResult = await caller.game.startGame({
      roomId,
    });

    roundId = gameResult.roundId;
  });

  it("should submit a response for a round", async () => {
    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.game.submitResponse({
      roundId,
      playerId,
      content: "This is a funny caption!",
    });

    expect(result).toHaveProperty("responseId");
    expect(result.responseId).toBeGreaterThan(0);
  });

  it("should reject empty response", async () => {
    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);

    try {
      await caller.game.submitResponse({
        roundId,
        playerId,
        content: "",
      });
      expect.fail("Should have thrown an error");
    } catch (error) {
      expect(error).toBeDefined();
    }
  });
});

describe("game.submitVote", () => {
  let roundId: number;
  let playerId: number;
  let responseId: number;

  beforeEach(async () => {
    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);

    // Create room and start game
    const createResult = await caller.game.createRoom({
      nickname: "Player1",
      gameMode: "meme_title",
    });

    const gameResult = await caller.game.startGame({
      roomId: createResult.roomId,
    });

    roundId = gameResult.roundId;
    playerId = createResult.playerId;

    // Submit a response
    const responseResult = await caller.game.submitResponse({
      roundId,
      playerId,
      content: "Funny caption",
    });

    responseId = responseResult.responseId;
  });

  it("should submit a vote for a response", async () => {
    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);

    // Add another player to vote
    const createResult = await caller.game.createRoom({
      nickname: "Player2",
      gameMode: "meme_title",
    });

    const result = await caller.game.submitVote({
      roundId,
      voterId: createResult.playerId,
      responseId,
    });

    expect(result).toHaveProperty("voteId");
    expect(result.voteId).toBeGreaterThan(0);
  });
});

describe("game.getChatMessages", () => {
  let roomId: number;
  let playerId: number;

  beforeEach(async () => {
    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);

    const createResult = await caller.game.createRoom({
      nickname: "Player",
      gameMode: "meme_title",
    });

    roomId = createResult.roomId;
    playerId = createResult.playerId;
  });

  it("should retrieve chat messages", async () => {
    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);

    // Send a message
    await caller.game.sendChatMessage({
      roomId,
      playerId,
      message: "Hello everyone!",
    });

    const result = await caller.game.getChatMessages({
      roomId,
    });

    expect(Array.isArray(result)).toBe(true);
  });
});
