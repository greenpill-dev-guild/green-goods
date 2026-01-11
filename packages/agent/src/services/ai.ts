/**
 * AI Service (Whisper STT + Regex NLU)
 *
 * Direct AI operations. No interface abstraction.
 */

import { exec } from "child_process";
import { promisify } from "util";
import type { ParsedTask, ParsedWorkData } from "../types";
import { loggers } from "./logger";

const execAsync = promisify(exec);
const log = loggers.ai;

type TranscriberPipeline = (audio: string) => Promise<{ text: string }>;

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
    let processedPath = audioPath;
    if (audioPath.endsWith(".ogg")) {
      processedPath = audioPath.replace(".ogg", ".wav");
      try {
        const escapedInput = audioPath.replace(/'/g, "'\\''");
        const escapedOutput = processedPath.replace(/'/g, "'\\''");
        await execAsync(
          `ffmpeg -y -i '${escapedInput}' -ar 16000 -ac 1 -c:a pcm_s16le '${escapedOutput}'`
        );
      } catch (error) {
        throw new Error(
          `Failed to convert audio: ${error instanceof Error ? error.message : "Unknown error"}. Ensure ffmpeg is installed.`
        );
      }
    }

    const result = await transcriber(processedPath);
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
    const plantMatch = lower.match(/planted?\s*(\d+)\s*(\w+)/i);
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
