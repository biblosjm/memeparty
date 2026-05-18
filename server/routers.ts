import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { nanoid } from "nanoid";
import * as db from "./db";

/**
 * MVP tRPC — room create / join / lookup only.
 * Real-time game flow is handled via Socket.IO (see server/game/roomManager.ts).
 */
export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  game: router({
    createRoom: publicProcedure
      .input(z.object({ nickname: z.string().min(1).max(64) }))
      .mutation(async ({ input }) => {
        const roomCode = nanoid(8);

        const roomResult = await db.createRoom({
          roomCode,
          gameMode: "meme_title",
          status: "waiting",
          maxPlayers: 8,
          currentRound: 0,
          totalRounds: 3,
        });

        const playerResult = await db.createPlayer({
          roomId: roomResult.insertId,
          nickname: input.nickname,
          role: "player",
          score: 0,
          level: 1,
          exp: 0,
          winStreak: 0,
          isMvp: false,
        });

        return {
          roomId: roomResult.insertId,
          roomCode,
          playerId: playerResult.insertId,
        };
      }),

    joinRoom: publicProcedure
      .input(
        z.object({
          roomCode: z.string(),
          nickname: z.string().min(1).max(64),
        }),
      )
      .mutation(async ({ input }) => {
        const room = await db.getRoomByCode(input.roomCode);
        if (!room) throw new Error("Room not found");

        const playerResult = await db.createPlayer({
          roomId: room.id,
          nickname: input.nickname,
          role: "player",
          score: 0,
          level: 1,
          exp: 0,
          winStreak: 0,
          isMvp: false,
        });

        return {
          roomId: room.id,
          playerId: playerResult.insertId,
          room,
        };
      }),

    getRoom: publicProcedure
      .input(z.object({ roomCode: z.string() }))
      .query(async ({ input }) => {
        const room = await db.getRoomByCode(input.roomCode);
        if (!room) throw new Error("Room not found");

        const players = await db.getPlayersByRoomId(room.id);
        return { room, players };
      }),

    generateQuestion: publicProcedure
      .input(
        z.object({
          gameMode: z.string(),
          roundNumber: z.number(),
        }),
      )
      .mutation(async ({ input }) => {
        const questions = [
          {
            id: 1,
            content: "다음 중 가장 밈스러운 것은?",
            options: ["고양이", "개", "새", "물고기"],
            correctAnswer: 0,
          },
        ];
        return { question: questions[0] };
      }),
  }),
});

export type AppRouter = typeof appRouter;
