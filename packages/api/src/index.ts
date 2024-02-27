import fs from "fs";
import path from "path";
import http from "http";
import https from "https";
import dotenv from "dotenv";

dotenv.config();

import { server } from "./server";

const IS_GOOGLE_CLOUD_RUN = process.env.K_SERVICE !== undefined;
const host = IS_GOOGLE_CLOUD_RUN ? "0.0.0.0" : undefined;
const port = Number(process.env.PORT) || 3000;

if (process.env.NODE_ENV !== "production") {
  const httpsServer = https.createServer(
    {
      key: fs.readFileSync(path.join(__dirname, "../cert/fastify.key")),
      cert: fs.readFileSync(path.join(__dirname, "../cert/fastify.cert")),
    },
    server,
  );

  httpsServer.listen({ port, host });
  console.log(`🚀  Web3 API server running at https://localhost:${port}/status`);
} else {
  const httpServer = http.createServer(server);

  httpServer.listen({ port, host });
  console.log(`🚀  Web3 API server running at http://localhost:${port}/status`);
}
