import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import * as z from "zod";
import { LocalToolError, runTool, withWorkspace } from "./subprocess";

/**
 * Voice-note normalization before transcription. The container comes from the byte detection,
 * never the filename; ffprobe checks it holds exactly one audio stream within the duration limit,
 * and ffmpeg decodes it to 16 kHz mono WAV, since the transcription service does not accept every
 * container a chat app sends (WhatsApp uses Ogg/Opus). Both tools read only the local file: the
 * demuxer is forced and every protocol but `file` is refused, so a crafted recording cannot make
 * them fetch anything. Output size is bounded as well as input size and run time.
 */
export const VOICE_LIMITS = {
  maxSeconds: 120,
  /** Two minutes of 16 kHz mono 16-bit PCM is about 3.8 MB. */
  maxDecodedBytes: 5 * 1024 * 1024,
  timeoutMs: 30_000,
} as const;

export type NormalizedAudio =
  | { ok: true; wav: Uint8Array; seconds: number }
  | { ok: false; reason: "too_long" | "unreadable" };

export interface AudioTools {
  normalize(bytes: Uint8Array, mime: string): Promise<NormalizedAudio>;
}

const DEMUXERS: Record<string, string> = {
  "audio/ogg": "ogg",
  "audio/mpeg": "mp3",
  "audio/wav": "wav",
  "audio/mp4": "mov",
};

const probeSchema = z.object({
  streams: z
    .array(z.object({ codec_type: z.string().optional() }))
    .max(16)
    .default([]),
  format: z.object({ duration: z.string().optional() }).optional(),
});

export function createAudioTools(options: { ffmpeg?: string; ffprobe?: string } = {}): AudioTools {
  const ffprobe = options.ffprobe ?? "ffprobe";
  const ffmpeg = options.ffmpeg ?? "ffmpeg";
  return {
    async normalize(bytes, mime) {
      const demuxer = DEMUXERS[mime];
      if (!demuxer) return { ok: false, reason: "unreadable" };
      return withWorkspace("gg-reporting-audio-", async (dir) => {
        await writeFile(join(dir, "input"), bytes, { mode: 0o600 });
        const input = ["-protocol_whitelist", "file", "-f", demuxer, "-i", "input"];
        let probe: z.infer<typeof probeSchema>;
        try {
          const output = await runTool(
            ffprobe,
            [
              "-v",
              "error",
              "-show_entries",
              "format=duration:stream=codec_type",
              "-of",
              "json",
            ].concat(input),
            { cwd: dir, timeoutMs: 10_000, maxOutput: 64 * 1024 }
          );
          probe = probeSchema.parse(JSON.parse(output));
        } catch (error) {
          if (error instanceof LocalToolError && error.reason === "unavailable") throw error;
          return { ok: false, reason: "unreadable" };
        }
        const { streams } = probe;
        const seconds = Number(probe.format?.duration);
        const audioStreams = streams.filter((stream) => stream.codec_type === "audio").length;
        if (audioStreams !== 1 || streams.length !== 1 || !(seconds > 0)) {
          return { ok: false, reason: "unreadable" };
        }
        if (seconds > VOICE_LIMITS.maxSeconds) return { ok: false, reason: "too_long" };
        try {
          await runTool(
            ffmpeg,
            ["-nostdin", "-hide_banner", "-loglevel", "error"].concat(input, [
              "-t",
              String(VOICE_LIMITS.maxSeconds),
              "-vn",
              "-ac",
              "1",
              "-ar",
              "16000",
              "-c:a",
              "pcm_s16le",
              "-f",
              "wav",
              "output.wav",
            ]),
            { cwd: dir, timeoutMs: VOICE_LIMITS.timeoutMs, maxOutput: 64 * 1024 }
          );
        } catch (error) {
          if (error instanceof LocalToolError && error.reason === "unavailable") throw error;
          return { ok: false, reason: "unreadable" };
        }
        const wav = new Uint8Array(await readFile(join(dir, "output.wav")));
        if (wav.byteLength > VOICE_LIMITS.maxDecodedBytes) return { ok: false, reason: "too_long" };
        return { ok: true, wav, seconds };
      });
    },
  };
}
