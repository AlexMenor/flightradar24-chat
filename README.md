# Flightradar24 chat

Every day, thousands of aviation enthusiasts follow flights in [flightradar24](https://flightradar24.com). A feature I miss on the website, though, is __a chat where you can talk with other people following a specific flight.__

This project attempts to fill this gap with a chrome extension.

<p align="center">
  <img width="709" height="451" src="demo.gif">
</p>

## How it works

This monorepo contains two main folders:
- __Client__: All the code needed to build the chrome extension. I used [this boilerplate](https://github.com/Jonghakseo/chrome-extension-boilerplate-react-vite) to bootstrap it. Built with React, Vite, Tailwind & TRPC.
- __Server__: Backend that exposes TRPC endpoints. Uses Fastify, PostgreSQL, Prisma & TRPC.

## More details

A session is created when the user opens the popup for the first time whose id is saved as a signed cookie. The session's name is a random concatenation of an adjective with an aircraft's name. 

The `flightId` is extracted from the browser's URL and is used as a `chatId` for the next received and sent messages.

Messages are fetch with a TRPC endpoint used as an infinite query for retrieving older messages. New messages are received through a TRPC subscription.

The server uses a `ChatPubSubPort` to make the subscriptions work. At the moment, this port uses a memory adapter at runtime, but it's ready to use a Redis adapter, for example, to make horizontal scaling possible.

## How to run it locally

1. Clone the repo
2. Run `yarn` to install client and server dependencies.
3. `cd client && cp .env.template .env`
4. Run `yarn dev` in the client folder.
5. Open a new terminal and `cd server && cp .env.template .env`
6. Run a PostgreSQL instance, get the URL and paste it in `.env`
7. Run `yarn prisma db push` to create the tables in the DB.
8. Run `yarn dev` in the server folder.
9. Go to "manage extensions" in chrome and use the "load unpacked" button to open the `client/dist` folder

Done! You can open the popup now.

