import { execFileSync } from "node:child_process";
import path from "node:path";
import { describe, it } from "vitest";

const repoRoot = path.join(import.meta.dirname, "..", "..");

/**
 * Bun cannot execute JSDOM's script VM because its global prototype chain uses
 * a Proxy. Run this one real-page harness in Node while keeping the assertion
 * under the existing agent-tools Vitest suite.
 */
async function clientRaceHarness() {
  const dynamicImport = new Function("specifier", "return import(specifier)");
  const assert = (await dynamicImport("node:assert/strict")).default;
  const { readFileSync } = await dynamicImport("node:fs");
  const path = await dynamicImport("node:path");
  const { JSDOM, VirtualConsole } = await dynamicImport("jsdom");

  const page = readFileSync(path.join(process.cwd(), "packages", "qa", "index.html"), "utf8");
  const testCase = {
    id: "PUB-001",
    tab: "Public Website",
    area: "Funding",
    pri: "P0",
    scenario: "Donate end to end",
    expected: "The donation completes",
    rp: false,
    rd: false,
    tx: false,
  };
  const response = (body) => ({
    ok: true,
    status: 200,
    json: async () => structuredClone(body),
  });
  const flush = async () => {
    await Promise.resolve();
    await Promise.resolve();
    await new Promise((resolve) => setImmediate(resolve));
  };

  let remote = {
    "PUB-001": { Afo: { s: "pass", n: "old poll snapshot note", at: "2026-08-30T10:00:00.000Z" } },
  };
  const posts = [];
  const timers = new Map();
  let timerId = 0;
  let pollCallback = null;
  let stateGetCount = 0;
  let releaseStalePoll = null;
  let jsdomError = "";
  const virtualConsole = new VirtualConsole();
  virtualConsole.on("jsdomError", (error) => {
    jsdomError = error.cause?.stack || error.cause?.message || error.message;
  });

  const dom = new JSDOM(page, {
    runScripts: "dangerously",
    url: "http://localhost:4610/",
    virtualConsole,
    beforeParse(window) {
      window.localStorage.setItem("qa-who", "Afo");
      window.setTimeout = (callback, delay = 0) => {
        const id = ++timerId;
        timers.set(id, { callback, delay });
        return id;
      };
      window.clearTimeout = (id) => timers.delete(id);
      window.setInterval = (callback) => {
        pollCallback = callback;
        return 1;
      };
      window.fetch = async (input, init = {}) => {
        const target = String(input);
        if (target === "catalog.json") {
          return response({ tabs: [testCase.tab], cases: [testCase] });
        }
        if (target !== "/api/state") throw new Error(`unexpected fetch ${target}`);
        if (init.method === "POST") {
          const body = JSON.parse(String(init.body));
          posts.push(body);
          for (const [caseId, patch] of Object.entries(body.entries)) {
            if (patch.delete) {
              delete remote[caseId];
              continue;
            }
            const current = remote[caseId]?.Afo || { s: "", n: "" };
            const next = {
              s: Object.prototype.hasOwnProperty.call(patch, "s") ? patch.s : current.s,
              n: Object.prototype.hasOwnProperty.call(patch, "n") ? patch.n : current.n,
              at: "2026-08-30T12:00:00.000Z",
            };
            if (!next.s && !next.n.trim()) delete remote[caseId];
            else remote[caseId] = { Afo: next };
          }
          return response({ ok: true, person: body.person, count: Object.keys(remote).length });
        }

        stateGetCount++;
        const snapshot = structuredClone(remote);
        if (stateGetCount === 1) return response({ team: ["Afo"], entries: snapshot });
        return new Promise((resolve) => {
          releaseStalePoll = () => resolve(response({ team: ["Afo"], entries: snapshot }));
        });
      };
    },
  });

  const runTimer = async (delay) => {
    const timer = [...timers.entries()].find(([, pending]) => pending.delay === delay);
    assert.ok(timer, `expected a ${delay}ms timer`);
    timers.delete(timer[0]);
    await timer[1].callback();
    await flush();
  };

  try {
    await flush();
    assert.ok(pollCallback, jsdomError || "poll interval was not registered");
    const pendingPoll = pollCallback();
    await flush();
    assert.ok(releaseStalePoll, "slow poll did not start");

    const note = dom.window.document.querySelector('[data-note="PUB-001"]');
    assert.ok(note, "note input did not render");
    note.value = "new note saved before stale poll";
    note.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
    await runTimer(2500);

    assert.equal(dom.window.document.getElementById("savebar")?.textContent, "saved ✓");
    assert.deepEqual(posts[0].entries, { "PUB-001": { n: "new note saved before stale poll" } });

    releaseStalePoll();
    await pendingPoll;
    await flush();
    assert.equal(
      dom.window.document.querySelector('[data-note="PUB-001"]')?.value,
      "new note saved before stale poll",
    );

    dom.window.document.querySelector('[data-id="PUB-001"][data-s="fail"]')?.click();
    await runTimer(900);

    assert.deepEqual(posts[1].entries, { "PUB-001": { s: "fail" } });
    assert.equal(remote["PUB-001"].Afo.s, "fail");
    assert.equal(remote["PUB-001"].Afo.n, "new note saved before stale poll");
  } finally {
    dom.window.close();
  }
}

describe("QA app client races", () => {
  it("does not let a stale poll roll back a note that already showed saved", () => {
    execFileSync(
      "node",
      [
        "scripts/dev/node-cli.js",
        "node",
        "--input-type=module",
        "--eval",
        `await (${clientRaceHarness.toString()})()`,
      ],
      { cwd: repoRoot, stdio: "pipe" },
    );
  });
});
