import { env, type FeatureExtractionPipeline, layer_norm, pipeline } from "@huggingface/transformers";
import {
  ENCODER_DIMENSIONS,
  ENCODER_DTYPE,
  ENCODER_MODEL_ID,
  ENCODER_REVISION,
  type EncoderDevice,
  type EncoderRequest,
  type EncoderResponse,
  TASK_PREFIX,
} from "./encoder-model";

// The dedicated worker that owns the text encoder. It follows the model card for
// nomic-ai/nomic-embed-text-v1.5: a task prefix on every text, mean pooling, layer norm over the
// embedding dimension, the Matryoshka slice (the full 768 here) and L2 normalization.

env.allowLocalModels = false;
env.useBrowserCache = true;
if (env.backends.onnx?.wasm) env.backends.onnx.wasm.wasmPaths = `${self.location.origin}/ort/`;

let extractor: FeatureExtractionPipeline | null = null;

const post = (message: EncoderResponse, transfer: Transferable[] = []) => self.postMessage(message, transfer);

async function adapterInfo(): Promise<Record<string, unknown> | null> {
  const gpu = (navigator as Navigator & { gpu?: GPU }).gpu;
  const adapter = gpu ? await gpu.requestAdapter() : null;
  if (!adapter) return null;
  return { vendor: adapter.info.vendor, architecture: adapter.info.architecture, shaderF16: adapter.features.has("shader-f16") };
}

async function load(device: EncoderDevice, numThreads?: number): Promise<void> {
  const wasm = env.backends.onnx?.wasm;
  if (wasm && numThreads !== undefined) wasm.numThreads = numThreads;
  const started = performance.now();
  extractor = (await pipeline("feature-extraction", ENCODER_MODEL_ID, {
    dtype: ENCODER_DTYPE,
    device,
    revision: ENCODER_REVISION,
    progress_callback: (event: { status?: string; file?: string; loaded?: number; total?: number }) => {
      if (event.status === "initiate" || event.status === "progress" || event.status === "done") {
        post({ type: "progress", file: event.file ?? "", loaded: event.loaded ?? 0, total: event.total ?? 0, status: event.status, at: performance.now() });
      }
    },
  })) as FeatureExtractionPipeline;
  post({
    type: "loaded",
    device,
    loadMs: performance.now() - started,
    numThreads: typeof wasm?.numThreads === "number" ? wasm.numThreads : null,
    crossOriginIsolated: self.crossOriginIsolated,
    hardwareConcurrency: navigator.hardwareConcurrency,
    webgpuAdapter: device === "webgpu" ? await adapterInfo() : null,
  });
}

async function embed(kind: keyof typeof TASK_PREFIX, texts: string[]): Promise<void> {
  if (!extractor) throw new Error("encoder is not loaded");
  const embeddings: Float32Array[] = [];
  const timingsMs: number[] = [];
  const tokenCounts: number[] = [];
  for (const text of texts) {
    const input = `${TASK_PREFIX[kind]}${text}`;
    const started = performance.now();
    const pooled = await extractor(input, { pooling: "mean" });
    const vector = layer_norm(pooled, [pooled.dims[1] ?? ENCODER_DIMENSIONS])
      .slice(null, [0, ENCODER_DIMENSIONS])
      .normalize(2, -1);
    const data = Float32Array.from(vector.data as Float32Array);
    timingsMs.push(performance.now() - started);
    embeddings.push(data);
    tokenCounts.push(extractor.tokenizer(input).input_ids.dims[1] ?? 0);
  }
  post({ type: "embedded", embeddings, timingsMs, tokenCounts }, embeddings.map((vector) => vector.buffer));
}

// A fixed amount of integer work, to check whether CPU throttling reaches this thread.
function busy(ms: number): void {
  const started = performance.now();
  let iterations = 0;
  let accumulator = 0;
  while (performance.now() - started < ms) {
    for (let i = 0; i < 10_000; i += 1) accumulator = (accumulator * 31 + i) | 0;
    iterations += 1;
  }
  post({ type: "busy", iterations: iterations + (accumulator === 0.5 ? 1 : 0), elapsedMs: performance.now() - started });
}

async function probeFetch(url: string): Promise<void> {
  try {
    const response = await fetch(url, { cache: "no-store" });
    post({ type: "probe-fetch", ok: true, detail: `status ${response.status}` });
  } catch (error) {
    post({ type: "probe-fetch", ok: false, detail: String((error as Error)?.message ?? error) });
  }
}

self.onmessage = async (event: MessageEvent<EncoderRequest>) => {
  const request = event.data;
  try {
    if (request.type === "load") await load(request.device, request.numThreads);
    else if (request.type === "embed") await embed(request.kind, request.texts);
    else if (request.type === "busy") busy(request.ms);
    else if (request.type === "probe-fetch") await probeFetch(request.url);
  } catch (error) {
    post({ type: "error", stage: request.type, message: String((error as Error)?.stack ?? (error as Error)?.message ?? error) });
  }
};
