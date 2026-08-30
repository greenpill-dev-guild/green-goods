#!/usr/bin/env node
/**
 * Local QA app — the deployed app's behaviour, without Vercel or Blob.
 *
 * Serves dist/ and implements the same /api/state contract against per-tester
 * JSON files under tmp/qa-app/, so the sharded-by-writer model can be exercised
 * (two browsers, same case, no clobbering) before anything is deployed. It is
 * also the offline fallback: if the deploy is unavailable mid-session, this
 * runs the same page against the same shape of state.
 *
 *   node packages/qa-app/dev.mjs [--port 4610]
 *
 * Port 4610 sits in the free band above the dev stack's 3001-3009 block, so it
 * never contends with a running client/admin/docs surface.
 */

import { createServer } from "node:http";
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const packageDir = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(packageDir, "dist");
const stateDir = path.join(packageDir, "..", "..", "tmp", "qa-app");

export const TEAM = ["Afo", "Nansel", "Gui"];
const STATUSES = new Set(["pass", "fail", "blocked", "na", ""]);
const MAX_NOTE_LENGTH = 4000;
const CONTENT_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
};

function shardPath(person) {
  return path.join(stateDir, `${person}.json`);
}

/**
 * Same delta semantics the deployed function applies, so a local run cannot
 * prove something the deployment would not do. An entry with no status and no
 * note is a tombstone (the tester cleared that case).
 */
export function sanitizeDelta(raw) {
  const delta = {};
  if (!raw || typeof raw !== "object") return delta;
  for (const [caseId, value] of Object.entries(raw)) {
    if (typeof caseId !== "string" || caseId.length > 64) continue;
    if (!value || typeof value !== "object") continue;
    delta[caseId] = {
      s: typeof value.s === "string" && STATUSES.has(value.s) ? value.s : "",
      n: typeof value.n === "string" ? value.n.slice(0, MAX_NOTE_LENGTH) : "",
      at: typeof value.at === "string" ? value.at : new Date().toISOString(),
    };
  }
  return delta;
}

/** Newest write wins per case; a tombstone removes the entry. */
export function mergeDelta(existing, delta) {
  const merged = { ...existing };
  for (const [caseId, incoming] of Object.entries(delta)) {
    const current = merged[caseId];
    if (current && current.at && incoming.at && incoming.at < current.at) continue;
    if (!incoming.s && !incoming.n.trim()) delete merged[caseId];
    else merged[caseId] = incoming;
  }
  return merged;
}

/** caseId -> person -> entry, merged across every tester's shard. */
export function mergeShards(shards) {
  const entries = {};
  for (const shard of shards) {
    if (!shard || !shard.entries) continue;
    for (const [caseId, entry] of Object.entries(shard.entries)) {
      (entries[caseId] ??= {})[shard.person] = entry;
    }
  }
  return entries;
}

function readShard(person) {
  const file = shardPath(person);
  if (!existsSync(file)) return null;
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

function writeShard(shard) {
  mkdirSync(stateDir, { recursive: true });
  // Temp + rename so a reader never observes a half-written shard.
  const target = shardPath(shard.person);
  const temporary = `${target}.${process.pid}.${Date.now()}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(shard, null, 2)}\n`);
  renameSync(temporary, target);
}

function sendJson(response, status, body) {
  const payload = JSON.stringify(body);
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "private, no-store",
  });
  response.end(payload);
}

function resolveStatic(requestPath) {
  const pathname = decodeURIComponent(requestPath.split("?")[0]);
  if (pathname.includes("\0")) return null;
  const candidate = path.resolve(distDir, `.${pathname === "/" ? "/index.html" : pathname}`);
  const rootWithSeparator = `${distDir}${path.sep}`;
  if (candidate !== distDir && !candidate.startsWith(rootWithSeparator)) return null;
  return existsSync(candidate) ? candidate : null;
}

async function readBody(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
}

function handleState(request, response) {
  if (request.method === "GET") {
    const entries = mergeShards(TEAM.map(readShard));
    return sendJson(response, 200, { team: TEAM, entries, readAt: new Date().toISOString() });
  }
  if (request.method === "POST") {
    return readBody(request).then((text) => {
      let body;
      try {
        body = JSON.parse(text);
      } catch {
        return sendJson(response, 400, { error: "invalid JSON" });
      }
      if (!TEAM.includes(body.person)) {
        return sendJson(response, 400, { error: `unknown tester — expected one of ${TEAM.join(", ")}` });
      }
      const previous = readShard(body.person);
      const shard = {
        person: body.person,
        updatedAt: new Date().toISOString(),
        entries: mergeDelta(previous?.entries ?? {}, sanitizeDelta(body.entries)),
      };
      writeShard(shard);
      return sendJson(response, 200, { ok: true, person: shard.person, count: Object.keys(shard.entries).length });
    });
  }
  return sendJson(response, 405, { error: "method not allowed" });
}

function main() {
  const portFlag = process.argv.indexOf("--port");
  const port = portFlag > -1 ? Number(process.argv[portFlag + 1]) : 4610;

  if (!existsSync(path.join(distDir, "index.html"))) {
    console.error("qa-app dev: dist/ is empty — run `node packages/qa-app/build.mjs` first.");
    process.exit(1);
  }

  const server = createServer((request, response) => {
    if (request.url.split("?")[0] === "/api/state") return handleState(request, response);
    const file = resolveStatic(request.url);
    if (!file) {
      response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      return response.end("Not found");
    }
    response.writeHead(200, {
      "content-type": CONTENT_TYPES[path.extname(file)] || "application/octet-stream",
      "cache-control": "no-store",
    });
    response.end(readFileSync(file));
  });

  server.listen(port, "127.0.0.1", () => {
    const shards = existsSync(stateDir) ? readdirSync(stateDir).filter((f) => f.endsWith(".json")).length : 0;
    console.log(`qa-app dev: http://127.0.0.1:${port} — state in tmp/qa-app/ (${shards} shard(s))`);
  });
}

// Run only when invoked directly; the merge helpers above are imported by tests.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
