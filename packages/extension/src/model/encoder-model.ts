// What the encoder worker, its client and the encoder page share, with no runtime imports, so the
// page does not pull Transformers.js into its own bundle.

export const ENCODER_MODEL_ID = "nomic-ai/nomic-embed-text-v1.5";
// The Hub commit the 2026-11-20 measurement loaded on both backends; pinned so every run loads it.
export const ENCODER_REVISION = "e9b6763023c676ca8431644204f50c2b100d9aab";
export const ENCODER_DTYPE = "q8"; // onnx/model_quantized.onnx
export const ENCODER_DIMENSIONS = 768;
export const TASK_PREFIX = { query: "search_query: ", document: "search_document: " } as const;

export type EncoderDevice = "wasm" | "webgpu";

export type EncoderRequest =
  | { type: "load"; device: EncoderDevice; numThreads?: number }
  | { type: "embed"; kind: keyof typeof TASK_PREFIX; texts: string[] }
  | { type: "busy"; ms: number }
  | { type: "probe-fetch"; url: string };

export type EncoderResponse =
  | { type: "progress"; file: string; loaded: number; total: number; status: string; at: number }
  | {
      type: "loaded";
      device: EncoderDevice;
      loadMs: number;
      numThreads: number | null;
      crossOriginIsolated: boolean;
      hardwareConcurrency: number;
      webgpuAdapter: Record<string, unknown> | null;
    }
  | { type: "embedded"; embeddings: Float32Array[]; timingsMs: number[]; tokenCounts: number[] }
  | { type: "busy"; iterations: number; elapsedMs: number }
  | { type: "probe-fetch"; ok: boolean; detail: string }
  | { type: "error"; stage: string; message: string };
