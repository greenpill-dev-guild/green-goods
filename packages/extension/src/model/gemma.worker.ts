import {
  AutoModelForCausalLM,
  AutoTokenizer,
  env,
  type PreTrainedModel,
  type PreTrainedTokenizer,
  TextStreamer,
} from "@huggingface/transformers";
import { buildProposalMessages } from "./prompt";
import type { InvestigationPacket } from "./packet";

// The dedicated worker that owns the model. It loads once, answers one bounded packet per request
// and reports timings. All model assets come from the Hugging Face hub and are cached by the
// browser under the extension origin; the ONNX runtime's WebAssembly comes from the extension.

const MODEL_ID = "onnx-community/gemma-4-E2B-it-ONNX";
const MODEL_DTYPE = "q4f16";
const MODEL_DEVICE = "webgpu";

export type WorkerRequest = { type: "load" } | { type: "propose"; packet: InvestigationPacket; maxNewTokens: number };

export type WorkerResponse =
  | { type: "progress"; file: string; loaded: number; total: number; status: string }
  | {
      type: "loaded";
      modelId: string;
      dtype: string;
      device: string;
      loadMs: number;
      tokenizerMs: number;
      modelMs: number;
      jsHeapBytes: number | null;
    }
  | {
      type: "result";
      rawText: string;
      promptTokens: number;
      newTokens: number;
      prefillMs: number;
      decodeMs: number;
      totalMs: number;
      tokensPerSecond: number;
      jsHeapBytes: number | null;
    }
  | { type: "error"; stage: string; message: string };

env.allowLocalModels = false;
env.useBrowserCache = true;
// The runtime's .wasm and .mjs live in the extension at /ort/ (copied at build time).
if (env.backends.onnx?.wasm) env.backends.onnx.wasm.wasmPaths = `${self.location.origin}/ort/`;

let tokenizer: PreTrainedTokenizer | null = null;
let model: PreTrainedModel | null = null;

const post = (message: WorkerResponse) => self.postMessage(message);

function jsHeapBytes(): number | null {
  const memory = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory;
  return memory ? memory.usedJSHeapSize : null;
}

async function load(): Promise<void> {
  const started = performance.now();
  const progress_callback = (event: { status?: string; file?: string; loaded?: number; total?: number }) => {
    if (event.status === "progress" || event.status === "done" || event.status === "initiate") {
      post({ type: "progress", file: event.file ?? "", loaded: event.loaded ?? 0, total: event.total ?? 0, status: event.status });
    }
  };
  tokenizer = await AutoTokenizer.from_pretrained(MODEL_ID, { progress_callback });
  const tokenizerMs = performance.now() - started;
  const modelStarted = performance.now();
  model = await AutoModelForCausalLM.from_pretrained(MODEL_ID, { dtype: MODEL_DTYPE, device: MODEL_DEVICE, progress_callback });
  const modelMs = performance.now() - modelStarted;
  post({
    type: "loaded",
    modelId: MODEL_ID,
    dtype: MODEL_DTYPE,
    device: MODEL_DEVICE,
    loadMs: performance.now() - started,
    tokenizerMs,
    modelMs,
    jsHeapBytes: jsHeapBytes(),
  });
}

async function propose(packet: InvestigationPacket, maxNewTokens: number): Promise<void> {
  if (!tokenizer || !model) throw new Error("model is not loaded");
  const messages = buildProposalMessages(packet);
  const inputs = tokenizer.apply_chat_template(messages, {
    add_generation_prompt: true,
    return_dict: true,
    enable_thinking: false,
  } as Parameters<PreTrainedTokenizer["apply_chat_template"]>[1]) as { input_ids: { dims: number[] } };
  const promptTokens = inputs.input_ids.dims[1] ?? 0;
  const started = performance.now();
  let firstTokenAt: number | null = null;
  const streamer = new TextStreamer(tokenizer, {
    skip_prompt: true,
    skip_special_tokens: true,
    callback_function: () => {
      if (firstTokenAt === null) firstTokenAt = performance.now();
    },
  });
  const output = (await model.generate({
    ...inputs,
    max_new_tokens: maxNewTokens,
    do_sample: false,
    streamer,
  } as Parameters<PreTrainedModel["generate"]>[0])) as { dims: number[]; slice: (...args: unknown[]) => unknown };
  const finished = performance.now();
  const newTokens = (output.dims[1] ?? promptTokens) - promptTokens;
  const generated = output.slice(null, [promptTokens, null]);
  const rawText = tokenizer.batch_decode(generated as never, { skip_special_tokens: true })[0] ?? "";
  const prefillMs = (firstTokenAt ?? finished) - started;
  const decodeMs = finished - (firstTokenAt ?? finished);
  post({
    type: "result",
    rawText,
    promptTokens,
    newTokens,
    prefillMs,
    decodeMs,
    totalMs: finished - started,
    tokensPerSecond: decodeMs > 0 ? (newTokens - 1) / (decodeMs / 1000) : 0,
    jsHeapBytes: jsHeapBytes(),
  });
}

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const request = event.data;
  try {
    if (request.type === "load") await load();
    else if (request.type === "propose") await propose(request.packet, request.maxNewTokens);
  } catch (error) {
    post({ type: "error", stage: request.type, message: String((error as Error)?.stack ?? (error as Error)?.message ?? error) });
  }
};
