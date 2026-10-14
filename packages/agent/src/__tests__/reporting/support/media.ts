import { deflateRawSync } from "node:zlib";
import {
  type AudioTools,
  type NormalizedAudio,
  VOICE_LIMITS,
} from "../../../services/reporting/media/audio";
import type { DocumentTools, PdfInspection } from "../../../services/reporting/media/documents";
import { LocalToolError } from "../../../services/reporting/media/subprocess";
import type { InboundMediaFetcher } from "../../../services/reporting/transport";

/**
 * Media doubles: provider downloads served from memory, document and audio tools with scripted
 * results, scripted OpenAI Responses and Audio endpoints and a small ZIP writer for Office-shaped
 * fixtures. They prove orchestration and limits; real Poppler, LibreOffice, ffmpeg and model
 * behavior need their own fixtures before those capabilities are enabled.
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
  /** Whether LibreOffice is "installed"; without it conversion is unavailable, as in the image. */
  converts = false;

  async inspectPdf(bytes: Uint8Array): Promise<PdfInspection> {
    const marker = new TextDecoder().decode(bytes.subarray(0, 64));
    for (const [key, result] of this.pages) if (marker.includes(key)) return result;
    return { ok: true, pages: 1 };
  }

  async convertToPdf(): Promise<Uint8Array> {
    if (!this.converts) throw new LocalToolError("unavailable");
    this.conversions += 1;
    return new TextEncoder().encode("%PDF-1.7 converted");
  }
}

/**
 * A Responses endpoint that returns the next scripted structured output, and an Audio endpoint that
 * returns the next scripted transcript (`null` answers 503).
 */
export function scriptedOpenAI(outputs: unknown[], transcripts: Array<string | null> = []) {
  const requests: Array<Record<string, unknown>> = [];
  const transcriptions: Array<{ model: string; language: string | null; bytes: number }> = [];
  const fetchStub = (async (url: string, init: RequestInit) => {
    if (url.endsWith("/audio/transcriptions")) {
      const form = init.body as FormData;
      const file = form.get("file") as Blob;
      transcriptions.push({
        model: String(form.get("model")),
        language: form.get("language") === null ? null : String(form.get("language")),
        bytes: file.size,
      });
      const text = transcripts.shift();
      if (text === undefined || text === null) return new Response("{}", { status: 503 });
      return new Response(JSON.stringify({ text }));
    }
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
    transcriptions,
    config: {
      apiKey: "sk-test",
      baseUrl: "https://openai.test/v1",
      model: "test-model",
      transcriptionModel: "test-transcribe",
      fetch: fetchStub,
    },
  };
}

/** Audio normalization with a scripted duration; the bytes pass through unchanged. */
export class FakeAudioTools implements AudioTools {
  seconds = 12;
  normalized = 0;

  async normalize(bytes: Uint8Array): Promise<NormalizedAudio> {
    this.normalized += 1;
    if (this.seconds > VOICE_LIMITS.maxSeconds) return { ok: false, reason: "too_long" };
    return { ok: true, wav: bytes, seconds: this.seconds };
  }
}

/** Writes a ZIP with deflated entries, enough for Office-shaped fixtures. */
/** The start of an MP4 file: enough to be detected as video, which a report cannot use. */
export const VIDEO_CLIP = new Uint8Array([
  0,
  0,
  0,
  24,
  ...new TextEncoder().encode("ftypisom"),
  0,
  0,
  0,
  0,
]);

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
