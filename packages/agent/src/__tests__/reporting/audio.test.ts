import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { createAudioTools, VOICE_LIMITS } from "../../services/reporting/media/audio";

/**
 * The real ffmpeg path on generated recordings, skipped where ffmpeg is not installed. WhatsApp
 * sends Ogg/Opus, which the transcription service does not accept directly, so the Ogg case is
 * produced with ffmpeg itself and must come back as 16 kHz mono WAV.
 */
function available(command: string): boolean {
  try {
    execFileSync(command, ["-version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

/** A mono 16-bit PCM WAV tone of `seconds` at `rate` Hz. */
function wav(seconds: number, rate = 8_000): Uint8Array {
  const samples = Math.round(seconds * rate);
  const buffer = Buffer.alloc(44 + samples * 2);
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + samples * 2, 4);
  buffer.write("WAVEfmt ", 8);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(rate, 24);
  buffer.writeUInt32LE(rate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(samples * 2, 40);
  for (let index = 0; index < samples; index += 1) {
    buffer.writeInt16LE(
      Math.round(8_000 * Math.sin((2 * Math.PI * 440 * index) / rate)),
      44 + index * 2
    );
  }
  return new Uint8Array(buffer);
}

const hasFfmpeg = available("ffmpeg") && available("ffprobe");

describe.skipIf(!hasFfmpeg)("voice normalization with ffmpeg", () => {
  const tools = createAudioTools();

  it("decodes an Ogg/Opus voice note to 16 kHz mono WAV and reports its length", async () => {
    const ogg = new Uint8Array(
      execFileSync(
        "ffmpeg",
        ["-hide_banner", "-loglevel", "error", "-f", "wav", "-i", "pipe:0"].concat([
          "-c:a",
          "libopus",
          "-f",
          "ogg",
          "pipe:1",
        ]),
        { input: wav(2) }
      )
    );
    const result = await tools.normalize(ogg, "audio/ogg");
    if (!result.ok) throw new Error(`expected a decoded recording, got ${result.reason}`);
    expect(result.seconds).toBeGreaterThan(1.9);
    expect(result.seconds).toBeLessThan(2.2);
    const header = Buffer.from(result.wav.subarray(0, 44));
    expect(header.toString("ascii", 0, 4)).toBe("RIFF");
    expect(header.readUInt16LE(22)).toBe(1);
    expect(header.readUInt32LE(24)).toBe(16_000);
  });

  it("refuses recordings over the limit before decoding them", async () => {
    expect(await tools.normalize(wav(VOICE_LIMITS.maxSeconds + 5), "audio/wav")).toEqual({
      ok: false,
      reason: "too_long",
    });
  });

  it("treats a file that is not the declared container as unreadable", async () => {
    expect(await tools.normalize(wav(1), "audio/ogg")).toEqual({ ok: false, reason: "unreadable" });
    expect(
      await tools.normalize(new TextEncoder().encode("#EXTM3U\nhttp://x/y"), "audio/mpeg")
    ).toEqual({ ok: false, reason: "unreadable" });
  });
});
