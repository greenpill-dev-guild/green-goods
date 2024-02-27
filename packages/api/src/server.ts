import cors from "cors";
import helmet from "helmet";
import express from "express";
import { SiweMessage } from "siwe";
// import { createClient } from "redis";
import session from "express-session";
// import RedisStore from "connect-redis";

import { identityRouter } from "./routes/identity";

declare module "express-session" {
  export interface Session {
    nonce: string | null;
    siwe: SiweMessage | null;
    chainId?: 420 | 85431 | 999 | 919;
  }
}

const server = express();

// Redis
// const redisClient = createClient();
// redisClient.connect().catch(console.error);
// redisClient.on("error", function (err) {
//   console.log("Could not establish a connection with redis. " + err);
// });
// redisClient.on("connect", function (err) {
//   console.log("Connected to redis successfully");
// });

// const redisStore = new RedisStore({
//   client: redisClient,
//   prefix: "web3:",
// });

// Middleware
server.use(require("express").json());
server.use(cors({})); // Adjust the "origin" option as needed
server.use(helmet({}));
server.use(
  session({
    name: "web3_cookie",
    secret: `${process.env.SESSION_SECRET ?? "issa a secret with minimum length of 32 characters"}}`,
    resave: false,
    saveUninitialized: true,
    // store: redisStore,
    // cookie: {
    //   secure: true,
    //   sameSite: true,
    // },
  }),
);

// Router
server.use("/identity", identityRouter);

server.get("/status", async function (_req, reply) {
  reply.send({ status: "ok" });
});

export { server };
