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
    const signInPanel = dom.window.document.getElementById("signin");
    assert.equal(signInPanel?.hidden, true);
    assert.equal(dom.window.getComputedStyle(signInPanel).display, "none");
    assert.ok(pollCallback, jsdomError || "poll interval was not registered");
    assert.equal(
      dom.window.document.querySelector('[data-sort="journey"]'),
      null,
      "older deployed catalogs must not show empty Journey controls",
    );
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
  const AFO_ADDRESS = "0x2aa64e6d80390f5c017f0313cb908051be2fd35e";
  const GUI_ADDRESS = "0x22682c3d3848294ff9bcbf3f0ddf48a605446b56";
  const response = (body) => ({ ok: true, status: 200, json: async () => structuredClone(body) });
  const flush = async () => {
    await Promise.resolve();
    await Promise.resolve();
    await new Promise((resolve) => setImmediate(resolve));
  };

  async function pageLife(
    { seedKey = `qa-outbox:${AFO_ADDRESS}`, carried = null, person = "Afo", owner = AFO_ADDRESS },
    drive,
  ) {
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
          return response({ team: ["Afo", "Gui"], you: person, address: owner, entries: {} });
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
      return dom.window.localStorage.getItem(`qa-outbox:${owner}`);
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
    owner: AFO_ADDRESS,
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
      { entries: { "PUB-001": { n: "unsent when the tab closed" } } },
    ]);
  };
  const drained = await pageLife({ carried }, recover);
  assert.equal(drained, null, "a confirmed write should leave nothing pending");

  // The same recovery from the single shared key this page used before it kept
  // one queue per tester, so an upgrade in place does not strand pending work.
  const migrated = await pageLife({ carried, seedKey: "qa-outbox" }, recover);
  assert.equal(migrated, null, "a migrated queue should drain like any other");

  // The first wallet-auth release keyed by display name. Re-home that queue
  // under the signing address before removing the old copy.
  const legacyCarried = JSON.stringify({ person: "Afo", delta: JSON.parse(carried).delta });
  const nameKeyMigration = await pageLife({ carried: legacyCarried, seedKey: "qa-outbox:Afo" }, recover);
  assert.equal(nameKeyMigration, null, "a name-keyed queue should migrate to its owner address");

  // A DIFFERENT tester opening the same browser must not touch Afo's queue:
  // localStorage is shared across tabs, so one key for everyone would let this
  // delete the only copy of work Afo has not managed to save.
  await pageLife({ carried, person: "Gui", owner: GUI_ADDRESS }, async ({ storage, posts }) => {
    assert.deepEqual(posts, [], "Gui's page should not post Afo's work");
    assert.deepEqual(
      JSON.parse(storage.getItem(`qa-outbox:${AFO_ADDRESS}`) || "null"),
      { owner: AFO_ADDRESS, person: "Afo", delta: { "PUB-001": { n: "unsent when the tab closed" } } },
      "Afo's unsent work was discarded by another tester's page",
    );
  });

  // TWO TABS, ONE TESTER. They share a key but each holds its own queue, so a
  // whole-object write would drop whatever the other tab had put there.
  await pageLife({}, async ({ dom, storage }) => {
    storage.setItem(
      `qa-outbox:${AFO_ADDRESS}`,
      JSON.stringify({ person: "Afo", delta: { "PUB-002": { n: "queued by the other tab" } } }),
    );

    const note = dom.window.document.querySelector('[data-note="PUB-001"]');
    note.value = "queued by this tab";
    note.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
    await flush();

    assert.deepEqual(JSON.parse(storage.getItem(`qa-outbox:${AFO_ADDRESS}`) || "null"), {
      owner: AFO_ADDRESS,
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

async function authRecoveryHarness() {
  const dynamicImport = new Function("specifier", "return import(specifier)");
  const assert = (await dynamicImport("node:assert/strict")).default;
  const { readFileSync } = await dynamicImport("node:fs");
  const path = await dynamicImport("node:path");
  const { JSDOM, VirtualConsole } = await dynamicImport("jsdom");

  const page = readFileSync(path.join(process.cwd(), "packages", "qa", "index.html"), "utf8");
  const owner = "0x2aa64e6d80390f5c017f0313cb908051be2fd35e";
  const other = "0x22682c3d3848294ff9bcbf3f0ddf48a605446b56";
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
  const response = (body, status = 200) => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => structuredClone(body),
  });
  const flush = async () => {
    await Promise.resolve();
    await Promise.resolve();
    await new Promise((resolve) => setImmediate(resolve));
  };

  let pollCallback = null;
  let stateReads = 0;
  const walletCalls = [];
  const virtualConsole = new VirtualConsole();
  const dom = new JSDOM(page, {
    runScripts: "dangerously",
    url: "https://qa.greengoods.app/",
    virtualConsole,
    beforeParse(window) {
      window.localStorage.setItem(
        `qa-outbox:${owner}`,
        JSON.stringify({ owner, person: "Afo", delta: { "PUB-001": { n: "unsaved" } } }),
      );
      window.setTimeout = () => 1;
      window.clearTimeout = () => {};
      window.setInterval = (callback) => {
        pollCallback = callback;
        return 1;
      };
      window.clearInterval = () => {};
      window.ethereum = {
        request: async ({ method }) => {
          walletCalls.push(method);
          if (method === "eth_requestAccounts") return [other];
          throw new Error(`unexpected wallet method ${method}`);
        },
      };
      window.fetch = async (input, init = {}) => {
        const target = String(input);
        if (target === "catalog.json") return response({ tabs: [testCase.tab], cases: [testCase] });
        if (target === "/api/state" && !init.method) {
          stateReads++;
          if (stateReads === 1) {
            return response({ team: ["Afo"], you: "Afo", address: owner, named: true, entries: {} });
          }
          return response({ error: "sign in" }, 401);
        }
        throw new Error(`unexpected fetch ${target}`);
      };
    },
  });

  try {
    await flush();
    assert.ok(pollCallback, "poll interval was not registered");
    await pollCallback();
    await flush();
    assert.equal(dom.window.document.getElementById("signin")?.hidden, false);
    assert.equal(dom.window.document.getElementById("mount")?.inert, true);
    assert.match(dom.window.document.getElementById("signin-why")?.textContent || "", /session expired/i);

    dom.window.document.getElementById("signin-btn")?.click();
    await flush();
    assert.match(dom.window.document.getElementById("signin-err")?.textContent || "", /wallet that started/i);
    assert.deepEqual(walletCalls, ["eth_requestAccounts"]);
  } finally {
    dom.window.close();
  }
}

/**
 * Display labels are untrusted, mutable presentation. A late collision must
 * replace the old labels without duplicating entries, and a JavaScript
 * prototype-shaped name must behave like any other tester name.
 */
async function displayLabelHarness() {
  const dynamicImport = new Function("specifier", "return import(specifier)");
  const assert = (await dynamicImport("node:assert/strict")).default;
  const { readFileSync } = await dynamicImport("node:fs");
  const path = await dynamicImport("node:path");
  const { JSDOM } = await dynamicImport("jsdom");

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

  async function openPage(initial, next = initial) {
    let pollCallback = null;
    let reads = 0;
    const dom = new JSDOM(page, {
      runScripts: "dangerously",
      url: "http://localhost:4610/",
      beforeParse(window) {
        window.setTimeout = () => 1;
        window.clearTimeout = () => {};
        window.setInterval = (callback) => {
          pollCallback = callback;
          return 1;
        };
        window.fetch = async (input, init = {}) => {
          const target = String(input);
          if (target === "catalog.json") return response({ tabs: [testCase.tab], cases: [testCase] });
          if (target === "/api/state" && init.method === "POST") {
            return response({ ok: true, person: initial.you, count: 1 });
          }
          if (target === "/api/state") return response(reads++ === 0 ? initial : next);
          throw new Error(`unexpected fetch ${target}`);
        };
      },
    });
    await flush();
    return { dom, poll: pollCallback };
  }

  const owner = "0x2aa64e6d80390f5c017f0313cb908051be2fd35e";
  const at = "2026-08-30T10:00:00.000Z";
  const initial = {
    team: ["Afo", "Gui"],
    you: "Afo",
    address: owner,
    named: true,
    entries: {
      "PUB-001": {
        Afo: { s: "pass", n: "mine", at },
        Gui: { s: "fail", n: "theirs", at },
      },
    },
  };
  const ownLabel = "Afo (0x2aa6…d35e)";
  const otherLabel = "afo (0x2268…6b56)";
  const relabelled = {
    ...initial,
    team: [ownLabel, otherLabel],
    you: ownLabel,
    entries: {
      "PUB-001": Object.fromEntries([
        [ownLabel, initial.entries["PUB-001"].Afo],
        [otherLabel, initial.entries["PUB-001"].Gui],
      ]),
    },
  };

  const collision = await openPage(initial, relabelled);
  try {
    assert.ok(collision.poll, "poll interval was not registered");
    const pendingNote = collision.dom.window.document.querySelector('[data-note="PUB-001"]');
    assert.ok(pendingNote, "note input did not render");
    pendingNote.value = "mine, still pending during relabel";
    pendingNote.dispatchEvent(new collision.dom.window.Event("input", { bubbles: true }));
    await flush();
    await collision.poll();
    await flush();
    assert.equal(collision.dom.window.document.querySelector(".current-tester")?.textContent, ownLabel);
    assert.equal(collision.dom.window.document.querySelectorAll(".who-btn").length, 0);
    assert.equal(collision.dom.window.document.querySelectorAll(".mark").length, 0);
    assert.equal(collision.dom.window.document.querySelectorAll(".onote").length, 0);
    assert.equal(
      collision.dom.window.document.querySelector('[data-note="PUB-001"]')?.value,
      "mine, still pending during relabel",
    );
    const viewSelect = collision.dom.window.document.querySelector("[data-view-select]");
    assert.ok(viewSelect, "view select did not render");
    viewSelect.value = "";
    viewSelect.dispatchEvent(new collision.dom.window.Event("change", { bubbles: true }));
    await flush();
    assert.equal(collision.dom.window.document.querySelectorAll("textarea").length, 0);
    assert.equal(collision.dom.window.document.querySelectorAll("button.st").length, 0);
    assert.deepEqual(
      [...collision.dom.window.document.querySelectorAll(".person-status b")].map((node) => node.textContent),
      [`${ownLabel}:`, `${otherLabel}:`],
    );
    assert.deepEqual(
      [...collision.dom.window.document.querySelectorAll(".overview-notes .onote b")].map(
        (node) => node.textContent,
      ),
      [`${ownLabel}:`, `${otherLabel}:`],
    );
  } finally {
    collision.dom.window.close();
  }

  const prototypeName = "__proto__";
  const prototype = await openPage({
    team: [prototypeName],
    you: prototypeName,
    address: owner,
    named: true,
    entries: {},
  });
  try {
    prototype.dom.window.document.querySelector('[data-id="PUB-001"][data-s="pass"]')?.click();
    await flush();
    assert.equal(
      prototype.dom.window.document.querySelector('[data-id="PUB-001"][data-s="pass"]')?.getAttribute("aria-pressed"),
      "true",
    );
    assert.equal(prototype.dom.window.document.querySelector(".row")?.classList.contains("done"), true);
    assert.equal(prototype.dom.window.document.querySelectorAll(".mark").length, 0);
    assert.equal(prototype.dom.window.document.querySelector(".tab small")?.textContent, "1/1");
  } finally {
    prototype.dom.window.close();
  }

  const markupName = '<img src=x onerror="globalThis.displayNameRan=true">';
  const escaped = await openPage({
    team: [markupName],
    you: markupName,
    address: owner,
    named: true,
    entries: {},
  });
  try {
    assert.equal(escaped.dom.window.document.querySelector("header img"), null);
    assert.equal(escaped.dom.window.document.querySelector(".current-tester")?.textContent, markupName);
    assert.equal(escaped.dom.window.displayNameRan, undefined);
  } finally {
    escaped.dom.window.close();
  }
}

async function journeyModeHarness() {
  const dynamicImport = new Function("specifier", "return import(specifier)");
  const assert = (await dynamicImport("node:assert/strict")).default;
  const { readFileSync } = await dynamicImport("node:fs");
  const path = await dynamicImport("node:path");
  const { JSDOM, VirtualConsole } = await dynamicImport("jsdom");

  const page = readFileSync(path.join(process.cwd(), "packages", "qa", "index.html"), "utf8");
  const cases = [
    { id: "ADM-002", tab: "Admin Dashboard", area: "Delivery", pri: "P0", scenario: "Third", preconditions: ["Third condition"], steps: ["Third step"], expected: "Third result", role: "steward", rp: false, rd: false, tx: true },
    { id: "PWA-001", tab: "PWA", area: "Claim", pri: "P0", scenario: "Second", preconditions: ["Second condition"], steps: ["Second step"], expected: "Second result", role: "gardener", rp: false, rd: false, tx: true },
    { id: "ADM-001", tab: "Admin Dashboard", area: "Prepare", pri: "P1", scenario: "First", preconditions: ["First condition", "Shared cycle visible"], steps: ["First step"], expected: "First result", role: "steward", rp: false, rd: false, tx: true },
  ];
  const lanes = [
    { id: "review", label: "Protocol & review", role: "Protocol steward" },
    { id: "member", label: "Garden & member", role: "Garden member" },
  ];
  const journeys = [
    {
      id: "relay",
      label: "Service relay",
      summary: "Two people follow one service relay.",
      lanes,
      phases: [
        { id: "prepare", label: "Prepare" },
        { id: "deliver", label: "Deliver" },
      ],
      steps: [
        { caseId: "ADM-001", phaseId: "prepare", leadLaneId: "review" },
        {
          caseId: "PWA-001",
          phaseId: "deliver",
          leadLaneId: "member",
          verifyLaneIds: ["review"],
          handoff: "Wait for the reviewer.",
          knownGate: "Settlement is not enabled.",
        },
        { caseId: "ADM-002", phaseId: "deliver", leadLaneId: "member" },
      ],
    },
    {
      id: "treasury",
      label: "Treasury top-up",
      summary: "Review one separate funding rail.",
      lanes,
      phases: [{ id: "fund", label: "Fund" }],
      steps: [{ caseId: "ADM-002", phaseId: "fund", leadLaneId: "review" }],
    },
  ];
  const localizedJourney = {
    relay: {
      label: "Relevo de servicios",
      summary: "Dos personas siguen un relevo de servicios.",
      lanes: {
        review: { label: "Protocolo y revisión", role: "Responsable del protocolo" },
        member: { label: "Garden y miembro", role: "Steward y miembro del Garden" },
      },
      phases: { prepare: "Preparar", deliver: "Entregar" },
      steps: {
        "PWA-001": {
          handoff: "Espera a que la persona revisora continúe.",
          knownGate: "La liquidación no está habilitada.",
        },
      },
    },
    treasury: {
      label: "Recarga de tesorería",
      summary: "Revisa una vía de financiación separada.",
      lanes: {
        review: { label: "Protocolo y revisión", role: "Responsable del protocolo" },
        member: { label: "Garden y miembro", role: "Steward y miembro del Garden" },
      },
      phases: { fund: "Financiar" },
      steps: {},
    },
  };
  const locales = {
    es: {
      name: "Español",
      ui: {
        journey: "Recorrido",
        part: "Parte",
        allParts: "Todas las partes",
        allSurfaces: "Todas las superficies",
        act: "Actuar",
        verify: "Verificar",
        surface: "Superficie",
        caseRole: "Rol requerido",
        preconditions: "Antes de empezar",
        handoff: "Coordinación",
        knownGate: "Condición conocida",
        journeyRoles: "Roles del recorrido",
        roleRequirements: "Responsabilidades del rol",
        language: "Idioma del recorrido",
        orderJourney: "Recorrido",
      },
      journeys: localizedJourney,
      cases: {
        "ADM-001": {
          scenario: "Primero en español",
          preconditions: ["Primera condición", "El ciclo compartido está visible"],
          steps: ["Primer paso", "Segundo paso detallado"],
          expected: "Primer resultado",
          role: "Steward",
        },
        "PWA-001": { scenario: "Segundo en español", preconditions: ["Segunda condición"], steps: ["Segundo paso"], expected: "Segundo resultado", role: "Miembro del Garden" },
        "ADM-002": { scenario: "Tercero en español", preconditions: ["Tercera condición"], steps: ["Tercer paso"], expected: "Tercer resultado", role: "Steward" },
      },
    },
    pt: {
      name: "Português",
      ui: {
        journey: "Jornada",
        part: "Parte",
        allParts: "Todas as partes",
        allSurfaces: "Todas as superfícies",
        act: "Agir",
        verify: "Verificar",
        surface: "Superfície",
        caseRole: "Papel necessário",
        preconditions: "Antes de começar",
        handoff: "Passagem",
        knownGate: "Limitação conhecida",
        journeyRoles: "Papéis da jornada",
        roleRequirements: "Responsabilidades do papel",
        language: "Idioma da jornada",
        orderJourney: "Jornada",
      },
      journeys: {
        ...localizedJourney,
        relay: {
          ...localizedJourney.relay,
          label: "Revezamento de serviços",
          summary: "Duas pessoas acompanham um revezamento de serviços.",
          lanes: {
            review: { label: "Protocolo e revisão", role: "Responsável pelo protocolo" },
            member: { label: "Garden e membro", role: "Steward e membro do Garden" },
          },
          phases: { prepare: "Preparar", deliver: "Entregar" },
          steps: {
            "PWA-001": {
              handoff: "Espere a pessoa revisora continuar.",
              knownGate: "A liquidação não está habilitada.",
            },
          },
        },
      },
      cases: {
        "ADM-001": { scenario: "Primeiro em português", preconditions: ["Primeira condição", "O ciclo compartilhado está visível"], steps: ["Primeiro passo"], expected: "Primeiro resultado", role: "Steward" },
        "PWA-001": { scenario: "Segundo em português", preconditions: ["Segunda condição"], steps: ["Segundo passo"], expected: "Segundo resultado", role: "Pessoa integrante do Garden" },
        "ADM-002": { scenario: "Terceiro em português", preconditions: ["Terceira condição"], steps: ["Terceiro passo"], expected: "Terceiro resultado", role: "Steward" },
      },
    },
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
  let restoredScroll = null;
  const virtualConsole = new VirtualConsole();
  let jsdomError = "";
  virtualConsole.on("jsdomError", (error) => {
    jsdomError = error.cause?.stack || error.cause?.message || error.message;
  });

  const dom = new JSDOM(page, {
    runScripts: "dangerously",
    url: "http://localhost:4610/",
    virtualConsole,
    beforeParse(window) {
      Object.defineProperty(window, "innerWidth", { value: 375, configurable: true });
      window.sessionStorage.setItem("qa-view", JSON.stringify({
        tab: "Admin Dashboard",
        filter: "all",
        sort: "journey",
        scope: "overview",
        journey: "relay",
        part: "",
        surface: "all",
        scroll: 73,
      }));
      window.localStorage.setItem("qa-locale", "es");
      window.scrollTo = (_x, y) => { restoredScroll = y; };
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
          return response({ tabs: ["PWA", "Admin Dashboard"], journeys, locales, cases });
        }
        if (target !== "/api/state") throw new Error(`unexpected fetch ${target}`);
        if (init.method === "POST") {
          posts.push(JSON.parse(String(init.body)));
          return response({ ok: true });
        }
        return response({
          team: ["Tester A", "Tester B"],
          you: "Tester A",
          address: "0x0000000000000000000000000000000000000001",
          entries: { "PWA-001": { "Tester B": { s: "fail", n: "visible issue" } } },
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
    const document = dom.window.document;
    assert.equal(restoredScroll, 73, jsdomError || "journey scroll was not restored");
    assert.equal(document.querySelector('[data-sort="journey"]')?.getAttribute("aria-pressed"), "true");
    assert.equal(document.querySelector('[data-tab="all"]')?.textContent.startsWith("Todas las superficies"), true);
    assert.equal(document.querySelector('label[for="qa-journey-select"]')?.textContent.includes("Recorrido"), true);
    assert.equal(document.querySelector('label[for="qa-part-select"]')?.textContent.includes("Parte"), true);
    assert.equal(document.querySelector("#qa-part-select option")?.textContent, "Todas las partes");
    assert.equal(document.querySelector(".journey-row")?.getAttribute("lang"), "es");
    assert.equal(document.querySelector("#qa-part-select")?.getAttribute("aria-describedby"), "qa-part-role");
    assert.equal(document.querySelector("#qa-part-role")?.textContent.includes("Responsabilidades del rol"), true);
    assert.equal(document.querySelector("#qa-part-role")?.textContent.includes("Responsable del protocolo"), true);
    assert.equal(document.querySelector("#qa-part-role")?.textContent.includes("miembro del Garden"), true);
    assert.deepEqual(
      [...document.querySelectorAll(".rid b")].map((node) => node.textContent),
      ["ADM-001", "PWA-001", "ADM-002"],
      "journey steps did not override catalog/surface order",
    );
    assert.equal(document.querySelector(".scen")?.textContent.includes("Primero en español"), true);
    assert.equal(document.querySelector(".scen")?.textContent.includes("Primer resultado"), true);
    assert.equal(document.querySelector(".scen")?.getAttribute("lang"), "es");
    const firstJourneyPrerequisites = document.querySelector(".journey-prerequisites");
    assert.equal(firstJourneyPrerequisites?.textContent.includes("Antes de empezar"), true);
    assert.equal(firstJourneyPrerequisites?.textContent.includes("Rol requerido: Steward"), true);
    assert.deepEqual(
      [...firstJourneyPrerequisites.querySelectorAll(".journey-preconditions li")].map((node) => node.textContent),
      ["Primera condición", "El ciclo compartido está visible"],
    );
    const firstJourneySteps = document.querySelector(".journey-steps");
    assert.equal(firstJourneySteps?.tagName, "OL");
    assert.ok(
      firstJourneyPrerequisites.compareDocumentPosition(firstJourneySteps)
        & dom.window.Node.DOCUMENT_POSITION_FOLLOWING,
      "the prerequisites must appear before authored actions",
    );
    assert.deepEqual(
      [...firstJourneySteps.querySelectorAll("li")].map((node) => node.textContent),
      ["Primer paso", "Segundo paso detallado"],
    );
    assert.deepEqual(
      [...document.querySelectorAll("h2.area")].map((node) => node.textContent),
      ["Preparar · 1", "Entregar · 2"],
    );
    assert.equal(document.querySelector(".known-gate")?.textContent.includes("La liquidación no está habilitada"), true);
    assert.equal(document.querySelector(".journey-handoff")?.textContent.includes("Espera a que la persona revisora"), true);
    assert.equal([...timers.values()].filter((timer) => timer.delay === 900).length, 0);
    assert.equal(posts.length, 0, "rendering a known gate must not write a Blocked verdict");

    const initialJourneySelect = document.querySelector("#qa-journey-select");
    initialJourneySelect.focus();
    initialJourneySelect.value = "treasury";
    initialJourneySelect.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
    assert.equal(document.activeElement?.id, "qa-journey-select");
    assert.deepEqual([...document.querySelectorAll(".rid b")].map((node) => node.textContent), ["ADM-002"]);

    const treasuryJourneySelect = document.querySelector("#qa-journey-select");
    treasuryJourneySelect.value = "relay";
    treasuryJourneySelect.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
    assert.equal(document.activeElement?.id, "qa-journey-select");

    const viewSelect = document.querySelector("#qa-view-select");
    viewSelect.value = "Tester A";
    viewSelect.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
    const gatedRow = [...document.querySelectorAll(".row")].find((row) =>
      row.querySelector(".rid b")?.textContent === "PWA-001"
    );
    assert.equal(gatedRow?.querySelectorAll("button.st").length, 4);
    assert.equal(gatedRow?.querySelectorAll('button.st[aria-pressed="true"]').length, 0);
    gatedRow?.querySelector('[data-s="blocked"]')?.click();
    assert.equal(
      document.querySelector('[data-id="PWA-001"][data-s="blocked"]')?.getAttribute("aria-pressed"),
      "true",
    );
    await runTimer(900);
    assert.deepEqual(posts[0]?.entries, { "PWA-001": { s: "blocked" } });

    const part = document.querySelector("#qa-part-select");
    part.focus();
    part.value = "review";
    part.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
    assert.equal(document.activeElement?.id, "qa-part-select");
    assert.equal(document.querySelector("#qa-part-role")?.textContent.includes("Responsable del protocolo"), true);
    assert.equal(document.querySelector("#qa-part-role")?.textContent.includes("miembro del Garden"), false);
    assert.deepEqual(
      [...document.querySelectorAll(".rid b")].map((node) => node.textContent),
      ["ADM-001", "PWA-001"],
    );
    const roleText = [...document.querySelectorAll(".journey-meta")].map((node) => node.textContent);
    assert.equal(roleText[0].includes("ActuarProtocolo y revisión"), true);
    assert.equal(roleText[1].includes("VerificarProtocolo y revisión"), true);
    assert.equal(JSON.parse(dom.window.sessionStorage.getItem("qa-view")).part, "review");

    const locale = document.querySelector("#qa-locale-select");
    locale.focus();
    locale.value = "pt";
    locale.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
    assert.equal(document.activeElement?.id, "qa-locale-select");
    assert.equal(document.querySelector(".journey-row")?.getAttribute("lang"), "pt");
    assert.equal(document.querySelector('label[for="qa-journey-select"]')?.textContent.includes("Jornada"), true);
    assert.equal(document.querySelector(".scen")?.textContent.includes("Primeiro em português"), true);
    assert.equal(document.querySelector(".scen")?.textContent.includes("Primeiro resultado"), true);
    assert.equal(document.querySelector(".scen")?.getAttribute("lang"), "pt");
    assert.equal(document.querySelector(".journey-prerequisites")?.textContent.includes("Antes de começar"), true);
    assert.equal(document.querySelector(".journey-preconditions")?.textContent.includes("Primeira condição"), true);
    assert.equal(dom.window.localStorage.getItem("qa-locale"), "pt");

    const mobileRules = [...document.styleSheets[0].cssRules]
      .filter((rule) => rule.conditionText === "(max-width:720px)")
      .flatMap((rule) => [...rule.cssRules]);
    const mobileVerdicts = mobileRules.find((rule) => rule.selectorText === ".st");
    const mobileSavebar = mobileRules.find((rule) => rule.selectorText === ".savebar");
    assert.equal(mobileVerdicts.style.width, "44px");
    assert.equal(mobileVerdicts.style.height, "44px");
    assert.equal(mobileSavebar.style.position, "static");

    document.querySelector('[data-f="issues"]')?.click();
    assert.deepEqual([...document.querySelectorAll(".rid b")].map((node) => node.textContent), ["PWA-001"]);
    document.querySelector('[data-f="open"]')?.click();
    assert.deepEqual([...document.querySelectorAll(".rid b")].map((node) => node.textContent), ["ADM-001"]);
    document.querySelector('[data-f="all"]')?.click();
    document.querySelector('[data-tab="Admin Dashboard"]')?.click();
    assert.deepEqual([...document.querySelectorAll(".rid b")].map((node) => node.textContent), ["ADM-001"]);
    assert.equal([...timers.values()].filter((timer) => timer.delay === 900).length, 0);
    assert.equal(posts.length, 1, "filtering journey rows must remain read-only");

    document.querySelector('[data-sort="walk"]')?.click();
    assert.equal(document.querySelector("#qa-journey-select"), null);
    assert.equal(document.querySelector(".journey-prerequisites"), null);
    assert.equal(document.querySelector(".journey-steps"), null);
    assert.equal(document.querySelector(".scen")?.textContent.includes("Third"), true);
    assert.equal(document.querySelector(".scen")?.textContent.includes("Terceiro em português"), false);
    assert.deepEqual(
      [...document.querySelectorAll(".rid b")].map((node) => node.textContent),
      ["ADM-002", "ADM-001"],
      "Walk should keep the selected tab's catalog order",
    );
    document.querySelector('[data-sort="priority"]')?.click();
    assert.deepEqual(
      [...document.querySelectorAll("h2.area")].map((node) => node.textContent),
      ["P0 · 1", "P1 · 1"],
      "Priority should keep its severity bands",
    );
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

  it("surfaces expiry and will not move unsaved work to a switched wallet", () => {
    execFileSync(
      "node",
      [
        "scripts/dev/node-cli.js",
        "node",
        "--input-type=module",
        "--eval",
        `await (${authRecoveryHarness.toString()})()`,
      ],
      { cwd: repoRoot, stdio: "pipe" },
    );
  }, JSDOM_SUBPROCESS_TIMEOUT_MS);

  it("keeps mutable and prototype-shaped display labels presentation-only", () => {
    execFileSync(
      "node",
      [
        "scripts/dev/node-cli.js",
        "node",
        "--input-type=module",
        "--eval",
        `await (${displayLabelHarness.toString()})()`,
      ],
      { cwd: repoRoot, stdio: "pipe" },
    );
  }, JSDOM_SUBPROCESS_TIMEOUT_MS);

  it("orders a cross-surface journey, restores its view, and separates Act from Verify", () => {
    execFileSync(
      "node",
      [
        "scripts/dev/node-cli.js",
        "node",
        "--input-type=module",
        "--eval",
        `await (${journeyModeHarness.toString()})()`,
      ],
      { cwd: repoRoot, stdio: "pipe" },
    );
  }, JSDOM_SUBPROCESS_TIMEOUT_MS);
});
