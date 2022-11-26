import "dotenv/config";

import fastify from "fastify";
import { fastifyTRPCPlugin } from "@trpc/server/adapters/fastify";
import { appRouter, createContext } from "./router";
import cookie from "@fastify/cookie";
import ws from "@fastify/websocket";
import { TRPCError } from "@trpc/server";

const server = fastify({ maxParamLength: 500 });

server.register(cookie, {
  secret: process.env.COOKIE_SECRET,
});

server.register(ws);

server.register(fastifyTRPCPlugin, {
  prefix: "/trpc",
  useWSS: true,
  trpcOptions: {
    router: appRouter,
    createContext: createContext,
    onError: ({ error }: { error: TRPCError }) => {
      if (error.code === "INTERNAL_SERVER_ERROR") {
        console.error("Unhandled error", error);
      } else {
        console.log("onError", error);
      }
    },
  },
});

server.listen({ port: parseInt(process.env.PORT) }, (err, address) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  console.log(`✈️  Server listening at ${address} ✈️`);
});
