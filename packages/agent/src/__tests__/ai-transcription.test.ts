import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { pipeline, transcriber } = vi.hoisted(() => ({
  pipeline: vi.fn(),
  transcriber: vi.fn(),
}));

vi.mock("@huggingface/transformers", () => ({ pipeline }));

function createPcm16Wav(samples: number[]): Buffer {
  const dataSize = samples.length * 2;
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
  samples.forEach((sample, index) => wav.writeInt16LE(sample, 44 + index * 2));

  return wav;
}

describe("AI transcription", () => {
  let fixtureDirectory: string;
  let wavPath: string;

  beforeEach(() => {
    vi.resetModules();
    pipeline.mockReset();
    transcriber.mockReset();

    fixtureDirectory = mkdtempSync(path.join(tmpdir(), "green-goods-audio-"));
    wavPath = path.join(fixtureDirectory, "speech.wav");
    writeFileSync(wavPath, createPcm16Wav([-32_768, 0, 16_384]));
  });

  afterEach(() => {
    rmSync(fixtureDirectory, { recursive: true, force: true });
  });

  it("passes decoded mono 16 kHz PCM16 samples to the Whisper pipeline", async () => {
    transcriber.mockResolvedValue({ text: "garden work recorded" });
    pipeline.mockResolvedValue(transcriber);

    const { initAI } = await import("../services/ai");
    const result = await initAI().transcribe(wavPath);

    expect(pipeline).toHaveBeenCalledOnce();
    expect(pipeline).toHaveBeenCalledWith("automatic-speech-recognition", "Xenova/whisper-tiny.en");
    expect(transcriber).toHaveBeenCalledOnce();
    const [audio] = transcriber.mock.calls[0] as [Float32Array];
    expect(audio).toBeInstanceOf(Float32Array);
    expect(Array.from(audio)).toEqual([-1, 0, 0.5]);
    expect(result).toBe("garden work recorded");
  });

  it("resets a failed model load and preserves the text-input fallback", async () => {
    pipeline
      .mockRejectedValueOnce(new Error("model unavailable"))
      .mockResolvedValueOnce(transcriber);
    transcriber.mockResolvedValue({ text: "retry succeeded" });

    const { initAI } = await import("../services/ai");
    const ai = initAI();

    await expect(ai.transcribe(wavPath)).rejects.toThrow(
      "Voice processing unavailable: model unavailable. Please use text input instead."
    );
    await expect(ai.transcribe(wavPath)).resolves.toBe("retry succeeded");
    expect(pipeline).toHaveBeenCalledTimes(2);
  });
});
