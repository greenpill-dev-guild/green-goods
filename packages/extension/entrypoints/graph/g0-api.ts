import { browser } from "wxt/browser";
import type { PhaseEvent } from "../../src/execution/dummy-task";
import { EffectStore } from "../../src/execution/effects";
import { createRetainedMemoryStorage, openGroveHarness } from "../../src/execution/harness";
import type { CanvasStats } from "../../src/graph/canvas";
import { GemmaClient, type LoadReport, type ProposalReport } from "../../src/model/gemma-client";
import { G0_PACKET } from "../../src/model/packet";

// What the g0 rig drives over CDP, and what the buttons in the side panel call.

export interface MemorySample {
  label: string;
  userAgentSpecificBytes: number | null;
  jsHeapBytes: number | null;
}

export interface ModelRun {
  load: LoadReport;
  passes: ProposalReport[];
  cacheKeys: string[];
  memory: MemorySample[];
  progressSamples: number;
}

export interface PiDemo {
  kind: "resume-mid-work" | "crash-after-apply";
  storage: string;
  events: Array<PhaseEvent & { harness: string; atMs: number }>;
  outcome: { status: string; result?: unknown; error?: string };
  effectCount: number;
  liveTasksBeforeCrash: number;
}

export interface G0Api {
  ready: true;
  runtimeId: string;
  graph: CanvasStats;
  environment(): Promise<Record<string, unknown>>;
  model: { run(options?: { maxNewTokens?: number; passes?: number }): Promise<ModelRun> };
  pi: {
    resumeDemo(options?: { chunkCount?: number; chunkDelayMs?: number }): Promise<PiDemo>;
    crashAfterApplyDemo(options?: { chunkCount?: number; chunkDelayMs?: number }): Promise<PiDemo>;
  };
}

interface Deps {
  graph: CanvasStats;
  say: (line: string) => void;
  onModelProgress: (fraction: number, file: string) => void;
}

async function measureMemory(label: string): Promise<MemorySample> {
  const perf = performance as Performance & {
    measureUserAgentSpecificMemory?: () => Promise<{ bytes: number }>;
    memory?: { usedJSHeapSize: number };
  };
  let userAgentSpecificBytes: number | null = null;
  if (crossOriginIsolated && perf.measureUserAgentSpecificMemory) {
    try {
      userAgentSpecificBytes = (await perf.measureUserAgentSpecificMemory()).bytes;
    } catch {
      userAgentSpecificBytes = null;
    }
  }
  return { label, userAgentSpecificBytes, jsHeapBytes: perf.memory?.usedJSHeapSize ?? null };
}

async function modelCacheKeys(): Promise<string[]> {
  const keys: string[] = [];
  for (const name of await caches.keys()) {
    const cache = await caches.open(name);
    for (const request of await cache.keys()) keys.push(request.url);
  }
  return keys.filter((url) => /huggingface|hf\.co/.test(url)).sort();
}

const waitUntil = async (predicate: () => boolean, timeoutMs: number) => {
  const started = performance.now();
  while (!predicate()) {
    if (performance.now() - started > timeoutMs) throw new Error("timed out waiting for the task");
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
};

async function runPiDemo(kind: PiDemo["kind"], say: Deps["say"], options: { chunkCount?: number; chunkDelayMs?: number }): Promise<PiDemo> {
  const chunkCount = options.chunkCount ?? 5;
  const chunkDelayMs = options.chunkDelayMs ?? 400;
  const effects = await EffectStore.open();
  await effects.reset();
  const storage = createRetainedMemoryStorage();
  const started = performance.now();
  const events: PiDemo["events"] = [];
  let label = "A";
  const host = {
    effects,
    onEvent: (event: PhaseEvent) => {
      events.push({ ...event, harness: label, atMs: Math.round(performance.now() - started) });
      say(`pi ${label}: ${event.kind}${"chunk" in event ? ` ${event.chunk}` : ""}`);
    },
    holdGate: (signal: AbortSignal) =>
      new Promise<void>((_resolve, reject) => {
        signal.addEventListener("abort", () => reject(new Error("held apply interrupted")), { once: true });
      }),
  };
  const first = await openGroveHarness(storage, host);
  const runId = `${kind}-${Date.now()}`;
  const id = await first.startInvestigation({ runId, chunkCount, chunkDelayMs, holdAfterApply: kind === "crash-after-apply" });
  if (kind === "resume-mid-work") await waitUntil(() => events.filter((event) => event.kind === "chunk").length >= 2, 30000);
  else await waitUntil(() => events.some((event) => event.kind === "apply-hold"), 30000);
  const liveTasksBeforeCrash = await first.liveTaskCount();
  await first.crash();
  say(`pi A: crashed (${liveTasksBeforeCrash} live task)`);
  label = "B";
  const second = await openGroveHarness(storage, host);
  const outcome = await second.waitFor(id);
  await second.close();
  const effectCount = await effects.effectCount();
  effects.close();
  return { kind, storage: "RetainedMemoryStorage (pi-durable 1.3.0 MemoryStorage, close() retains state)", events, outcome, effectCount, liveTasksBeforeCrash };
}

export function createG0Api({ graph, say, onModelProgress }: Deps): G0Api {
  let client: GemmaClient | null = null;
  return {
    ready: true,
    runtimeId: browser.runtime.id,
    graph,
    async environment() {
      const gpu = navigator.gpu ? await navigator.gpu.requestAdapter() : null;
      const info = gpu?.info;
      return {
        userAgent: navigator.userAgent,
        deviceMemory: (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? null,
        hardwareConcurrency: navigator.hardwareConcurrency,
        crossOriginIsolated,
        webgpu: gpu
          ? {
              vendor: info?.vendor,
              architecture: info?.architecture,
              device: info?.device,
              description: info?.description,
              shaderF16: gpu.features.has("shader-f16"),
              maxBufferSize: gpu.limits.maxBufferSize,
              maxStorageBufferBindingSize: gpu.limits.maxStorageBufferBindingSize,
            }
          : null,
        storageEstimate: await navigator.storage.estimate(),
      };
    },
    model: {
      async run({ maxNewTokens = 320, passes = 2 } = {}) {
        const memory: MemorySample[] = [await measureMemory("before-load")];
        const reused = client !== null;
        client ??= new GemmaClient(onModelProgress);
        say(reused ? "model: reusing the loaded worker" : "model: loading");
        const load = reused
          ? { modelId: "(already loaded)", dtype: "", device: "", loadMs: 0, tokenizerMs: 0, modelMs: 0, workerJsHeapBytes: null, files: [] }
          : await client.load();
        say(`model: loaded in ${Math.round(load.loadMs)} ms`);
        memory.push(await measureMemory("after-load"));
        const results: ProposalReport[] = [];
        for (let pass = 0; pass < passes; pass += 1) {
          const result = await client.propose(G0_PACKET, maxNewTokens);
          say(`model: pass ${pass + 1}: ${result.newTokens} tokens, ${result.tokensPerSecond.toFixed(1)} tok/s, ${result.validation.accepted.length} accepted`);
          results.push(result);
        }
        memory.push(await measureMemory("after-generate"));
        return { load, passes: results, cacheKeys: await modelCacheKeys(), memory, progressSamples: client.progress.length };
      },
    },
    pi: {
      resumeDemo: (options = {}) => runPiDemo("resume-mid-work", say, options),
      crashAfterApplyDemo: (options = {}) => runPiDemo("crash-after-apply", say, options),
    },
  };
}
