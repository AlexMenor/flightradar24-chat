import { Message, Session } from "@prisma/client";
import { observable } from "@trpc/server/observable";
import { z } from "zod";
import { ChatPubSubMemoryAdapter } from "../chat-pub-sub-memory-adapter";
import { db } from "../db";
import { authenticatedProcedure, publicProcedure, t } from "../trpc";

export type MessageWithSession = Message & { sender: Session };

export interface ChatPubSubPort {
  publishMessage(chatId: string, message: MessageWithSession): Promise<void>;
  subscribeToChat(
    chatId: string,
    listener: (newMessage: MessageWithSession) => void
  ): Promise<void>;
  unsubscribeToChat(
    chatId: string,
    listener: (newMessage: MessageWithSession) => void
  ): Promise<void>;
}

const chatPubSub = new ChatPubSubMemoryAdapter();

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

      await chatPubSub.publishMessage(chatId, createdMessage);

      return createdMessage;
    }),
  onNewMessage: publicProcedure
    .input(z.object({ chatId: z.string() }))
    .subscription(({ input }) => {
      return observable<MessageWithSession>((emit) => {
        const emitNext = (message: MessageWithSession) => {
          emit.next(message);
        };
        chatPubSub.subscribeToChat(input.chatId, emitNext);
        return () => chatPubSub.unsubscribeToChat(input.chatId, emitNext);
      });
    }),
});
