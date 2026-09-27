import { deflateRawSync } from "node:zlib";
import type { DocumentTools, PdfInspection } from "../../../services/reporting/media/documents";
import type { InboundMediaFetcher } from "../../../services/reporting/transport";

/**
 * Media doubles: provider downloads served from memory, document tools with scripted page counts
 * and conversions, a scripted OpenAI Responses endpoint and a small ZIP writer for Office-shaped
 * fixtures. They prove orchestration and limits; real Poppler, LibreOffice and model behavior need
 * their own fixtures before those capabilities are enabled.
 */
export class FixtureMediaFetcher implements InboundMediaFetcher {
  fetches = 0;

  constructor(
    private readonly files: Map<string, Uint8Array>,
    private readonly failures: { remaining: number } = { remaining: 0 }
  ) {}

  async fetch(_realm: string, media: { providerMediaId: string }, limits: { maxBytes: number }) {
    this.fetches += 1;
    if (this.failures.remaining > 0) {
      this.failures.remaining -= 1;
      throw new Error("provider media unavailable");
    }
    const bytes = this.files.get(media.providerMediaId);
    if (!bytes) throw new Error("unknown media");
    return { bytes: bytes.subarray(0, limits.maxBytes + 1) };
  }
}

export class FakeDocumentTools implements DocumentTools {
  pages = new Map<string, PdfInspection>();
  conversions = 0;

  async inspectPdf(bytes: Uint8Array): Promise<PdfInspection> {
    const marker = new TextDecoder().decode(bytes.subarray(0, 64));
    for (const [key, result] of this.pages) if (marker.includes(key)) return result;
    return { ok: true, pages: 1 };
  }

  async convertToPdf(): Promise<Uint8Array> {
    this.conversions += 1;
    return new TextEncoder().encode("%PDF-1.7 converted");
  }
}

/** A Responses endpoint that returns the next scripted structured output. */
export function scriptedOpenAI(outputs: unknown[]) {
  const requests: Array<Record<string, unknown>> = [];
  const fetchStub = (async (_url: string, init: RequestInit) => {
    requests.push(JSON.parse(String(init.body)));
    const output = outputs.shift();
    if (output === undefined) return new Response("{}", { status: 503 });
    return new Response(
      JSON.stringify({
        model: "test-model-2026",
        status: "completed",
        output: [
          { type: "message", content: [{ type: "output_text", text: JSON.stringify(output) }] },
        ],
      })
    );
  }) as unknown as typeof fetch;
  return {
    requests,
    config: {
      apiKey: "sk-test",
      baseUrl: "https://openai.test/v1",
      model: "test-model",
      fetch: fetchStub,
    },
  };
}

/** Writes a ZIP with deflated entries, enough for Office-shaped fixtures. */
export function zip(entries: Record<string, string | Uint8Array>): Uint8Array {
  const locals: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  const encoder = new TextEncoder();
  for (const [name, content] of Object.entries(entries)) {
    const data = typeof content === "string" ? encoder.encode(content) : content;
    const packed = new Uint8Array(deflateRawSync(data));
    const nameBytes = encoder.encode(name);
    const local = new Uint8Array(30 + nameBytes.length + packed.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(8, 8, true);
    lv.setUint32(18, packed.length, true);
    lv.setUint32(22, data.length, true);
    lv.setUint16(26, nameBytes.length, true);
    local.set(nameBytes, 30);
    local.set(packed, 30 + nameBytes.length);
    const header = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(header.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(10, 8, true);
    cv.setUint32(20, packed.length, true);
    cv.setUint32(24, data.length, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint32(42, offset, true);
    header.set(nameBytes, 46);
    locals.push(local);
    central.push(header);
    offset += local.length;
  }
  const directorySize = central.reduce((total, part) => total + part.length, 0);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, central.length, true);
  ev.setUint16(10, central.length, true);
  ev.setUint32(12, directorySize, true);
  ev.setUint32(16, offset, true);
  const parts = [...locals, ...central, end];
  const out = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
  let cursor = 0;
  for (const part of parts) {
    out.set(part, cursor);
    cursor += part.length;
  }
  return out;
}
