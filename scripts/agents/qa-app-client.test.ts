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
      // Identity arrives as `you` in the state payload — see the mocks below.
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
        if (stateGetCount === 1) return response({ team: ["Afo"], you: "Afo", entries: snapshot });
        return new Promise((resolve) => {
          releaseStalePoll = () => resolve(response({ team: ["Afo"], you: "Afo", entries: snapshot }));
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

/**
 * A tester closes the tab (or dismisses the installed PWA) before the debounce
 * fires. The page promises "kept locally, retrying", so the unsent note has to
 * outlive the page session and go out on the next open.
 *
 * Two page lives, with only what a browser would actually carry between them:
 * localStorage is seeded from the first window, sessionStorage starts empty.
 */
async function outboxDurabilityHarness() {
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
  // A second case so one tab's queued work can be distinguished from another's.
  const otherCase = { ...testCase, id: "PUB-002", scenario: "Browse the gardens map" };
  const response = (body) => ({ ok: true, status: 200, json: async () => structuredClone(body) });
  const flush = async () => {
    await Promise.resolve();
    await Promise.resolve();
    await new Promise((resolve) => setImmediate(resolve));
  };

  async function pageLife({ seedKey = "qa-outbox:Afo", carried = null, person = "Afo" }, drive) {
    const posts = [];
    const timers = new Map();
    let timerId = 0;
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
        // Identity arrives as `you` in the state payload.
        // Everything the previous page life left behind, and nothing more.
        if (carried) window.localStorage.setItem(seedKey, carried);
        window.setTimeout = (callback, delay = 0) => {
          const id = ++timerId;
          timers.set(id, { callback, delay });
          return id;
        };
        window.clearTimeout = (id) => timers.delete(id);
        window.setInterval = () => 1;
        window.fetch = async (input, init = {}) => {
          const target = String(input);
          if (target === "catalog.json") {
            return response({ tabs: [testCase.tab], cases: [testCase] });
          }
          if (target !== "/api/state") throw new Error(`unexpected fetch ${target}`);
          if (init.method === "POST") {
            posts.push(JSON.parse(String(init.body)));
            return response({ ok: true, person, count: 1 });
          }
          // The store never received the note, so it has nothing to return.
          return response({ team: ["Afo", "Gui"], you: person, entries: {} });
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
      assert.ok(
        dom.window.document.querySelector('[data-note="PUB-001"]'),
        jsdomError || "the page did not render",
      );
      await drive({ dom, posts, runTimer, storage: dom.window.localStorage });
      return dom.window.localStorage.getItem("qa-outbox:Afo");
    } finally {
      dom.window.close();
    }
  }

  // Life one: type, then end the page session with the save still pending.
  const carried = await pageLife({}, async ({ dom, posts }) => {
    const note = dom.window.document.querySelector('[data-note="PUB-001"]');
    note.value = "unsent when the tab closed";
    note.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
    await flush();
    assert.deepEqual(posts, [], "the debounce should not have fired yet");
  });
  assert.ok(carried, "closing the tab left no recoverable copy of the unsent note");
  assert.deepEqual(JSON.parse(carried), {
    person: "Afo",
    delta: { "PUB-001": { n: "unsent when the tab closed" } },
  });

  // Life two: a new page session recovers it and sends it as a field patch.
  const recover = async ({ dom, posts, runTimer }) => {
    assert.equal(
      dom.window.document.querySelector('[data-note="PUB-001"]')?.value,
      "unsent when the tab closed",
    );
    await runTimer(400);
    assert.deepEqual(posts, [
      { person: "Afo", entries: { "PUB-001": { n: "unsent when the tab closed" } } },
    ]);
  };
  const drained = await pageLife({ carried }, recover);
  assert.equal(drained, null, "a confirmed write should leave nothing pending");

  // The same recovery from the single shared key this page used before it kept
  // one queue per tester, so an upgrade in place does not strand pending work.
  const migrated = await pageLife({ carried, seedKey: "qa-outbox" }, recover);
  assert.equal(migrated, null, "a migrated queue should drain like any other");

  // A DIFFERENT tester opening the same browser must not touch Afo's queue:
  // localStorage is shared across tabs, so one key for everyone would let this
  // delete the only copy of work Afo has not managed to save.
  await pageLife({ carried, person: "Gui" }, async ({ storage, posts }) => {
    assert.deepEqual(posts, [], "Gui's page should not post Afo's work");
    assert.deepEqual(
      JSON.parse(storage.getItem("qa-outbox:Afo") || "null"),
      { person: "Afo", delta: { "PUB-001": { n: "unsent when the tab closed" } } },
      "Afo's unsent work was discarded by another tester's page",
    );
  });

  // TWO TABS, ONE TESTER. They share a key but each holds its own queue, so a
  // whole-object write would drop whatever the other tab had put there.
  await pageLife({}, async ({ dom, storage }) => {
    storage.setItem(
      "qa-outbox:Afo",
      JSON.stringify({ person: "Afo", delta: { "PUB-002": { n: "queued by the other tab" } } }),
    );

    const note = dom.window.document.querySelector('[data-note="PUB-001"]');
    note.value = "queued by this tab";
    note.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
    await flush();

    assert.deepEqual(JSON.parse(storage.getItem("qa-outbox:Afo") || "null"), {
      person: "Afo",
      delta: {
        "PUB-002": { n: "queued by the other tab" },
        "PUB-001": { n: "queued by this tab" },
      },
    });
  });
}

/**
 * A field that has already reached the server must not ride along on the next
 * edit. Status click posts `{s}`; the tester types a note before that response
 * lands; the follow-up has to carry only `{n}`, or it reasserts a verdict the
 * other device may have moved on from.
 */
async function inFlightFieldHarness() {
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
  const response = (body) => ({ ok: true, status: 200, json: async () => structuredClone(body) });
  const flush = async () => {
    await Promise.resolve();
    await Promise.resolve();
    await new Promise((resolve) => setImmediate(resolve));
  };

  const posts = [];
  const timers = new Map();
  let timerId = 0;
  let releaseFirstPost = null;
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
      // Identity arrives as `you` in the state payload — see the mocks below.
      window.setTimeout = (callback, delay = 0) => {
        const id = ++timerId;
        timers.set(id, { callback, delay });
        return id;
      };
      window.clearTimeout = (id) => timers.delete(id);
      window.setInterval = () => 1;
      window.fetch = async (input, init = {}) => {
        const target = String(input);
        if (target === "catalog.json") {
          return response({ tabs: [testCase.tab], cases: [testCase] });
        }
        if (target !== "/api/state") throw new Error(`unexpected fetch ${target}`);
        if (init.method === "POST") {
          posts.push(JSON.parse(String(init.body)));
          // Hold the FIRST response open so the note is typed mid-flight.
          if (posts.length === 1) {
            return new Promise((resolve) => {
              releaseFirstPost = () => resolve(response({ ok: true, person: "Afo", count: 1 }));
            });
          }
          return response({ ok: true, person: "Afo", count: 1 });
        }
        return response({ team: ["Afo"], you: "Afo", entries: {} });
      };
    },
  });

  const takeTimer = (delay) => {
    const timer = [...timers.entries()].find(([, pending]) => pending.delay === delay);
    assert.ok(timer, `expected a ${delay}ms timer`);
    timers.delete(timer[0]);
    return timer[1].callback;
  };
  const runTimer = async (delay) => {
    await takeTimer(delay)();
    await flush();
  };

  try {
    await flush();
    assert.ok(
      dom.window.document.querySelector('[data-note="PUB-001"]'),
      jsdomError || "the page did not render",
    );

    dom.window.document.querySelector('[data-id="PUB-001"][data-s="fail"]')?.click();
    // Fire WITHOUT awaiting — this request is deliberately left in flight.
    const inFlight = takeTimer(900)();
    await flush();
    assert.ok(releaseFirstPost, "the status save did not start");
    assert.deepEqual(posts[0].entries, { "PUB-001": { s: "fail" } });

    const note = dom.window.document.querySelector('[data-note="PUB-001"]');
    note.value = "typed while the verdict was still in flight";
    note.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
    await flush();

    releaseFirstPost();
    await inFlight;
    await flush();

    await runTimer(400);
    assert.equal(posts.length, 2, "the note should have gone out on its own");
    assert.deepEqual(posts[1].entries, {
      "PUB-001": { n: "typed while the verdict was still in flight" },
    });
  } finally {
    dom.window.close();
  }
}

describe("QA app client races", () => {
  // Each case spawns a Node subprocess and boots JSDOM once per page life, which
  // runs past Vitest's 5s default — the cause of the intermittent timeout here.
  const JSDOM_SUBPROCESS_TIMEOUT_MS = 120_000;

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
  }, JSDOM_SUBPROCESS_TIMEOUT_MS);

  it("keeps an unsent note across a page session and sends it on the next open", () => {
    execFileSync(
      "node",
      [
        "scripts/dev/node-cli.js",
        "node",
        "--input-type=module",
        "--eval",
        `await (${outboxDurabilityHarness.toString()})()`,
      ],
      { cwd: repoRoot, stdio: "pipe" },
    );
  }, JSDOM_SUBPROCESS_TIMEOUT_MS);

  it("does not resend a verdict the server already stored alongside a later note", () => {
    execFileSync(
      "node",
      [
        "scripts/dev/node-cli.js",
        "node",
        "--input-type=module",
        "--eval",
        `await (${inFlightFieldHarness.toString()})()`,
      ],
      { cwd: repoRoot, stdio: "pipe" },
    );
  }, JSDOM_SUBPROCESS_TIMEOUT_MS);
});
