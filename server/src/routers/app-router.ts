import { chatRouter } from "./chat-router";
import { sessionRouter } from "./session-router";
import { t } from "../trpc";

export const appRouter = t.mergeRouters(chatRouter, sessionRouter);

export type AppRouter = typeof appRouter;
