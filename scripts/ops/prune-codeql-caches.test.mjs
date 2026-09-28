import assert from "node:assert/strict";
import test from "node:test";

import { pruneOverlayDatabases, unreachableOverlayDatabases } from "./prune-codeql-caches.mjs";

const overlay = ({ id, created, ref = "refs/heads/develop", language = "javascript", cli = "2.27.1" }) => ({
  id,
  ref,
  key: `codeql-overlay-base-database-1-c801913f1ee29663-${language}-${cli}-${String(id).padStart(40, "a")}-${36486988000 + id}-1`,
  created_at: created,
  size_in_bytes: 450 * 1048576,
});
const ids = (caches) => caches.map((cache) => cache.id).sort((a, b) => a - b);

test("keeps only the newest database per branch and restore key", () => {
  const caches = [
    overlay({ id: 1, created: "2026-09-27T10:31:00Z" }),
    overlay({ id: 3, created: "2026-09-28T21:40:00Z" }),
    overlay({ id: 2, created: "2026-09-28T07:22:00Z" }),
    // A tie on creation time keeps the later cache.
    overlay({ id: 5, created: "2026-09-26T09:00:00Z", ref: "refs/pull/7/merge" }),
    overlay({ id: 4, created: "2026-09-26T09:00:00Z", ref: "refs/pull/7/merge" }),
  ];
  assert.deepEqual(ids(unreachableOverlayDatabases(caches)), [1, 2, 4]);
});

test("each language and CLI version is its own restore key", () => {
  const caches = [
    overlay({ id: 1, created: "2026-09-27T10:00:00Z" }),
    overlay({ id: 2, created: "2026-09-28T10:00:00Z" }),
    overlay({ id: 3, created: "2026-09-27T11:00:00Z", cli: "2.28.0" }),
    overlay({ id: 4, created: "2026-09-27T12:00:00Z", language: "python" }),
  ];
  assert.deepEqual(ids(unreachableOverlayDatabases(caches)), [1]);
});

test("never selects a cache whose key it does not recognise", () => {
  const unrecognised = [
    { id: 10, ref: "refs/heads/develop", key: "bun-gmoqYqdUbaYsI0KujeXt7Zg/p0I=", created_at: "2026-09-16T20:07:00Z" },
    { id: 11, ref: "refs/heads/develop", key: "foundry-unit-test-Linux-258a220a-8e05497f6", created_at: "2026-09-28T20:56:00Z" },
    { id: 12, ref: "refs/heads/develop", key: "codeql-trap-1-2.27.1-javascript-0123abcd", created_at: "2026-09-20T00:00:00Z" },
    // An overlay key without the commit, run and attempt this expects.
    { id: 13, ref: "refs/heads/develop", key: "codeql-overlay-base-database-2-javascript-2.27.1", created_at: "2026-09-20T00:00:00Z" },
  ];
  const caches = [...unrecognised, overlay({ id: 1, created: "2026-09-28T21:40:00Z" })];
  assert.deepEqual(unreachableOverlayDatabases(caches), []);
});

function fakeGh(caches, { failDelete } = {}) {
  const deletes = [];
  const gh = (args) => {
    if (args.includes("DELETE")) {
      const id = Number(args.at(-1).split("/").pop());
      deletes.push(id);
      failDelete?.(id);
      return "";
    }
    assert.ok(args.some((arg) => arg.includes("actions/caches?key=codeql-overlay-base-database-")));
    return `${caches.map((cache) => JSON.stringify(cache)).join("\n")}\n`;
  };
  return { gh, deletes };
}

test("deletes the unreachable databases, skipping one GitHub already evicted", () => {
  const caches = [1, 2, 3].map((id) => overlay({ id, created: `2026-09-28T0${id}:00:00Z` }));
  const evicted = Object.assign(new Error("Command failed"), { stderr: "gh: Not Found (HTTP 404)" });
  const { gh, deletes } = fakeGh(caches, { failDelete: (id) => { if (id === 1) throw evicted; } });
  const result = pruneOverlayDatabases({ repository: "owner/repo", gh, log: () => {} });
  assert.deepEqual(deletes.sort(), [1, 2]);
  assert.deepEqual(result, { listed: 3, unreachable: 2, deleted: 1 });

  // Any other failure stops the run rather than reporting a clean prune.
  const denied = Object.assign(new Error("Command failed"), { stderr: "gh: Resource not accessible by integration (HTTP 403)" });
  const refused = fakeGh(caches, { failDelete: () => { throw denied; } });
  assert.throws(() => pruneOverlayDatabases({ repository: "owner/repo", gh: refused.gh, log: () => {} }), /Command failed/);
});

test("a dry run lists what it would delete and deletes nothing", () => {
  const caches = [1, 2].map((id) => overlay({ id, created: `2026-09-28T0${id}:00:00Z` }));
  const { gh, deletes } = fakeGh(caches);
  const lines = [];
  const result = pruneOverlayDatabases({ repository: "owner/repo", dryRun: true, gh, log: (line) => lines.push(line) });
  assert.deepEqual(deletes, []);
  assert.deepEqual(result, { listed: 2, unreachable: 1, deleted: 0 });
  assert.ok(lines.some((line) => line.startsWith("would delete 1 refs/heads/develop")));
});
