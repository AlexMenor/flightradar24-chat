import fastify from "fastify";
import { fastifyTRPCPlugin } from "@trpc/server/adapters/fastify";
import { appRouter, createContext } from "./router";
import cookie from "@fastify/cookie";
import ws from "@fastify/websocket";

const server = fastify({ maxParamLength: 500 });

server.register(cookie, {
  secret: "my-secret",
});

server.register(ws);

server.register(fastifyTRPCPlugin, {
  prefix: "/trpc",
  useWSS: true,
  trpcOptions: {
    router: appRouter,
    createContext: createContext,
    onError: ({ error }: { error: any }) => {
      console.error("Unhandled error", error);
    },
  },
});

server.listen({ port: 8080 }, (err, address) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  console.log(`Server listening at ${address}`);
});
