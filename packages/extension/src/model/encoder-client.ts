import type { EncoderDevice, EncoderRequest, EncoderResponse } from "./encoder-model";

// Main-thread side of the encoder worker: one request in flight at a time.

export type EncoderProgress = Extract<EncoderResponse, { type: "progress" }>;
export type EncoderLoaded = Extract<EncoderResponse, { type: "loaded" }>;
export type EncoderEmbedded = Extract<EncoderResponse, { type: "embedded" }>;

export class EncoderClient {
  private readonly worker: Worker;
  private pending: ((message: EncoderResponse) => void) | null = null;
  readonly progress: EncoderProgress[] = [];

  constructor() {
    this.worker = new Worker(new URL("./encoder.worker.ts", import.meta.url), { type: "module" });
    this.worker.onmessage = (event: MessageEvent<EncoderResponse>) => {
      if (event.data.type === "progress") {
        this.progress.push(event.data);
        return;
      }
      this.pending?.(event.data);
    };
  }

  private async request<T extends EncoderResponse["type"]>(message: EncoderRequest, expected: T): Promise<Extract<EncoderResponse, { type: T }>> {
    const response = await new Promise<EncoderResponse>((resolve) => {
      this.pending = resolve;
      this.worker.postMessage(message);
    });
    if (response.type === "error") throw new Error(`${response.stage}: ${response.message}`);
    if (response.type !== expected) throw new Error(`unexpected worker response ${response.type}`);
    return response as Extract<EncoderResponse, { type: T }>;
  }

  load(device: EncoderDevice, numThreads?: number) {
    return this.request({ type: "load", device, numThreads }, "loaded");
  }

  embed(kind: "query" | "document", texts: string[]) {
    return this.request({ type: "embed", kind, texts }, "embedded");
  }

  busy(ms: number) {
    return this.request({ type: "busy", ms }, "busy");
  }

  probeFetch(url: string) {
    return this.request({ type: "probe-fetch", url }, "probe-fetch");
  }

  terminate(): void {
    this.worker.terminate();
  }
}
