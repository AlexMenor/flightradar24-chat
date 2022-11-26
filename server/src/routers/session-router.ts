import { db } from "../db";
import { generateName } from "../name-generator";
import { publicProcedure, t } from "../trpc";

export const sessionRouter = t.router({
  createSession: publicProcedure.mutation(async ({ ctx }) => {
    const name = generateName();

    const session = await db.session.create({ data: { name } });

    ctx.res.setCookie("session", session.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      signed: true,
    });

    return session;
  }),
});
