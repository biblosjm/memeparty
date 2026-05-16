import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { nanoid } from "nanoid";
import * as db from "./db";
import { generateImage } from "./_core/imageGeneration";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  /**
   * Game Room Router
   */
  game: router({
    /**
     * 방 생성
     */
    createRoom: publicProcedure
      .input(z.object({
        nickname: z.string().min(1).max(64),
        gameMode: z.enum(["meme_title", "internet_culture", "friend_predict"]),
      }))
      .mutation(async ({ input }) => {
        const roomCode = nanoid(8);
        
        const roomResult = await db.createRoom({
          roomCode,
          gameMode: input.gameMode,
          status: "waiting",
          maxPlayers: 8,
          currentRound: 0,
          totalRounds: 3,
        });

        // 플레이어 생성
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

    /**
     * 방 참여
     */
    joinRoom: publicProcedure
      .input(z.object({
        roomCode: z.string(),
        nickname: z.string().min(1).max(64),
        role: z.enum(["player", "spectator"]).default("player"),
      }))
      .mutation(async ({ input }) => {
        const room = await db.getRoomByCode(input.roomCode);
        if (!room) {
          throw new Error("Room not found");
        }

        const playerResult = await db.createPlayer({
          roomId: room.id,
          nickname: input.nickname,
          role: input.role,
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

    /**
     * 방 정보 조회
     */
    getRoom: publicProcedure
      .input(z.object({
        roomCode: z.string(),
      }))
      .query(async ({ input }) => {
        const room = await db.getRoomByCode(input.roomCode);
        if (!room) {
          throw new Error("Room not found");
        }

        const players = await db.getPlayersByRoomId(room.id);
        
        return {
          room,
          players,
        };
      }),

    /**
     * 게임 시작
     */
    startGame: publicProcedure
      .input(z.object({
        roomId: z.number(),
      }))
      .mutation(async ({ input }) => {
        await db.updateRoomStatus(input.roomId, "playing");
        
        // 첫 번째 라운드 생성
        const roundResult = await db.createGameRound({
          roomId: input.roomId,
          roundNumber: 1,
          status: "waiting",
          gameMode: "meme_title",
        });

        return {
          roundId: roundResult.insertId,
          roundNumber: 1,
        };
      }),

    /**
     * AI 이미지 생성 (밈 제목 짓기 모드)
     */
    generateMemeImage: publicProcedure
      .input(z.object({
        roundId: z.number(),
      }))
      .mutation(async ({ input }) => {
        const prompt = "Create a funny, absurd meme image with a humorous situation that would be perfect for captioning. Make it visually interesting and memorable.";
        
        const { url: imageUrl } = await generateImage({
          prompt,
        });

        return {
          imageUrl,
        };
      }),

    /**
     * 응답 제출
     */
    submitResponse: publicProcedure
      .input(z.object({
        roundId: z.number(),
        playerId: z.number(),
        content: z.string().min(1).max(500),
      }))
      .mutation(async ({ input }) => {
        const responseResult = await db.createGameResponse({
          roundId: input.roundId,
          playerId: input.playerId,
          content: input.content,
          voteCount: 0,
          isCorrect: false,
        });

        return {
          responseId: responseResult.insertId,
        };
      }),

    /**
     * 투표
     */
    submitVote: publicProcedure
      .input(z.object({
        roundId: z.number(),
        voterId: z.number(),
        responseId: z.number(),
      }))
      .mutation(async ({ input }) => {
        const voteResult = await db.createVote({
          roundId: input.roundId,
          voterId: input.voterId,
          responseId: input.responseId,
        });

        // 응답의 투표 수 증가
        const responses = await db.getResponsesByRoundId(input.roundId);
        const response = responses.find(r => r.id === input.responseId);
        if (response) {
          await db.updateResponseVotes(input.responseId, response.voteCount + 1);
        }

        return {
          voteId: voteResult.insertId,
        };
      }),

    /**
     * 라운드 응답 조회
     */
    getRoundResponses: publicProcedure
      .input(z.object({
        roundId: z.number(),
      }))
      .query(async ({ input }) => {
        return db.getResponsesByRoundId(input.roundId);
      }),

    /**
     * 채팅 메시지 전송
     */
    sendChatMessage: publicProcedure
      .input(z.object({
        roomId: z.number(),
        playerId: z.number(),
        message: z.string().min(1).max(500),
      }))
      .mutation(async ({ input }) => {
        const messageResult = await db.createChatMessage({
          roomId: input.roomId,
          playerId: input.playerId,
          message: input.message,
        });

        return {
          messageId: messageResult.insertId,
        };
      }),

    /**
     * 채팅 메시지 조회
     */
    getChatMessages: publicProcedure
      .input(z.object({
        roomId: z.number(),
        limit: z.number().default(50),
      }))
      .query(async ({ input }) => {
        return db.getChatMessagesByRoomId(input.roomId, input.limit);
      }),

    /**
     * 이모지 반응 전송
     */
    sendEmojiReaction: publicProcedure
      .input(z.object({
        roomId: z.number(),
        playerId: z.number(),
        emoji: z.string(),
      }))
      .mutation(async ({ input }) => {
        const reactionResult = await db.createEmojiReaction({
          roomId: input.roomId,
          playerId: input.playerId,
          emoji: input.emoji,
        });

        return {
          reactionId: reactionResult.insertId,
        };
      }),
  }),
});

export type AppRouter = typeof appRouter;
