#!/usr/bin/env bun
/**
 * Local Telegram-intake smoke test.
 *
 * Validates the capture pipeline END-TO-END on your machine, using your REAL
 * env (`TELEGRAM_BUGS_TOPIC` / `TELEGRAM_IDEAS_TOPIC`), with no Telegram and no
 * production contact:
 *
 *   1. the topic env vars parse into a valid allowlist (config check)
 *   2. a message posted in each configured topic is captured + persisted
 *      through the real `createGroupCaptureHandler`
 *   3. the persisted row is returned by `getNewChatMessages` — the exact query
 *      behind `GET /api/messages?inferred_type=<t>&status=new` that the
 *      `bug-intake` routine calls
 *
 * Run:  bun run --filter @green-goods/agent intake:smoke
 *   or: (from packages/agent) bun run intake:smoke
 *
 * What it proves: if this PASSES, the capture code and your topic IDs are
 * correct. Anything still failing in production is then isolated to the
 * Telegram -> bot delivery hop (privacy mode, webhook, or messages posted
 * outside the configured topics) — not the code and not the topic config.
 *
 * It replays a SYNTHETIC message, so it does not exercise the real
 * Telegram delivery path (see the live-polling option in the agent README).
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { loadCaptureTopicsFromEnv, parseTopicEnvVar } from "../src/config";
import { createGroupCaptureHandler } from "../src/handlers/group-capture";
import { closeDB, getNewChatMessages, initDB } from "../src/services/db";
import type { InboundMessage, TopicAllowlistEntry } from "../src/types";

const DB_PATH = path.join(os.tmpdir(), `gg-intake-smoke-${process.pid}-${Date.now()}.db`);

function cleanup(): void {
  for (const file of [DB_PATH, `${DB_PATH}-wal`, `${DB_PATH}-shm`]) {
    if (fs.existsSync(file)) fs.unlinkSync(file);
  }
}

async function main(): Promise<void> {
  // 1. Config check — does the topic config parse into a usable allowlist?
  //
  // Source priority: CLI args override env, so you can paste the real Fly
  // secret values without editing .env:
  //   bun run intake:smoke -- <BUGS_TOPIC> <IDEAS_TOPIC>
  //   e.g. bun run intake:smoke -- -1002847752257_311 -1002847752257_312
  // With no args, it reads TELEGRAM_BUGS_TOPIC / TELEGRAM_IDEAS_TOPIC from the
  // loaded env (root .env in local dev).
  const [bugsArg, ideasArg] = process.argv.slice(2);
  let allowlist: TopicAllowlistEntry[];
  if (bugsArg || ideasArg) {
    allowlist = [
      parseTopicEnvVar("TELEGRAM_BUGS_TOPIC (arg)", bugsArg, "bug"),
      parseTopicEnvVar("TELEGRAM_IDEAS_TOPIC (arg)", ideasArg, "idea"),
    ].filter((entry): entry is TopicAllowlistEntry => entry !== undefined);
    console.log("\n=== Parsed topic allowlist (from CLI args) ===");
  } else {
    allowlist = loadCaptureTopicsFromEnv();
    console.log(
      "\n=== Parsed topic allowlist (from env: TELEGRAM_BUGS_TOPIC / TELEGRAM_IDEAS_TOPIC) ==="
    );
  }

  if (allowlist.length === 0) {
    console.error(
      "❌ EMPTY allowlist. No valid topic found in args or env.\n" +
        "   Each topic must be <chat_id>_<thread_id>, e.g. -1002847752257_311\n" +
        "   Local .env not carrying these is normal IF they're set as Fly secrets\n" +
        "   on the agent — pull them and pass as args:\n" +
        "     flyctl ssh console --app green-goods -C 'printenv TELEGRAM_BUGS_TOPIC'\n" +
        "     bun run --filter @green-goods/agent intake:smoke -- <BUGS> <IDEAS>\n" +
        "   If they're ALSO empty on Fly, that's the bug — the agent can't capture."
    );
    process.exit(1);
  }
  for (const entry of allowlist) {
    console.log(`  ${entry.inferredType.padEnd(5)} -> chatId=${entry.chatId}  threadId=${entry.threadId}`);
  }

  // 2 + 3. Run a synthetic message per topic through the real handler, then
  // query it back exactly as the routine does.
  cleanup();
  initDB(DB_PATH);
  const handler = createGroupCaptureHandler(allowlist);
  let allPass = true;

  console.log("\n=== Capture + query check ===");
  for (const topic of allowlist) {
    const messageId = `smoke-${topic.inferredType}-${Date.now()}`;
    const message: InboundMessage = {
      id: messageId,
      platform: "telegram",
      chat: { id: topic.chatId, type: "supergroup", threadId: topic.threadId },
      sender: { platformId: "smoke-user", displayName: "Smoke Test" },
      content: { type: "text", text: `LOCAL SMOKE TEST (${topic.inferredType})` },
      timestamp: Date.now(),
    };

    await handler(message);

    const rows = await getNewChatMessages({
      chatId: topic.chatId,
      threadId: topic.threadId,
      inferredType: topic.inferredType,
      status: "new",
    });
    const found = rows.find((row) => row.messageId === messageId);

    if (found) {
      console.log(
        `✅ ${topic.inferredType}: captured + returned by the routine's query ` +
          `(inferredType=${found.inferredType}, status=${found.status})`
      );
    } else {
      allPass = false;
      console.error(
        `❌ ${topic.inferredType}: NOT captured/returned for ` +
          `chatId=${topic.chatId} threadId=${topic.threadId}`
      );
    }
  }

  await closeDB();
  cleanup();

  if (allPass) {
    console.log(
      "\n✅ PASS — capture pipeline + your topic config work end-to-end locally.\n" +
        "   If real messages still aren't captured in prod, the gap is the\n" +
        "   Telegram -> bot delivery hop (privacy mode / webhook / posting outside\n" +
        "   the configured topics), not the code or the topic IDs."
    );
  } else {
    console.error("\n❌ FAIL — see above.");
  }
  process.exit(allPass ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  cleanup();
  process.exit(1);
});
