import { EncoderClient, type EncoderLoaded } from "../../src/model/encoder-client";
import { correctSectionIndexes, ENCODER_FIXTURE } from "../../src/model/encoder-fixture";
import { ENCODER_DTYPE, ENCODER_MODEL_ID, ENCODER_REVISION, type EncoderDevice } from "../../src/model/encoder-model";
import { bm25Scores, cosineScores, fusedScores, percentile, type RankingSummary, summarize } from "../../src/model/ranking";

// The encoder page the g0 rig drives over CDP. One page runs one load and its ranking passes, so
// every load the rig reports starts from a fresh worker and a fresh ONNX session.

interface TimingStats {
  count: number;
  medianMs: number;
  p95Ms: number;
  minMs: number;
  maxMs: number;
}

export interface EncoderPass {
  totalRankMs: number;
  embedQueriesMs: number;
  embedDocumentsMs: number;
  scoreMs: number;
  requirement: TimingStats;
  section: TimingStats;
  requirementTokens: TimingStats;
  sectionTokens: TimingStats;
  keyword: RankingSummary;
  encoder: RankingSummary;
  combined: RankingSummary;
}

export interface EncoderRun {
  device: EncoderDevice;
  load: EncoderLoaded & { files: Array<{ file: string; total: number }>; progressWindowMs: number | null };
  firstCall: { requirementMs: number; sectionMs: number };
  passes: EncoderPass[];
  sanity: { queries: Array<{ id: string; vector: number[] }>; documents: Array<{ id: string; vector: number[] }> };
  memory: Array<{ label: string; userAgentSpecificBytes: number | null; jsHeapBytes: number | null }>;
}

const logElement = document.getElementById("log");
const say = (line: string) => {
  if (logElement) logElement.textContent += `${new Date().toISOString().slice(11, 19)} ${line}\n`;
};

const stats = (values: number[]): TimingStats => ({
  count: values.length,
  medianMs: percentile(values, 50),
  p95Ms: percentile(values, 95),
  minMs: Math.min(...values),
  maxMs: Math.max(...values),
});

async function measureMemory(label: string) {
  const perf = performance as Performance & {
    measureUserAgentSpecificMemory?: () => Promise<{ bytes: number }>;
    memory?: { usedJSHeapSize: number };
  };
  let userAgentSpecificBytes: number | null = null;
  if (crossOriginIsolated && perf.measureUserAgentSpecificMemory) {
    userAgentSpecificBytes = (await perf.measureUserAgentSpecificMemory().catch(() => null))?.bytes ?? null;
  }
  return { label, userAgentSpecificBytes, jsHeapBytes: perf.memory?.usedJSHeapSize ?? null };
}

let client: EncoderClient | null = null;
const worker = () => (client ??= new EncoderClient());

async function run({ device, numThreads, passes = 2 }: { device: EncoderDevice; numThreads?: number; passes?: number }): Promise<EncoderRun> {
  const memory = [await measureMemory("before-load")];
  const encoder = worker();
  say(`loading ${ENCODER_MODEL_ID} (${ENCODER_DTYPE}) on ${device}${numThreads ? ` with ${numThreads} threads` : ""}`);
  const loaded = await encoder.load(device, numThreads);
  const files = new Map<string, number>();
  for (const event of encoder.progress) if (event.total > 0) files.set(event.file, event.total);
  const times = encoder.progress.map((event) => event.at);
  const load = { ...loaded, files: [...files].map(([file, total]) => ({ file, total })), progressWindowMs: times.length ? Math.max(...times) - Math.min(...times) : null };
  say(`loaded in ${Math.round(loaded.loadMs)} ms, threads ${loaded.numThreads}`);
  memory.push(await measureMemory("after-load"));

  const { requirements, sections, sanitySample } = ENCODER_FIXTURE;
  const correct = correctSectionIndexes();
  // The first call on a fresh session pays for kernel set-up; it is reported apart from the passes.
  const firstQuery = await encoder.embed("query", [requirements[0]?.text ?? ""]);
  const firstDocument = await encoder.embed("document", [sections[0]?.text ?? ""]);
  const firstCall = { requirementMs: firstQuery.timingsMs[0] ?? Number.NaN, sectionMs: firstDocument.timingsMs[0] ?? Number.NaN };

  const results: EncoderPass[] = [];
  let sanity: EncoderRun["sanity"] = { queries: [], documents: [] };
  for (let pass = 0; pass < passes; pass += 1) {
    const started = performance.now();
    const queries = await encoder.embed("query", requirements.map((requirement) => requirement.text));
    const queriesDone = performance.now();
    const documents = await encoder.embed("document", sections.map((section) => section.text));
    const documentsDone = performance.now();
    const keywordScores = bm25Scores(requirements.map((requirement) => requirement.text), sections.map((section) => section.text));
    const encoderScores = cosineScores(queries.embeddings, documents.embeddings);
    const combinedScores = fusedScores(keywordScores, encoderScores);
    const keyword = summarize(keywordScores, correct);
    const encoderSummary = summarize(encoderScores, correct);
    // An exact fusion tie goes to the document the encoder scores higher.
    const combined = summarize(combinedScores, correct, encoderScores);
    const finished = performance.now();
    results.push({
      totalRankMs: finished - started,
      embedQueriesMs: queriesDone - started,
      embedDocumentsMs: documentsDone - queriesDone,
      scoreMs: finished - documentsDone,
      requirement: stats(queries.timingsMs),
      section: stats(documents.timingsMs),
      requirementTokens: stats(queries.tokenCounts),
      sectionTokens: stats(documents.tokenCounts),
      keyword,
      encoder: encoderSummary,
      combined,
    });
    say(`pass ${pass + 1}: ranked in ${Math.round(finished - started)} ms; top-1 keyword ${keyword.top1}, encoder ${encoderSummary.top1}, combined ${combined.top1} of ${requirements.length}`);
    if (pass === 0) {
      const pick = (ids: string[], list: Array<{ id: string }>, vectors: Float32Array[]) =>
        ids.map((id) => ({ id, vector: Array.from(vectors[list.findIndex((item) => item.id === id)] ?? []) }));
      sanity = {
        queries: pick(sanitySample.queries, requirements, queries.embeddings),
        documents: pick(sanitySample.documents, sections, documents.embeddings),
      };
    }
  }
  memory.push(await measureMemory("after-rank"));
  return { device, load, firstCall, passes: results, sanity, memory };
}

async function hubMetadata() {
  const api = await fetch(`https://huggingface.co/api/models/${ENCODER_MODEL_ID}?blobs=true`, { cache: "no-store" });
  const body = (await api.json()) as {
    id: string;
    sha: string;
    lastModified: string;
    cardData?: { license?: string };
    tags?: string[];
    safetensors?: { parameters?: Record<string, number>; total?: number };
    siblings?: Array<{ rfilename: string; size?: number; lfs?: { sha256?: string; size?: number } }>;
  };
  const readme = await (await fetch(`https://huggingface.co/${ENCODER_MODEL_ID}/raw/${body.sha}/README.md`, { cache: "no-store" })).text();
  const jsBlock = readme.match(/```(?:js|javascript)\n([\s\S]*?)```/)?.[1] ?? null;
  return {
    id: body.id,
    sha: body.sha,
    lastModified: body.lastModified,
    license: body.cardData?.license ?? null,
    licenseTags: (body.tags ?? []).filter((tag) => tag.startsWith("license:")),
    safetensors: body.safetensors ?? null,
    onnxFiles: (body.siblings ?? []).filter((sibling) => sibling.rfilename.startsWith("onnx/")).map((sibling) => ({ file: sibling.rfilename, size: sibling.size ?? sibling.lfs?.size ?? null, sha256: sibling.lfs?.sha256 ?? null })),
    otherFiles: (body.siblings ?? []).filter((sibling) => /^(config|tokenizer|tokenizer_config|special_tokens_map)\.json$/.test(sibling.rfilename)).map((sibling) => ({ file: sibling.rfilename, size: sibling.size ?? null })),
    readmePrefixLines: readme.split("\n").filter((line) => /search_(query|document):/.test(line)).slice(0, 12),
    readmeTransformersJs: jsBlock,
  };
}

async function cacheEntries() {
  const entries: Array<{ cache: string; url: string; bytes: number; headers: Record<string, string> }> = [];
  for (const name of await caches.keys()) {
    const cache = await caches.open(name);
    for (const request of await cache.keys()) {
      const response = await cache.match(request);
      if (!response) continue;
      const headers: Record<string, string> = {};
      for (const key of ["x-repo-commit", "x-linked-size", "x-linked-etag", "etag", "content-length", "content-type"]) {
        const value = response.headers.get(key);
        if (value) headers[key] = value;
      }
      entries.push({ cache: name, url: request.url, bytes: (await response.clone().arrayBuffer()).byteLength, headers });
    }
  }
  return entries.sort((a, b) => a.url.localeCompare(b.url));
}

const blobs = new Map<string, Blob>();
// Hands a cached model file to the rig in base64 slices, so Node can load the same bytes.
async function readCached(url: string, offset: number, length: number): Promise<{ size: number; base64: string }> {
  let blob = blobs.get(url);
  if (!blob) {
    const response = await caches.match(url);
    if (!response) throw new Error(`not cached: ${url}`);
    blob = await response.blob();
    blobs.set(url, blob);
  }
  const slice = blob.slice(offset, offset + length);
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(slice);
  });
  return { size: blob.size, base64: dataUrl.slice(dataUrl.indexOf(",") + 1) };
}

async function probePageFetch(url: string) {
  try {
    const response = await fetch(url, { cache: "no-store" });
    return { ok: true, detail: `status ${response.status}` };
  } catch (error) {
    return { ok: false, detail: String((error as Error)?.message ?? error) };
  }
}

async function environment() {
  const adapter = navigator.gpu ? await navigator.gpu.requestAdapter() : null;
  return {
    userAgent: navigator.userAgent,
    hardwareConcurrency: navigator.hardwareConcurrency,
    deviceMemory: (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? null,
    crossOriginIsolated,
    webgpu: adapter ? { vendor: adapter.info.vendor, architecture: adapter.info.architecture, shaderF16: adapter.features.has("shader-f16") } : null,
  };
}

declare global {
  interface Window {
    __encoder: unknown;
  }
}

window.__encoder = {
  ready: true,
  model: { id: ENCODER_MODEL_ID, revision: ENCODER_REVISION, dtype: ENCODER_DTYPE },
  fixture: { synthetic: ENCODER_FIXTURE.synthetic, requirements: ENCODER_FIXTURE.requirements.length, sections: ENCODER_FIXTURE.sections.length },
  environment,
  run,
  hubMetadata,
  cacheEntries,
  readCached,
  busy: (ms: number) => worker().busy(ms),
  probeWorkerFetch: (url: string) => worker().probeFetch(url),
  probePageFetch,
};
say("ready");
