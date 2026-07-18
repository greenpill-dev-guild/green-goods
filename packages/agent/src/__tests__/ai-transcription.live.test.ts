/**
 * Opt-in Transformers.js runtime proof.
 *
 * Run after the agent build with model downloads enabled:
 * RUN_LIVE_TRANSFORMERS=true bun run test -- src/__tests__/ai-transcription.live.test.ts
 */

import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { initAI, isAIModelLoaded } from "../services/ai";

const describeLive = process.env.RUN_LIVE_TRANSFORMERS === "true" ? describe : describe.skip;

function createSilentPcm16Wav(): Buffer {
  const sampleCount = 16_000;
  const dataSize = sampleCount * 2;
  const wav = Buffer.alloc(44 + dataSize);

  wav.write("RIFF", 0, "ascii");
  wav.writeUInt32LE(36 + dataSize, 4);
  wav.write("WAVE", 8, "ascii");
  wav.write("fmt ", 12, "ascii");
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(16_000, 24);
  wav.writeUInt32LE(32_000, 28);
  wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write("data", 36, "ascii");
  wav.writeUInt32LE(dataSize, 40);

  return wav;
}

describeLive("Transformers.js Whisper runtime", () => {
  const fixtureDirectory = mkdtempSync(path.join(tmpdir(), "green-goods-whisper-live-"));
  const wavPath = path.join(fixtureDirectory, "silence.wav");
  writeFileSync(wavPath, createSilentPcm16Wav());

  afterAll(() => {
    rmSync(fixtureDirectory, { recursive: true, force: true });
  });

  it("loads Xenova/whisper-tiny.en and transcribes PCM audio", async () => {
    const result = await initAI().transcribe(wavPath);

    expect(typeof result).toBe("string");
    expect(isAIModelLoaded()).toBe(true);
  }, 300_000);
});
