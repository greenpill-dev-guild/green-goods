import type { EncoderDevice, EncoderRequest, EncoderResponse } from "./encoder-model";

// Main-thread side of the encoder worker: one request in flight at a time. A worker that fails to
// load, crashes or sends a message that cannot be read rejects the request in flight, so the page's
// caller sees the failure instead of waiting for a reply that never comes.

export type EncoderProgress = Extract<EncoderResponse, { type: "progress" }>;
export type EncoderLoaded = Extract<EncoderResponse, { type: "loaded" }>;

interface Pending {
  resolve: (message: EncoderResponse) => void;
  reject: (error: Error) => void;
}

export class EncoderClient {
  private readonly worker: Worker;
  private pending: Pending | null = null;
  private failure: Error | null = null;
  readonly progress: EncoderProgress[] = [];

  constructor() {
    this.worker = new Worker(new URL("./encoder.worker.ts", import.meta.url), { type: "module" });
    this.worker.onmessage = (event: MessageEvent<EncoderResponse>) => {
      if (event.data.type === "progress") {
        this.progress.push(event.data);
        return;
      }
      this.settle()?.resolve(event.data);
    };
    this.worker.onerror = (event: ErrorEvent) => {
      this.fail(new Error(`encoder worker failed: ${event.message || "no message"}`), () => event.preventDefault());
    };
    this.worker.onmessageerror = () => this.fail(new Error("encoder worker sent a message that could not be read"));
  }

  // A failed worker takes no further requests, so a late reply can never answer a later request.
  // The error is handled here only when a request was waiting for it; otherwise it reaches the console.
  private fail(error: Error, handled?: () => void): void {
    this.failure = error;
    const pending = this.settle();
    if (!pending) return;
    handled?.();
    pending.reject(error);
  }

  private settle(): Pending | null {
    const pending = this.pending;
    this.pending = null;
    return pending;
  }

  private async request<T extends EncoderResponse["type"]>(message: EncoderRequest, expected: T): Promise<Extract<EncoderResponse, { type: T }>> {
    if (this.failure) throw this.failure;
    if (this.pending) throw new Error("encoder worker already has a request in flight");
    const response = await new Promise<EncoderResponse>((resolve, reject) => {
      this.pending = { resolve, reject };
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
