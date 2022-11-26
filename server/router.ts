import { Message, Session } from "@prisma/client";
import { initTRPC, TRPCError } from "@trpc/server";
import { inferAsyncReturnType } from "@trpc/server";
import { CreateFastifyContextOptions } from "@trpc/server/adapters/fastify";
import { observable } from "@trpc/server/observable";
import { EventEmitter } from "stream";
import { z } from "zod";
import { db } from "./db";

type MessageWithSession = Message & { sender: Session };

export function createContext({ req, res }: CreateFastifyContextOptions) {
  const sessionCookie = req.cookies?.session;
  let sessionId;

  if (!sessionCookie) {
    sessionId = null;
  } else {
    const unsignResult = req.unsignCookie(sessionCookie);
    if (!unsignResult.valid) {
      sessionId = null;
    } else {
      sessionId = unsignResult.value;
    }
  }

  return { res, sessionId };
}

type Context = inferAsyncReturnType<typeof createContext>;

export const t = initTRPC.context<Context>().create();

const logger = t.middleware(async ({ path, type, next }) => {
  const start = Date.now();
  const result = await next();
  const durationMs = Date.now() - start;
  result.ok
    ? console.log(`OK request timing:`, { path, type, durationMs })
    : console.log("Non-OK request timing", { path, type, durationMs });
  return result;
});
const loggedProcedure = t.procedure.use(logger);

const publicProcedure = loggedProcedure;

const isAuthenticated = t.middleware(async ({ ctx, next }) => {
  if (!ctx.sessionId) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({ ctx: { sessionId: ctx.sessionId } });
});

const authenticatedProcedure = loggedProcedure.use(isAuthenticated);

declare interface MyEventEmitter {
  on(event: string, listener: (message: MessageWithSession) => void): this;
  off(event: string, listener: (message: MessageWithSession) => void): this;
  emit(event: string, message: MessageWithSession): boolean;
}
class MyEventEmitter extends EventEmitter {}

const emitter = new MyEventEmitter();

export const appRouter = t.router({
  createSession: publicProcedure.mutation(async ({ ctx }) => {
    const name = "beautiful-tupolev" + Date.now().valueOf();

    const session = await db.session.create({ data: { name } });

    ctx.res.setCookie("session", session.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      signed: true,
    });

    return session;
  }),
  getChat: authenticatedProcedure
    .input(
      z.object({
        cursor: z.string().optional(),
        take: z.number(),
        chatId: z.string(),
      })
    )
    .query(async ({ input }) => {
      const { take, cursor } = input;

      const messages = await db.message.findMany({
        cursor: cursor !== undefined ? { id: cursor } : undefined,
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        take: -take - 1,
        include: { sender: true },
      });

      const first = messages.length === take + 1 ? messages.shift() : undefined;

      return { messages, nextCursor: first?.id };
    }),
  postMessage: authenticatedProcedure
    .input(
      z.object({
        content: z.string().min(1),
        chatId: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { sessionId } = ctx;
      const { chatId, content } = input;

      const createdMessage = await db.message.create({
        data: { senderId: sessionId, content, chatId },
        include: { sender: true },
      });

      emitter.emit(chatId, createdMessage);

      return createdMessage;
    }),
  onNewMessage: publicProcedure
    .input(z.object({ chatId: z.string() }))
    .subscription(({ input }) => {
      return observable<MessageWithSession>((emit) => {
        const emitNext = (message: MessageWithSession) => {
          emit.next(message);
        };
        emitter.on(input.chatId, emitNext);
        return () => {
          emitter.off(input.chatId, emitNext);
        };
      });
    }),
});

export type AppRouter = typeof appRouter;
