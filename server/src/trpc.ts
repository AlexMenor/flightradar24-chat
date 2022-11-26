import { initTRPC, TRPCError } from "@trpc/server";
import type { inferAsyncReturnType } from "@trpc/server";
import { CreateFastifyContextOptions } from "@trpc/server/adapters/fastify";

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

const logger = t.middleware(async ({ path, type, next, input, ctx }) => {
  const start = Date.now();
  const result = await next();
  const durationMs = Date.now() - start;
  const logInfo = {
    path,
    type,
    durationMs,
    input,
    sessionId: ctx.sessionId,
  };
  result.ok
    ? console.log(`OK request timing:`, logInfo)
    : console.warn("Non-OK request timing", logInfo);
  return result;
});
const loggedProcedure = t.procedure.use(logger);

export const publicProcedure = loggedProcedure;

const isAuthenticated = t.middleware(async ({ ctx, next }) => {
  if (!ctx.sessionId) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({ ctx: { sessionId: ctx.sessionId } });
});

export const authenticatedProcedure = loggedProcedure.use(isAuthenticated);
