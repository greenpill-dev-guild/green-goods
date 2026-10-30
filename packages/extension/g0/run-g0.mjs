/* oxlint-disable no-console -- a CLI rig prints its own progress */
// The G0 rig: drives the built extension in Brave Beta over CDP and writes an observation sheet.
//   node g0/run-g0.mjs [--fresh] [--only lifecycle,webmcp,model,pi] [--headed] [--passes N]
// Build first: bun run build (output in .output/chrome-mv3). Never points at a real profile.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { cpus, totalmem, release } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { BRAVE_BETA, launchBrowser, waitForTarget } from "./cdp.mjs";
import { startMemorySampler } from "./memory-sampler.mjs";
import { servePage } from "./serve-page.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const packageDir = resolve(here, "..");
const extensionDir = join(packageDir, ".output", "chrome-mv3");
const outDir = join(here, "out");
const args = new Set(process.argv.slice(2));
const option = (name, fallback) => {
  const index = process.argv.indexOf(name);
  return index === -1 ? fallback : process.argv[index + 1];
};
const only = new Set((option("--only", "lifecycle,webmcp,model,pi")).split(","));
const headed = args.has("--headed");
const fresh = args.has("--fresh");
const passes = Number(option("--passes", "2"));
mkdirSync(outDir, { recursive: true });
const logFile = join(outDir, "run.log");
const log = (line) => {
  const stamped = `${new Date().toISOString()} ${line}`;
  console.log(stamped);
  writeFileSync(logFile, `${stamped}\n`, { flag: "a" });
};
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const observations = { startedAt: new Date().toISOString(), headed, results: {}, failures: [] };

function preflight() {
  if (!existsSync(join(extensionDir, "manifest.json"))) throw new Error(`no build at ${extensionDir}; run bun run build first`);
  const version = execFileSync(BRAVE_BETA, ["--version"], { encoding: "utf8" }).trim();
  const manifest = JSON.parse(readFileSync(join(extensionDir, "manifest.json"), "utf8"));
  const read = (name) => JSON.parse(readFileSync(join(packageDir, "node_modules", name, "package.json"), "utf8")).version;
  observations.environment = {
    brave: version,
    braveExecutable: BRAVE_BETA,
    flags: ["--headless (unless --headed)", "--enable-blink-features=WebMCP", "--user-data-dir=<scratch>", "--remote-debugging-port=0", "--no-first-run", "--load-extension=<.output/chrome-mv3>"],
    macOS: execFileSync("sw_vers", ["-productVersion"], { encoding: "utf8" }).trim(),
    darwin: release(),
    cpu: cpus()[0]?.model,
    cores: cpus().length,
    totalMemoryBytes: totalmem(),
    manifestVersion: manifest.manifest_version,
    extensionName: manifest.name,
    packages: {
      "@earendil-works/pi-durable": read("@earendil-works/pi-durable"),
      "@earendil-works/chord": read("@earendil-works/chord"),
      "@earendil-works/pi-ai": read("@earendil-works/pi-ai"),
      "@huggingface/transformers": read("@huggingface/transformers"),
      sigma: read("sigma"),
      graphology: read("graphology"),
      wxt: read("wxt"),
    },
    gitHead: execFileSync("git", ["rev-parse", "HEAD"], { cwd: packageDir, encoding: "utf8" }).trim(),
  };
  log(`preflight ok: ${version}`);
}

async function launch(profileName, { flag = true, extension = true, freshProfile = false } = {}) {
  const userDataDir = join(outDir, "profiles", profileName);
  const browser = await launchBrowser({
    userDataDir,
    headless: !headed,
    fresh: freshProfile || fresh || !existsSync(userDataDir),
    extensions: extension ? [extensionDir] : [],
    args: [...(flag ? ["--enable-blink-features=WebMCP"] : []), "--window-size=1200,800"],
    logFile: join(outDir, `${profileName}.browser.log`),
  });
  log(`launched ${profileName} on port ${browser.port}`);
  const launched = { ...browser, userDataDir, extensionId: null };
  // The MV3 worker stops after 30 s idle, so remember the id while it is still running.
  if (extension) launched.extensionId = (await extensionId(launched)).id;
  return launched;
}

async function extensionId(browser, previousTargetId = null, timeoutMs = 15000) {
  const target = await waitForTarget(
    browser.cdp,
    (t) => t.type === "service_worker" && t.url.startsWith("chrome-extension://") && t.targetId !== previousTargetId,
    timeoutMs,
  );
  if (!target) throw new Error("extension service worker target not found");
  return { id: new URL(target.url).host, targetId: target.targetId };
}

// Right after a reload the extension's files can be briefly unavailable and the tab lands on an
// error page; navigate again instead of waiting for a page that will never run.
async function openGraph(browser, id) {
  const url = `chrome-extension://${id}/graph.html`;
  const page = await browser.cdp.openPage(url);
  const started = Date.now();
  let lastHref = null;
  while (Date.now() - started < 30000) {
    await browser.cdp.waitForLoad(page.sessionId);
    lastHref = await browser.cdp.evaluate(page.sessionId, "location.href");
    if (lastHref !== url) {
      await sleep(500);
      await browser.cdp.send("Page.navigate", { url }, page.sessionId);
      continue;
    }
    const ready = await browser.cdp.evaluate(page.sessionId, "Boolean(window.__g0 && window.__g0.ready)");
    if (ready) return page;
    await sleep(100);
  }
  throw new Error(`graph page did not expose window.__g0 (at ${lastHref}); console: ${browser.cdp.logs(page.sessionId).join(" | ")}`);
}

// chrome://extensions exposes developerPrivate, the API behind the page's own Developer mode
// toggle and Reload button. Driving it over CDP is the headless equivalent of a person clicking.
async function extensionsPage(browser) {
  const page = await browser.cdp.openPage("chrome://extensions/");
  await browser.cdp.waitForLoad(page.sessionId);
  await sleep(500);
  // Values travel as protocol arguments; the functions below run in the page and must not close
  // over anything here.
  const call = (fn, ...args) => browser.cdp.callFunction(page.sessionId, fn, args);
  return {
    page,
    developerMode: (enabled) =>
      call(
        (on) =>
          new Promise((resolve) => {
            const api = globalThis.chrome.developerPrivate;
            api.updateProfileConfiguration({ inDeveloperMode: on }, () => api.getProfileConfiguration(resolve));
          }),
        enabled,
      ),
    info: (id) =>
      call(
        (extensionId) =>
          new Promise((resolve) => {
            globalThis.chrome.developerPrivate.getExtensionInfo(extensionId, (info) =>
              resolve(
                info
                  ? {
                      state: info.state,
                      location: info.location,
                      disableReasons: Object.entries(info.disableReasons)
                        .filter(([, value]) => value)
                        .map(([key]) => key),
                    }
                  : null,
              ),
            );
          }),
        id,
      ),
    reload: (id) =>
      call(
        (extensionId) =>
          new Promise((resolve) => {
            const { chrome } = globalThis;
            chrome.developerPrivate.reload(extensionId, { failQuietly: true }, () =>
              resolve(chrome.runtime.lastError ? chrome.runtime.lastError.message : null),
            );
          }),
        id,
      ),
  };
}

async function reloadAndObserve(browser, extensions, id, previousTargetId, how) {
  if (how === "chrome.runtime.reload") {
    const page = await openGraph(browser, id);
    // The page dies with the reload, so the evaluate is not awaited.
    browser.cdp.evaluate(page.sessionId, "chrome.runtime.reload(); true").catch(() => undefined);
  } else {
    await extensions.reload(id);
  }
  const target = await waitForTarget(
    browser.cdp,
    (t) => t.type === "service_worker" && t.url.includes(id) && t.targetId !== previousTargetId,
    10000,
  );
  if (target) await sleep(1000);
  let graphReady = false;
  let runtimeId = null;
  if (target) {
    const page = await openGraph(browser, id);
    runtimeId = await browser.cdp.evaluate(page.sessionId, "window.__g0.runtimeId");
    graphReady = true;
    await browser.cdp.closeTarget(page.targetId);
  }
  const info = await extensions.info(id);
  log(`reload via ${how}: worker ${target ? "restarted" : "absent"}, state ${info?.state}, reasons ${JSON.stringify(info?.disableReasons)}`);
  return { how, workerRestarted: Boolean(target), newTargetId: target?.targetId ?? null, graphReady, runtimeId, sameId: runtimeId === id, info };
}

async function lifecycle(browser) {
  const first = await extensionId(browser);
  const page = await openGraph(browser, first.id);
  const graph = await browser.cdp.evaluate(page.sessionId, "window.__g0.graph");
  const runtimeId = await browser.cdp.evaluate(page.sessionId, "window.__g0.runtimeId");
  const environment = await browser.cdp.evaluate(page.sessionId, "window.__g0.environment()");
  log(`graph: ${JSON.stringify(graph)} runtime ${runtimeId}`);
  await browser.cdp.closeTarget(page.targetId);
  const extensions = await extensionsPage(browser);
  const installed = await extensions.info(first.id);
  const developerModeOff = await reloadAndObserve(browser, extensions, first.id, first.targetId, "chrome.runtime.reload");
  const profile = await extensions.developerMode(true);
  const reloadButton = await reloadAndObserve(browser, extensions, first.id, developerModeOff.newTargetId ?? first.targetId, "developerPrivate.reload");
  const runtimeReload = await reloadAndObserve(browser, extensions, first.id, reloadButton.newTargetId ?? first.targetId, "chrome.runtime.reload");
  await browser.cdp.closeTarget(extensions.page.targetId);
  return {
    graph,
    environment,
    runtimeId,
    installed,
    reloads: { developerModeOff, developerModeOn: profile.inDeveloperMode, reloadButton, runtimeReload },
  };
}

async function webmcp(browser, label) {
  const { server, url } = await servePage();
  try {
    const page = await browser.cdp.openPage(url);
    await browser.cdp.waitForLoad(page.sessionId);
    const started = Date.now();
    let data = {};
    while (Date.now() - started < 12000) {
      data = await browser.cdp.evaluate(page.sessionId, "({ page: document.documentElement.dataset.g0Page ?? null, isolated: document.documentElement.dataset.g0Isolated ?? null, main: document.documentElement.dataset.g0Main ?? null })");
      if (data.page && data.isolated && data.main) break;
      await sleep(200);
    }
    const parse = (value) => (value ? JSON.parse(value) : null);
    const result = { label, url, page: parse(data.page), isolated: parse(data.isolated), main: parse(data.main), waitedMs: Date.now() - started };
    log(`webmcp ${label}: page=${result.page?.registered} isolated=${result.isolated?.modelContextType}/${result.isolated?.tools?.length ?? "-"} main=${result.main?.modelContextType}/${result.main?.tools?.length ?? "-"}`);
    await browser.cdp.closeTarget(page.targetId);
    return result;
  } finally {
    server.close();
  }
}

async function modelRun(browser, id, label) {
  const page = await openGraph(browser, id);
  const sampler = startMemorySampler(browser.userDataDir, 500);
  const started = Date.now();
  let run;
  let error = null;
  try {
    run = await browser.cdp.callFunction(page.sessionId, (count) => globalThis.__g0.model.run({ passes: count }), [passes]);
  } catch (caught) {
    error = String(caught.message ?? caught);
  }
  const wallMs = Date.now() - started;
  const memory = sampler.stop();
  const consoleTail = browser.cdp.logs(page.sessionId).slice(-30);
  await browser.cdp.closeTarget(page.targetId);
  const summary = run
    ? `load ${Math.round(run.load.loadMs)} ms; ${run.passes.map((pass) => `${pass.newTokens} tok @ ${pass.tokensPerSecond.toFixed(1)} tok/s, prefill ${Math.round(pass.prefillMs)} ms, accepted ${pass.validation.accepted.length}`).join(" | ")}`
    : `failed: ${error}`;
  log(`model ${label}: ${summary}; peak RSS ${(memory.peaks.total / 1073741824).toFixed(2)} GiB`);
  return { label, wallMs, run, error, memory, consoleTail };
}

async function pi(browser, id) {
  const page = await openGraph(browser, id);
  const resume = await browser.cdp.evaluate(page.sessionId, "window.__g0.pi.resumeDemo()", { timeoutMs: 120000 });
  log(`pi resume: ${resume.outcome.status}; chunks ${resume.events.filter((e) => e.kind === "chunk").map((e) => `${e.harness}:${e.chunk}`).join(",")}`);
  const crash = await browser.cdp.evaluate(page.sessionId, "window.__g0.pi.crashAfterApplyDemo()", { timeoutMs: 120000 });
  log(`pi crash-after-apply: ${crash.outcome.status}; effects ${crash.effectCount}; replayed ${crash.outcome.result?.replayedReceipt}`);
  await browser.cdp.closeTarget(page.targetId);
  return { resume, crashAfterApply: crash };
}

async function step(name, fn) {
  if (!only.has(name)) return;
  try {
    observations.results[name] = await fn();
  } catch (error) {
    log(`${name} FAILED: ${error.stack ?? error}`);
    observations.failures.push({ step: name, error: String(error.stack ?? error) });
  }
}

preflight();
// Fresh profiles for the lifecycle and WebMCP probes; "main" persists so the model cache survives
// between runs and gives the warm-load number.
await step("lifecycle", async () => {
  const browser = await launch("lifecycle", { freshProfile: true });
  try {
    const result = await lifecycle(browser);
    const before = browser.extensionId;
    await browser.kill();
    const again = await launch("lifecycle");
    try {
      const after = again.extensionId;
      const info = await (await extensionsPage(again)).info(after);
      log(`browser restart: ${before} -> ${after} (${info?.state})`);
      return { ...result, browserRestart: { idBefore: before, idAfter: after, sameId: before === after, info } };
    } finally {
      await again.kill();
    }
  } finally {
    await browser.kill().catch(() => undefined);
  }
});
await step("webmcp", async () => {
  const flagged = await launch("webmcp", { freshProfile: true });
  let withFlag;
  try {
    withFlag = await webmcp(flagged, `${headed ? "headed" : "headless"}, --enable-blink-features=WebMCP`);
  } finally {
    await flagged.kill();
  }
  const control = await launch("no-flag", { flag: false, freshProfile: true });
  try {
    return { withFlag, withoutFlag: await webmcp(control, `${headed ? "headed" : "headless"}, no WebMCP flag (control)`) };
  } finally {
    await control.kill();
  }
});
if (only.has("model") || only.has("pi")) {
  const main = await launch("main");
  try {
    await step("model", async () => {
      const cold = await modelRun(main, main.extensionId, "cold (first load in this profile)");
      const warm = await modelRun(main, main.extensionId, "warm (page reloaded, model cached)");
      return { cold, warm };
    });
    await step("pi", async () => pi(main, main.extensionId));
  } finally {
    await main.kill().catch(() => undefined);
  }
}
observations.finishedAt = new Date().toISOString();
const stamped = join(outDir, `observations-${[...only].join("-")}-${observations.startedAt.replace(/[:.]/g, "-")}.json`);
writeFileSync(stamped, JSON.stringify(observations, null, 2));
writeFileSync(join(outDir, "observations.json"), JSON.stringify(observations, null, 2));
log(`wrote ${stamped}; failures: ${observations.failures.length}`);
