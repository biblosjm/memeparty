import { describe, it, expect } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function createMockContext(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("MVP game API", () => {
  it("creates a room with roomCode and playerId", async () => {
    const caller = appRouter.createCaller(createMockContext());
    const result = await caller.game.createRoom({ nickname: "TestPlayer" });

    expect(result.roomId).toBeGreaterThan(0);
    expect(result.playerId).toBeGreaterThan(0);
    expect(result.roomCode).toMatch(/^[A-Za-z0-9]{8}$/);
  });

  it("rejects empty nickname", async () => {
    const caller = appRouter.createCaller(createMockContext());
    await expect(caller.game.createRoom({ nickname: "" })).rejects.toThrow();
  });

  it("joins an existing room", async () => {
    const caller = appRouter.createCaller(createMockContext());
    const created = await caller.game.createRoom({ nickname: "Host" });

    const joined = await caller.game.joinRoom({
      roomCode: created.roomCode,
      nickname: "Guest",
    });

    expect(joined.roomId).toBe(created.roomId);
    expect(joined.playerId).not.toBe(created.playerId);
  });

  it("gets room by code", async () => {
    const caller = appRouter.createCaller(createMockContext());
    const created = await caller.game.createRoom({ nickname: "Host" });

    const room = await caller.game.getRoom({ roomCode: created.roomCode });
    expect(room.room.roomCode).toBe(created.roomCode);
    expect(room.players.length).toBeGreaterThanOrEqual(1);
  });
});
