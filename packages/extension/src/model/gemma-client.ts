import type { InvestigationPacket } from "./packet";
import { validateProposals, type ValidationResult } from "./validate";
import type { WorkerRequest, WorkerResponse } from "./gemma.worker";

// Main-thread side of the model worker: load with progress, propose once, validate in code.

export interface LoadReport {
  modelId: string;
  dtype: string;
  device: string;
  loadMs: number;
  tokenizerMs: number;
  modelMs: number;
  workerJsHeapBytes: number | null;
  files: Array<{ file: string; total: number }>;
}

export interface ProposalReport {
  rawText: string;
  promptTokens: number;
  newTokens: number;
  prefillMs: number;
  decodeMs: number;
  totalMs: number;
  tokensPerSecond: number;
  workerJsHeapBytes: number | null;
  validation: ValidationResult;
}

export class GemmaClient {
  private readonly worker: Worker;
  private readonly files = new Map<string, number>();
  private pending: ((message: WorkerResponse) => void) | null = null;
  readonly progress: Array<{ at: number; file: string; loaded: number; total: number; status: string }> = [];

  constructor(onProgress?: (fraction: number, file: string) => void) {
    this.worker = new Worker(new URL("./gemma.worker.ts", import.meta.url), { type: "module" });
    this.worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const message = event.data;
      if (message.type === "progress") {
        if (message.total > 0) this.files.set(message.file, message.total);
        this.progress.push({ at: performance.now(), ...message });
        onProgress?.(message.total > 0 ? message.loaded / message.total : 0, message.file);
        return;
      }
      this.pending?.(message);
    };
  }

  private request(message: WorkerRequest): Promise<WorkerResponse> {
    return new Promise((resolve) => {
      this.pending = resolve;
      this.worker.postMessage(message);
    });
  }

  async load(): Promise<LoadReport> {
    const response = await this.request({ type: "load" });
    if (response.type === "error") throw new Error(`${response.stage}: ${response.message}`);
    if (response.type !== "loaded") throw new Error(`unexpected worker response ${response.type}`);
    return {
      modelId: response.modelId,
      dtype: response.dtype,
      device: response.device,
      loadMs: response.loadMs,
      tokenizerMs: response.tokenizerMs,
      modelMs: response.modelMs,
      workerJsHeapBytes: response.jsHeapBytes,
      files: [...this.files.entries()].map(([file, total]) => ({ file, total })),
    };
  }

  async propose(packet: InvestigationPacket, maxNewTokens = 320): Promise<ProposalReport> {
    const response = await this.request({ type: "propose", packet, maxNewTokens });
    if (response.type === "error") throw new Error(`${response.stage}: ${response.message}`);
    if (response.type !== "result") throw new Error(`unexpected worker response ${response.type}`);
    const { type: _type, jsHeapBytes, ...timings } = response;
    return { ...timings, workerJsHeapBytes: jsHeapBytes, validation: validateProposals(response.rawText, packet) };
  }

  terminate(): void {
    this.worker.terminate();
  }
}
