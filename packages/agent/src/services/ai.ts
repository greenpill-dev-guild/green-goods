/**
 * AI Service (Whisper STT + Regex NLU)
 *
 * Direct AI operations. No interface abstraction.
 *
 * SECURITY: Uses execFile instead of exec to prevent command injection.
 * Audio paths are passed as arguments, not interpolated into a shell string.
 */

import { execFile } from "child_process";
import { readFileSync } from "fs";
import { promisify } from "util";
import type { ParsedTask, ParsedWorkData } from "../types";
import { loggers } from "./logger";

const execFileAsync = promisify(execFile);
const log = loggers.ai;

type TranscriberPipeline = (audio: string | Float32Array) => Promise<{ text: string }>;

// ============================================================================
// AI CLASS
// ============================================================================

class AI {
  private transcriber: TranscriberPipeline | null = null;
  private modelLoading: Promise<TranscriberPipeline> | null = null;
  private modelLoaded = false;

  /**
   * Transcribe audio file to text using Whisper
   */
  async transcribe(audioPath: string): Promise<string> {
    const transcriber = await this.loadTranscriber();

    // Convert OGG to WAV if needed
    // SECURITY: Uses execFile with argument array to prevent command injection
    let processedPath = audioPath;
    if (audioPath.endsWith(".ogg")) {
      processedPath = audioPath.replace(".ogg", ".wav");
      try {
        await execFileAsync("ffmpeg", [
          "-y",
          "-i",
          audioPath,
          "-ar",
          "16000",
          "-ac",
          "1",
          "-c:a",
          "pcm_s16le",
          processedPath,
        ]);
      } catch (error) {
        throw new Error(
          `Failed to convert audio: ${error instanceof Error ? error.message : "Unknown error"}. Ensure ffmpeg is installed.`
        );
      }
    }

    const audioInput = processedPath.endsWith(".wav")
      ? readPcm16WavAsFloat32(processedPath)
      : processedPath;
    const result = await transcriber(audioInput);
    return result.text;
  }

  /**
   * Parse natural language text to extract structured work data
   */
  parseWorkText(text: string, _locale?: string): ParsedWorkData {
    return this.parseWorkTextRegex(text);
  }

  /**
   * Check if model is loaded and ready
   */
  isModelLoaded(): boolean {
    return this.modelLoaded;
  }

  private parseWorkTextRegex(text: string): ParsedWorkData {
    const lower = text.toLowerCase();
    const tasks: ParsedTask[] = [];

    // Tree planting patterns
    const treePatterns = [
      /planted?\s*(\d+)\s*trees?/i,
      /(\d+)\s*trees?\s*planted/i,
      /(\d+)\s*trees?/i,
      /plant(?:é|e|ei|ou|ado|ada|ados|adas)?\s*(\d+)\s*(?:árboles|arboles|árvores|arvores)/iu,
      /(\d+)\s*(?:árboles|arboles|árvores|arvores)\s*plant(?:ados?|adas?)?/iu,
    ];

    for (const pattern of treePatterns) {
      const match = lower.match(pattern);
      if (match) {
        tasks.push({
          type: "planting",
          species: "tree",
          count: parseInt(match[1], 10),
        });
        break;
      }
    }

    // Weeding patterns
    const weedPatterns = [
      /(\d+)\s*(kg|lbs?|pounds?)?\s*(?:of\s*)?weeds?/i,
      /weeded?\s*(\d+)\s*(kg|lbs?|pounds?)?/i,
      /removed?\s*(\d+)\s*(kg|lbs?|pounds?)?\s*(?:of\s*)?weeds?/i,
      /(\d+)\s*(kg|lbs?|pounds?|libras?)?\s*(?:de\s*)?(?:maleza|hierbas?|ervas?\s+daninhas|daninhas)/iu,
      /(?:retir(?:é|e|ei|ou)|remov(?:í|i|ei|eu)|saqu(?:é|e|ei|ou))\s*(\d+)\s*(kg|lbs?|pounds?|libras?)?\s*(?:de\s*)?(?:maleza|hierbas?|ervas?\s+daninhas|daninhas)/iu,
    ];

    for (const pattern of weedPatterns) {
      const match = lower.match(pattern);
      if (match) {
        tasks.push({
          type: "weeding",
          species: "weed",
          amount: parseInt(match[1], 10),
          unit: this.normalizeUnit(match[2]),
        });
        break;
      }
    }

    // General plant patterns
    const plantMatch =
      lower.match(/planted?\s*(\d+)\s*(\w+)/i) ??
      lower.match(/plant(?:é|e|ei|ou|ado|ada|ados|adas)?\s*(\d+)\s*([\p{L}\p{M}-]+)/iu);
    if (plantMatch && !tasks.some((t) => t.type === "planting")) {
      tasks.push({
        type: "planting",
        species: plantMatch[2],
        count: parseInt(plantMatch[1], 10),
      });
    }

    return {
      tasks,
      notes: text,
      date: new Date().toISOString().split("T")[0],
    };
  }

  private normalizeUnit(unit: string | undefined): string {
    if (!unit) return "kg";
    const lower = unit.toLowerCase();
    if (lower.startsWith("lb") || lower === "pounds") return "lbs";
    if (lower.startsWith("libra")) return "lbs";
    return "kg";
  }

  private async loadTranscriber(): Promise<TranscriberPipeline> {
    if (this.transcriber) return this.transcriber;

    if (this.modelLoading) return this.modelLoading;

    this.modelLoading = (async () => {
      log.info("Loading Whisper model (may take a moment on first run)");
      try {
        const { pipeline } = await import("@xenova/transformers");
        const transcriber = await pipeline(
          "automatic-speech-recognition",
          "Xenova/whisper-tiny.en"
        );
        this.transcriber = transcriber as TranscriberPipeline;
        this.modelLoaded = true;
        log.info("Whisper model loaded successfully");
        return this.transcriber;
      } catch (error) {
        this.modelLoading = null;
        const message = error instanceof Error ? error.message : "Unknown error";
        log.error({ err: error }, "Failed to load Whisper model");
        throw new Error(`Voice processing unavailable: ${message}. Please use text input instead.`);
      }
    })();

    return this.modelLoading;
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

let _ai: AI | null = null;

export function initAI(): AI {
  if (!_ai) {
    _ai = new AI();
  }
  return _ai;
}

export function getAI(): AI {
  if (!_ai) {
    throw new Error("AI not initialized. Call initAI() first.");
  }
  return _ai;
}

// Re-export convenience functions
export const transcribe = (audioPath: string) => getAI().transcribe(audioPath);
export const parseWorkText = (text: string, locale?: string) => getAI().parseWorkText(text, locale);
export const isAIModelLoaded = () => _ai?.isModelLoaded() ?? false;

function readPcm16WavAsFloat32(filePath: string): Float32Array {
  const buffer = readFileSync(filePath);
  if (buffer.toString("ascii", 0, 4) !== "RIFF" || buffer.toString("ascii", 8, 12) !== "WAVE") {
    throw new Error("Unsupported audio format: expected RIFF/WAVE PCM");
  }

  let audioFormat: number | null = null;
  let channels: number | null = null;
  let sampleRate: number | null = null;
  let bitsPerSample: number | null = null;
  let dataStart = 0;
  let dataSize = 0;

  let offset = 12;
  while (offset + 8 <= buffer.length) {
    const chunkId = buffer.toString("ascii", offset, offset + 4);
    const chunkSize = buffer.readUInt32LE(offset + 4);
    const chunkStart = offset + 8;

    if (chunkStart + chunkSize > buffer.length) {
      throw new Error("Invalid WAV file: chunk exceeds file size");
    }

    if (chunkId === "fmt ") {
      audioFormat = buffer.readUInt16LE(chunkStart);
      channels = buffer.readUInt16LE(chunkStart + 2);
      sampleRate = buffer.readUInt32LE(chunkStart + 4);
      bitsPerSample = buffer.readUInt16LE(chunkStart + 14);
    } else if (chunkId === "data") {
      dataStart = chunkStart;
      dataSize = chunkSize;
    }

    offset = chunkStart + chunkSize + (chunkSize % 2);
  }

  if (audioFormat !== 1 || channels !== 1 || sampleRate !== 16000 || bitsPerSample !== 16) {
    throw new Error("Unsupported WAV encoding: expected mono 16 kHz PCM16 audio");
  }
  if (dataStart === 0 || dataSize === 0) {
    throw new Error("Invalid WAV file: missing audio data");
  }

  const sampleCount = Math.floor(dataSize / 2);
  const samples = new Float32Array(sampleCount);
  for (let index = 0; index < sampleCount; index += 1) {
    samples[index] = buffer.readInt16LE(dataStart + index * 2) / 32768;
  }
  return samples;
}
