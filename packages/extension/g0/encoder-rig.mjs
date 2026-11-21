/* oxlint-disable no-console -- a CLI rig prints its own progress */
// The encoder item of the G0 rig: nomic-embed-text-v1.5 (quantized) on WebAssembly and WebGPU, an
// offline rerun with every network request blocked and recorded, a constrained WebAssembly pass and
// a Node sanity check over the same model files. Every text it embeds is synthetic.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { loadavg } from "node:os";
import { dirname, join } from "node:path";
import { startMemorySampler } from "./memory-sampler.mjs";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const NETWORK_SCHEME = /^(https?|wss?):/i;
const MODEL_ID = "nomic-ai/nomic-embed-text-v1.5";
const PROBE_URL = `https://huggingface.co/api/models/${MODEL_ID}`;
// A page call that has not answered by its deadline fails the phase, and the target is closed.
const CALL_TIMEOUT_MS = 2 * 60 * 1000;
const RUN_TIMEOUT_MS = 30 * 60 * 1000;
// The process fallback must reach this share of the requested slowdown, or the phase fails.
const THROTTLE_TOLERANCE = 0.75;

// Auto-attaches to the page's workers (and their nested workers) before they run, enables Network
// on every session to record what each one requests, and can throttle or cut the network.
function instrument(cdp, pageSessionId) {
  const sessions = new Map([[pageSessionId, { type: "page", url: "" }]]);
  const requests = [];
  const failures = [];
  const finished = new Map();
  let offline = false;
  let throttleRate = 1;
  const throttleResults = [];

  const prepare = async (sessionId) => {
    await cdp.send("Network.enable", {}, sessionId).catch(() => undefined);
    if (offline) await cdp.send("Network.emulateNetworkConditions", { offline: true, latency: 0, downloadThroughput: -1, uploadThroughput: -1 }, sessionId).catch(() => undefined);
    if (throttleRate !== 1) {
      const result = await cdp.send("Emulation.setCPUThrottlingRate", { rate: throttleRate }, sessionId).then(() => "ok", (error) => String(error.message));
      throttleResults.push({ session: sessions.get(sessionId)?.type, result });
    }
    await cdp.send("Target.setAutoAttach", { autoAttach: true, waitForDebuggerOnStart: true, flatten: true }, sessionId).catch(() => undefined);
  };

  const off = cdp.on(async (message) => {
    const { method, params, sessionId } = message;
    if (method === "Target.attachedToTarget" && sessions.has(sessionId)) {
      const child = params.sessionId;
      sessions.set(child, { type: params.targetInfo.type, url: params.targetInfo.url });
      await prepare(child);
      await cdp.send("Runtime.runIfWaitingForDebugger", {}, child).catch(() => undefined);
      return;
    }
    if (!sessions.has(sessionId)) return;
    if (method === "Network.requestWillBeSent") {
      requests.push({ session: sessions.get(sessionId)?.type, requestId: params.requestId, url: params.request.url, network: NETWORK_SCHEME.test(params.request.url), type: params.type ?? null });
    } else if (method === "Network.loadingFinished") {
      finished.set(params.requestId, params.encodedDataLength);
    } else if (method === "Network.loadingFailed") {
      failures.push({ requestId: params.requestId, errorText: params.errorText, blockedReason: params.blockedReason ?? null });
    }
  });

  return {
    async start({ goOffline = false } = {}) {
      offline = goOffline;
      await prepare(pageSessionId);
    },
    // Applies the rate to every session attached so far and to every later one.
    async throttle(rate) {
      throttleRate = rate;
      for (const [sessionId, session] of sessions) {
        const result = await cdp.send("Emulation.setCPUThrottlingRate", { rate }, sessionId).then(() => "ok", (error) => String(error.message));
        throttleResults.push({ session: session.type, result });
      }
    },
    report() {
      const network = requests.filter((request) => request.network);
      return {
        sessions: [...sessions.values()].map((session) => session.type),
        requestsTotal: requests.length,
        networkRequests: network.map((request) => ({ ...request, encodedDataLength: finished.get(request.requestId) ?? null, failed: failures.find((failure) => failure.requestId === request.requestId) ?? null })),
        // A redirect repeats requestWillBeSent under one request id, so bytes count once per id.
        networkBytes: [...new Set(network.map((request) => request.requestId))].reduce((sum, requestId) => sum + (finished.get(requestId) ?? 0), 0),
        nonNetworkRequests: requests.filter((request) => !request.network).map((request) => request.url.replace(/^chrome-extension:\/\/[a-z]+/, "chrome-extension://<id>")),
        throttleResults,
      };
    },
    stop: off,
  };
}

// A process-level CPU throttle: the extension renderer (every thread in it, the encoder worker and
// the ONNX runtime's thread pool included) runs for 1/rate of each period and is stopped for the
// rest with SIGSTOP and SIGCONT. Used only when DevTools throttling does not reach the worker.
function extensionRendererPids(userDataDir) {
  const out = execFileSync("ps", ["-axo", "pid=,args="], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  return out
    .split("\n")
    .filter((line) => line.includes(userDataDir) && line.includes("--type=renderer") && line.includes("--extension-process"))
    .map((line) => Number(line.trim().split(/\s+/)[0]))
    .filter(Number.isInteger);
}

function startDutyCycle(pids, rate, periodMs = 40) {
  const runMs = periodMs / rate;
  let active = true;
  let cycles = 0;
  const signal = (name) => {
    for (const pid of pids) {
      try {
        process.kill(pid, name);
      } catch {
        // the process has gone; the next cycle tries again and stop() always resumes
      }
    }
  };
  const loop = () => {
    if (!active) return;
    signal("SIGSTOP");
    setTimeout(() => {
      signal("SIGCONT");
      cycles += 1;
      if (active) setTimeout(loop, runMs);
    }, periodMs - runMs);
  };
  // A rig that exits or is interrupted mid-phase must never leave the renderer stopped.
  const resume = () => signal("SIGCONT");
  const interrupted = () => {
    resume();
    process.exit(130);
  };
  process.on("exit", resume);
  process.once("SIGINT", interrupted);
  loop();
  return {
    pids,
    rate,
    periodMs,
    stop() {
      active = false;
      resume();
      process.off("exit", resume);
      process.off("SIGINT", interrupted);
      return { pids, rate, periodMs, runMs, cycles };
    },
  };
}

// Brave-wide interception on the browser session as a second meter: every paused request is
// recorded, network schemes are failed, anything else continues.
async function interceptAll(cdp) {
  const paused = [];
  const off = cdp.on((message) => {
    if (message.method !== "Fetch.requestPaused" || message.sessionId) return;
    const { requestId, request, resourceType } = message.params;
    paused.push({ url: request.url, resourceType });
    const call = NETWORK_SCHEME.test(request.url)
      ? cdp.send("Fetch.failRequest", { requestId, errorReason: "InternetDisconnected" })
      : cdp.send("Fetch.continueRequest", { requestId });
    call.catch(() => undefined);
  });
  const enabled = await cdp.send("Fetch.enable", { patterns: [{ urlPattern: "*" }] }).then(() => "browser-level Fetch.enable ok", (error) => `browser-level Fetch.enable failed: ${error.message}`);
  return {
    enabled,
    paused,
    async stop() {
      off();
      await cdp.send("Fetch.disable").catch(() => undefined);
    },
  };
}

async function openEncoderPage(browser, id) {
  const url = `chrome-extension://${id}/encoder.html`;
  const { targetId } = await browser.cdp.send("Target.createTarget", { url: "about:blank" });
  const sessionId = await browser.cdp.attach(targetId);
  await browser.cdp.send("Page.enable", {}, sessionId);
  return { targetId, sessionId, url };
}

async function navigateAndWait(browser, page) {
  const started = Date.now();
  await browser.cdp.send("Page.navigate", { url: page.url }, page.sessionId);
  while (Date.now() - started < 30000) {
    const ready = await browser.cdp.evaluate(page.sessionId, "Boolean(window.__encoder && window.__encoder.ready)").catch(() => false);
    if (ready) return;
    await sleep(100);
  }
  throw new Error(`encoder page did not become ready; console: ${browser.cdp.logs(page.sessionId).join(" | ")}`);
}

const call = (browser, page, fn, args = [], timeoutMs = CALL_TIMEOUT_MS) => browser.cdp.callFunction(page.sessionId, fn, args, { timeoutMs });

async function encoderRun(browser, label, options, { goOffline = false, cpuThrottleRate = 1, calibrate = false } = {}) {
  const page = await openEncoderPage(browser, browser.extensionId);
  const meter = instrument(browser.cdp, page.sessionId);
  await meter.start({ goOffline });
  const interception = goOffline ? await interceptAll(browser.cdp) : null;
  const sampler = startMemorySampler(browser.userDataDir, 250);
  const loadAverage = loadavg();
  let run = null;
  let error = null;
  let calibration = null;
  let probes = null;
  let dutyCycle = null;
  const started = Date.now();
  try {
    await navigateAndWait(browser, page);
    if (calibrate || cpuThrottleRate !== 1) {
      // The worker exists after the first busy call. Measure it, throttle every session over DevTools
      // and measure again; if the worker did not slow down, duty-cycle the renderer process instead.
      const busy = () => call(browser, page, (ms) => globalThis.__encoder.busy(ms), [2000]);
      const before = await busy();
      await meter.throttle(cpuThrottleRate);
      const devtools = await busy();
      calibration = {
        rate: cpuThrottleRate,
        workerIterationsUnthrottled: before.iterations,
        devtools: { iterations: devtools.iterations, observedSlowdown: before.iterations / Math.max(devtools.iterations, 1) },
        mechanism: "devtools",
      };
      if (calibration.devtools.observedSlowdown < cpuThrottleRate * THROTTLE_TOLERANCE) {
        await meter.throttle(1);
        const pids = extensionRendererPids(browser.userDataDir);
        calibration.mechanism = "process duty cycle (SIGSTOP/SIGCONT)";
        if (pids.length === 0) throw new Error("throttle: no extension renderer process found to duty-cycle");
        dutyCycle = startDutyCycle(pids, cpuThrottleRate);
        const process = await busy();
        calibration.process = { pids, iterations: process.iterations, observedSlowdown: before.iterations / Math.max(process.iterations, 1) };
      }
      const achieved = calibration.process?.observedSlowdown ?? calibration.devtools.observedSlowdown;
      calibration.tolerance = THROTTLE_TOLERANCE;
      console.log(`  calibration: ${JSON.stringify(calibration)}`);
      if (achieved < cpuThrottleRate * THROTTLE_TOLERANCE) {
        throw new Error(`throttle: observed ${achieved.toFixed(2)}x, below ${THROTTLE_TOLERANCE} of the requested ${cpuThrottleRate}x`);
      }
    }
    run = await call(browser, page, (opts) => globalThis.__encoder.run(opts), [options], RUN_TIMEOUT_MS);
    if (goOffline) {
      const duringRun = meter.report();
      const pausedDuringRun = interception.paused.length;
      // Positive controls: a deliberate request from the worker and from the page must be seen and fail.
      const worker = await call(browser, page, (url) => globalThis.__encoder.probeWorkerFetch(url), [PROBE_URL]);
      const pageProbe = await call(browser, page, (url) => globalThis.__encoder.probePageFetch(url), [PROBE_URL]);
      await sleep(300);
      const afterProbes = meter.report();
      probes = {
        duringRun: { networkRequests: duringRun.networkRequests.length, browserInterceptedRequests: pausedDuringRun },
        control: {
          worker,
          page: pageProbe,
          networkRequestsSeenByMeter: afterProbes.networkRequests.length - duringRun.networkRequests.length,
          browserInterceptedRequests: interception.paused.length - pausedDuringRun,
        },
        browserInterception: interception.enabled,
        intercepted: interception.paused,
      };
    }
  } catch (caught) {
    error = String(caught.stack ?? caught.message ?? caught);
  }
  const dutyCycleReport = dutyCycle ? dutyCycle.stop() : null;
  if (calibration) calibration.dutyCycle = dutyCycleReport;
  const wallMs = Date.now() - started;
  const memory = sampler.stop();
  const network = meter.report();
  meter.stop();
  if (interception) await interception.stop();
  const consoleTail = browser.cdp.logs(page.sessionId).slice(-20);
  await browser.cdp.closeTarget(page.targetId).catch(() => undefined);
  const pass = run?.passes?.at(-1);
  console.log(
    `  ${label}: ${run ? `load ${Math.round(run.load.loadMs)} ms, rank ${Math.round(pass.totalRankMs)} ms, top-1 kw/enc/both ${pass.keyword.top1}/${pass.encoder.top1}/${pass.combined.top1}` : `failed: ${error}`}; ` +
      `network requests ${network.networkRequests.length}; peak extension renderer ${((memory.peaks["renderer-extension"] ?? 0) / 1048576).toFixed(0)} MiB`,
  );
  return { label, options, goOffline, cpuThrottleRate, loadAverage, wallMs, run, error, calibration, probes, network, memory, consoleTail };
}

// Copies the cached model files out of the profile's Cache Storage into g0/out for the Node check.
async function exportModelFiles(browser, modelDir) {
  const page = await openEncoderPage(browser, browser.extensionId);
  try {
    await navigateAndWait(browser, page);
    const entries = await call(browser, page, () => globalThis.__encoder.cacheEntries());
    const files = [];
    for (const entry of entries.filter((item) => item.url.includes(`/${MODEL_ID}/resolve/`))) {
      const relative = entry.url.split("/resolve/")[1].split("/").slice(1).join("/");
      const chunks = [];
      const chunkBytes = 8 * 1024 * 1024;
      for (let offset = 0; offset < entry.bytes; offset += chunkBytes) {
        const { base64 } = await call(browser, page, (url, at, length) => globalThis.__encoder.readCached(url, at, length), [entry.url, offset, chunkBytes]);
        chunks.push(Buffer.from(base64, "base64"));
      }
      const bytes = Buffer.concat(chunks);
      const target = join(modelDir, MODEL_ID, relative);
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, bytes);
      files.push({ file: relative, url: entry.url, bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex"), headers: entry.headers });
    }
    return { entries, files };
  } finally {
    await browser.cdp.closeTarget(page.targetId).catch(() => undefined);
  }
}

// The installed version of a package Transformers.js depends on, read from its own package.json.
function installedVersion(name) {
  try {
    const transformers = createRequire(import.meta.url).resolve("@huggingface/transformers");
    let dir = dirname(createRequire(transformers).resolve(name));
    while (dir !== dirname(dir)) {
      const file = join(dir, "package.json");
      if (existsSync(file)) {
        const manifest = JSON.parse(readFileSync(file, "utf8"));
        if (manifest.name === name) return manifest.version;
      }
      dir = dirname(dir);
    }
  } catch {
    // reported as unknown below
  }
  return null;
}

const cosine = (a, b) => {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / Math.sqrt(na * nb);
};

// Embeds the five sanity texts in Node with onnxruntime-node over the exported files, with remote
// loading switched off, and compares each vector with the browser's.
async function nodeSanity(modelDir, fixture, browserRuns) {
  const transformers = await import("@huggingface/transformers");
  const { env, pipeline, layer_norm } = transformers;
  env.allowRemoteModels = false;
  env.allowLocalModels = true;
  env.localModelPath = `${modelDir}/`;
  env.useFSCache = false;
  const started = Date.now();
  const extractor = await pipeline("feature-extraction", MODEL_ID, { dtype: "q8", device: "cpu" });
  const loadMs = Date.now() - started;
  const prefix = { query: "search_query: ", document: "search_document: " };
  const texts = [
    ...fixture.sanitySample.queries.map((id) => ({ id, kind: "query", text: fixture.requirements.find((r) => r.id === id).text })),
    ...fixture.sanitySample.documents.map((id) => ({ id, kind: "document", text: fixture.sections.find((s) => s.id === id).text })),
  ];
  const vectors = [];
  for (const item of texts) {
    const pooled = await extractor(`${prefix[item.kind]}${item.text}`, { pooling: "mean" });
    const vector = layer_norm(pooled, [pooled.dims[1]]).slice(null, [0, 768]).normalize(2, -1);
    vectors.push({ ...item, vector: Array.from(vector.data) });
  }
  const comparisons = {};
  for (const [label, run] of Object.entries(browserRuns)) {
    if (!run?.sanity) continue;
    const browserVectors = [...run.sanity.queries, ...run.sanity.documents];
    comparisons[label] = vectors.map((item) => {
      const other = browserVectors.find((candidate) => candidate.id === item.id);
      return { id: item.id, kind: item.kind, cosine: other && other.vector.length ? cosine(item.vector, other.vector) : null };
    });
  }
  return {
    runtime: `onnxruntime-node ${installedVersion("onnxruntime-node") ?? "unknown"}`,
    nodeVersion: process.version,
    loadMs,
    comparisons,
  };
}

// Cosines between the browser's own sanity vectors: the two backends' warm runs, and each backend's
// cold run against its warm run.
function browserAgreement(backends) {
  const vectors = (run) => (run?.sanity ? [...run.sanity.queries, ...run.sanity.documents] : null);
  const compare = (first, second) => {
    const a = vectors(first);
    const b = vectors(second);
    if (!a || !b) return null;
    return a.map((item) => {
      const other = b.find((candidate) => candidate.id === item.id);
      return { id: item.id, cosine: other && other.vector.length ? cosine(item.vector, other.vector) : null };
    });
  };
  return {
    wasmWarmVsWebgpuWarm: compare(backends.wasm?.warm?.run, backends.webgpu?.warm?.run),
    wasmColdVsWarm: compare(backends.wasm?.cold?.run, backends.wasm?.warm?.run),
    webgpuColdVsWarm: compare(backends.webgpu?.cold?.run, backends.webgpu?.warm?.run),
  };
}

// Every phase error in the result, so the run's failure count includes them.
function phaseFailures(result) {
  const failures = [];
  for (const [device, runs] of Object.entries(result.backends)) {
    if (runs.error) failures.push({ phase: device, error: runs.error });
    for (const [phase, entry] of Object.entries(runs)) if (entry?.error) failures.push({ phase: `${device} ${phase}`, error: entry.error });
  }
  for (const [device, runs] of Object.entries(result.backends)) if (runs.revisionError) failures.push({ phase: `${device} revision`, error: runs.revisionError });
  if (result.node?.error) failures.push({ phase: "node", error: result.node.error });
  return failures;
}

export async function runEncoder({ launch, outDir, log, fixturePath, phases = null }) {
  const want = (name) => !phases || phases.has(name);
  const fixture = JSON.parse(readFileSync(fixturePath, "utf8"));
  const result = { model: MODEL_ID, dtype: "q8", fixture: { synthetic: fixture.synthetic, requirements: fixture.requirements.length, sections: fixture.sections.length }, backends: {} };
  const modelDir = join(outDir, "encoder-model");
  for (const device of ["wasm", "webgpu"]) {
    if (!want(device) && !(device === "wasm" && want("constrained"))) continue;
    // A run that includes this backend's cold phase starts from an empty profile so the first
    // download is measured; `--encoder-phases constrained` reuses the profile with the model cached.
    const browser = await launch(`encoder-${device}`, { freshProfile: want(device) });
    const runs = {};
    try {
      const page = await openEncoderPage(browser, browser.extensionId);
      await navigateAndWait(browser, page);
      runs.environment = await call(browser, page, () => globalThis.__encoder.environment());
      result.pinned ??= await call(browser, page, () => globalThis.__encoder.model);
      if (device === "wasm" && want("wasm")) result.hub = await call(browser, page, () => globalThis.__encoder.hubMetadata()).catch((error) => ({ error: String(error.message) }));
      await browser.cdp.closeTarget(page.targetId);
      if (!want(device)) {
        log("encoder wasm: constrained only (2 threads, 4x CPU throttling)");
        runs.constrained = await encoderRun(browser, "wasm constrained (2 threads, 4x throttle)", { device, numThreads: 2, passes: 1 }, { cpuThrottleRate: 4 });
        result.backends[device] = runs;
        continue;
      }
      log(`encoder ${device}: cold`);
      runs.cold = await encoderRun(browser, `${device} cold (first download)`, { device, passes: 2 });
      runs.cacheAfterCold = await (async () => {
        const probe = await openEncoderPage(browser, browser.extensionId);
        await navigateAndWait(browser, probe);
        const entries = await call(browser, probe, () => globalThis.__encoder.cacheEntries());
        await browser.cdp.closeTarget(probe.targetId);
        const revisions = [...new Set(entries.map((entry) => entry.headers["x-repo-commit"]).filter(Boolean))];
        return { entries, bytes: entries.reduce((sum, entry) => sum + entry.bytes, 0), revisions };
      })();
      // Both backends must have loaded the pinned revision, or their numbers are not comparable.
      const { revisions } = runs.cacheAfterCold;
      if (revisions.length !== 1 || revisions[0] !== result.pinned?.revision) {
        runs.revisionError = `cached revision ${revisions.join(", ") || "none"} is not the pinned ${result.pinned?.revision}`;
      }
      log(`encoder ${device}: warm`);
      runs.warm = await encoderRun(browser, `${device} warm (browser cache)`, { device, passes: 3 });
      log(`encoder ${device}: offline`);
      runs.offline = await encoderRun(browser, `${device} offline (network blocked)`, { device, passes: 1 }, { goOffline: true });
      if (device === "wasm") {
        log("encoder wasm: constrained (2 threads, 4x CPU throttling)");
        runs.constrained = await encoderRun(browser, "wasm constrained (2 threads, 4x throttle)", { device, numThreads: 2, passes: 1 }, { cpuThrottleRate: 4 });
        runs.exported = await exportModelFiles(browser, modelDir);
      }
    } catch (error) {
      runs.error = String(error.stack ?? error);
      log(`encoder ${device} FAILED: ${runs.error}`);
    } finally {
      await browser.kill().catch(() => undefined);
    }
    result.backends[device] = runs;
  }
  result.agreement = browserAgreement(result.backends);
  if (want("node")) await runNodeSanity(result, modelDir, fixture, log);
  result.failures = phaseFailures(result);
  return result;
}

async function runNodeSanity(result, modelDir, fixture, log) {
  try {
    result.node = await nodeSanity(modelDir, fixture, {
      wasm: result.backends.wasm?.warm?.run,
      webgpu: result.backends.webgpu?.warm?.run,
    });
    log(`encoder node sanity: ${JSON.stringify(Object.fromEntries(Object.entries(result.node.comparisons).map(([k, v]) => [k, v.map((c) => c.cosine?.toFixed(5))])))}`);
  } catch (error) {
    result.node = { error: String(error.stack ?? error) };
    log(`encoder node sanity FAILED: ${result.node.error}`);
  }
}
