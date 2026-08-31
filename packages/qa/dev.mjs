#!/usr/bin/env node
/**
 * Local QA app — the deployed app's behaviour, without Vercel or Blob.
 *
 * Serves dist/ and implements the same /api/state contract against per-tester
 * JSON files under tmp/qa/, so the sharded-by-writer model can be exercised
 * (two browsers, same case, no clobbering) before anything is deployed.
 *
 * It is NOT a mid-session fallback. Its state is a separate store: it neither
 * reads the deployed shards nor pushes back to them, so a session split across
 * both ends up with results in two places and `qa:pull` only sees one of them.
 * If the deployment is down mid-session, the honest options are to wait or to
 * record on paper — not to quietly start a second source of truth.
 *
 *   node packages/qa/dev.mjs [--port 4610]
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
const stateDir = path.join(packageDir, "..", "..", "tmp", "qa");

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
 * Same field-level delta semantics the deployed function applies, so a local
 * run cannot prove something the deployment would not do. Deletion is
 * explicit; the legacy two-empty-fields shape remains compatible.
 */
export function sanitizeDelta(raw) {
  const delta = Object.create(null);
  if (!raw || typeof raw !== "object") return delta;
  for (const [caseId, value] of Object.entries(raw)) {
    if (!caseId || caseId.length > 64) continue;
    if (!value || typeof value !== "object") continue;
    const hasStatus =
      Object.prototype.hasOwnProperty.call(value, "s") && typeof value.s === "string" && STATUSES.has(value.s);
    const hasNote = Object.prototype.hasOwnProperty.call(value, "n") && typeof value.n === "string";
    if (value.delete === true || (hasStatus && hasNote && !value.s && !value.n.trim())) {
      delta[caseId] = { delete: true };
      continue;
    }
    const patch = {};
    if (hasStatus) patch.s = value.s;
    if (hasNote) patch.n = value.n.slice(0, MAX_NOTE_LENGTH);
    if (Object.keys(patch).length) delta[caseId] = patch;
  }
  return delta;
}

/**
 * Arrival-ordered, field-level merge. Client clocks are never trusted for
 * ordering — see packages/qa/api/state.ts, which this must match exactly.
 */
export function mergeDelta(existing, delta, now = new Date().toISOString()) {
  const merged = Object.assign(Object.create(null), existing);
  for (const [caseId, incoming] of Object.entries(delta)) {
    if (incoming.delete) {
      delete merged[caseId];
      continue;
    }
    const current = merged[caseId] ?? { s: "", n: "", at: now };
    const next = {
      s: Object.prototype.hasOwnProperty.call(incoming, "s") ? (incoming.s ?? "") : current.s,
      n: Object.prototype.hasOwnProperty.call(incoming, "n") ? (incoming.n ?? "") : current.n,
      at: now,
    };
    if (!next.s && !next.n.trim()) delete merged[caseId];
    else merged[caseId] = next;
  }
  return merged;
}

/** caseId -> person -> entry, merged across every tester's shard. */
export function mergeShards(shards) {
  const entries = Object.create(null);
  for (const shard of shards) {
    if (!shard || !shard.entries) continue;
    for (const [caseId, entry] of Object.entries(shard.entries)) {
      (entries[caseId] ??= Object.create(null))[shard.person] = entry;
    }
  }
  return entries;
}

/**
 * Absent vs unreadable matters here exactly as it does in the deployed
 * function: absent means "nothing recorded yet" and merges onto an empty base,
 * while unreadable must refuse the write rather than erase the shard.
 */
function readShard(person) {
  const file = shardPath(person);
  if (!existsSync(file)) return null;
  const text = readFileSync(file, "utf8");
  try {
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== "object" || !parsed.entries) throw new Error("malformed");
    return parsed;
  } catch (error) {
    throw new StoreError(`${person}'s entries are unreadable and were not overwritten`, error);
  }
}

/** Message is safe to return; detail stays in the server log. Mirrors api/state.ts. */
class StoreError extends Error {
  constructor(message, detail) {
    super(message);
    this.name = "StoreError";
    this.detail = detail;
  }
}

function sendFailure(response, error, fallback) {
  const safe = error instanceof StoreError ? error.message : fallback;
  console.error(`qa dev: ${safe}`, error instanceof StoreError ? error.detail : error);
  return sendJson(response, 503, { error: safe });
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

/**
 * The build emits exactly two files, so the request never contributes to the
 * path at all: it selects a key in a fixed map. Sanitizing a request-derived
 * path would work too, but only as long as the check stays correct — this
 * cannot traverse because there is nothing to traverse.
 */
const SERVABLE = new Map([
  ["/", "index.html"],
  ["/index.html", "index.html"],
  ["/catalog.json", "catalog.json"],
]);

function resolveStatic(requestPath) {
  const name = SERVABLE.get(requestPath.split("?")[0]);
  if (!name) return null;
  const file = path.join(distDir, name);
  return existsSync(file) ? file : null;
}

async function readBody(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
}

/**
 * Local identity, without a wallet.
 *
 * The deployment authenticates with Sign-In With Ethereum, but requiring a
 * wallet to rehearse locally would put a hardware dependency in front of
 * "prove the two-writer behaviour before deploying" — and a teammate should be
 * able to try the app before anyone adds their address to an allowlist. This
 * server is bound to 127.0.0.1, so the bypass cannot leave the machine.
 *
 *   http://127.0.0.1:4610/?as=Gui   → record as Gui for this tab
 */
const DEV_COOKIE = "qa_dev_person";

export function devIdentity(request) {
  const asked = new URL(request.url, "http://127.0.0.1").searchParams.get("as");
  if (TEAM.includes(asked)) return asked;
  for (const part of (request.headers.cookie || "").split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === DEV_COOKIE && TEAM.includes(rest.join("="))) return rest.join("=");
  }
  return TEAM[0];
}

export function handleState(request, response) {
  if (request.method === "GET") {
    try {
      const entries = mergeShards(TEAM.map(readShard));
      const you = devIdentity(request);
      // Same response shape as the deployed function, so the page cannot take a
      // different path locally than it will in front of a real tester.
      return sendJson(response, 200, {
        team: TEAM,
        you,
        address: null,
        named: true,
        entries,
        readAt: new Date().toISOString(),
      });
    } catch (error) {
      return sendFailure(response, error, "session state could not be read");
    }
  }
  if (request.method === "POST") {
    return readBody(request).then((text) => {
      let body;
      try {
        body = JSON.parse(text);
      } catch {
        return sendJson(response, 400, { error: "invalid JSON" });
      }
      // `JSON.parse("null")` and `JSON.parse("[]")` both succeed.
      if (!body || typeof body !== "object" || Array.isArray(body)) {
        return sendJson(response, 400, { error: "body must be a JSON object" });
      }
      // Identity is the local session, never the body — the deployed server
      // derives it from the signed cookie and this must not diverge.
      body.person = devIdentity(request);
      if (!TEAM.includes(body.person)) {
        return sendJson(response, 400, { error: `unknown tester — expected one of ${TEAM.join(", ")}` });
      }
      // No conditional write is needed here the way the deployed function needs
      // one: node runs this handler to completion on a single thread, with no
      // await between the read and the write, so a second POST cannot interleave.
      let previous;
      try {
        previous = readShard(body.person);
      } catch (error) {
        return sendFailure(response, error, `${body.person}'s entries were not saved`);
      }
      const shard = {
        person: body.person,
        updatedAt: new Date().toISOString(),
        entries: mergeDelta(previous?.entries ?? {}, sanitizeDelta(body.entries)),
      };
      try {
        writeShard(shard);
      } catch (error) {
        return sendFailure(response, error, `${body.person}'s entries were not saved`);
      }
      return sendJson(response, 200, { ok: true, person: shard.person, count: Object.keys(shard.entries).length });
      // A rejection here — an aborted request stream, or an unwritable tmp/qa —
      // has no other handler: `createServer` ignores the promise this returns,
      // and an unhandled rejection takes the whole rehearsal server down
      // mid-session. Answer like the deployed function does instead.
    }).catch((error) => sendFailure(response, error, "the request could not be read"));
  }
  return sendJson(response, 405, { error: "method not allowed" });
}

function main() {
  const portFlag = process.argv.indexOf("--port");
  const port = portFlag > -1 ? Number(process.argv[portFlag + 1]) : 4610;

  if (!existsSync(path.join(distDir, "index.html"))) {
    console.error("qa dev: dist/ is empty — run `node packages/qa/build.mjs` first.");
    process.exit(1);
  }

  const server = createServer((request, response) => {
    // `?as=Gui` on any request pins this browser's local identity, the way the
    // deployment pins it with a signed session cookie.
    const asked = new URL(request.url, "http://127.0.0.1").searchParams.get("as");
    if (TEAM.includes(asked)) {
      response.setHeader("Set-Cookie", `${DEV_COOKIE}=${asked}; Path=/; SameSite=Lax; Max-Age=43200`);
    }
    if (request.url.split("?")[0] === "/api/auth") {
      const person = devIdentity(request);
      return sendJson(response, 200, {
        named: true,
        domain: "127.0.0.1",
        uri: `http://127.0.0.1:${port}`,
        nonce: null,
        message: null,
        person,
        address: null,
      });
    }
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
    console.log(`qa dev: http://127.0.0.1:${port} — state in tmp/qa/ (${shards} shard(s))`);
  });
}

// Run only when invoked directly; the merge helpers above are imported by tests.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
