import { Message, Session } from "@prisma/client";
import { observable } from "@trpc/server/observable";
import EventEmitter from "events";
import { z } from "zod";
import { db } from "../db";
import { authenticatedProcedure, publicProcedure, t } from "../trpc";

type MessageWithSession = Message & { sender: Session };

declare interface MyEventEmitter {
  on(event: string, listener: (message: MessageWithSession) => void): this;
  off(event: string, listener: (message: MessageWithSession) => void): this;
  emit(event: string, message: MessageWithSession): boolean;
}
class MyEventEmitter extends EventEmitter {}

const emitter = new MyEventEmitter();

export const chatRouter = t.router({
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
