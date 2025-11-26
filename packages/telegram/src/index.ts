import dotenv from "dotenv";
import { createBot } from "./bot";

import path from "path";

// Load from root .env
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

const token = process.env.TELEGRAM_BOT_TOKEN;

if (!token) {
  throw new Error("TELEGRAM_BOT_TOKEN must be provided!");
}

const bot = createBot(token);

bot.launch(() => {
  console.log("Bot is running!");
});

// Enable graceful stop
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
