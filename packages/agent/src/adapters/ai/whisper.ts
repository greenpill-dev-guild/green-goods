/**
 * Whisper AI Adapter
 *
 * Implements AIPort using local Whisper model for STT
 * and regex-based NLU for parsing work descriptions.
 */

import { exec } from "child_process";
import { promisify } from "util";
import type { AIPort, ParsedWorkData, ParsedTask } from "../../ports/ai";

const execAsync = promisify(exec);

/**
 * Type for the Whisper transcriber pipeline
 */
type TranscriberPipeline = (audio: string) => Promise<{ text: string }>;

/**
 * Whisper AI implementation of AIPort
 */
export class WhisperAI implements AIPort {
  private transcriber: TranscriberPipeline | null = null;
  private modelLoading: Promise<TranscriberPipeline> | null = null;
  private modelLoaded = false;

  /**
   * Transcribe audio file to text using Whisper model.
   */
  async transcribe(audioPath: string): Promise<string> {
    const transcriber = await this.loadTranscriber();

    // Convert OGG to WAV if needed (Whisper works best with WAV)
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
   * Parse natural language text to extract structured work data.
   */
  async parseWorkText(text: string, _locale?: string): Promise<ParsedWorkData> {
    // TODO: Add LLM-based parsing for better accuracy
    // For now, use regex-based parsing
    return this.parseWorkTextRegex(text);
  }

  /**
   * Check if the AI model is loaded and ready.
   */
  isModelLoaded(): boolean {
    return this.modelLoaded;
  }

  /**
   * Parse work text using regex patterns.
   */
  private parseWorkTextRegex(text: string): ParsedWorkData {
    const lower = text.toLowerCase();
    const tasks: ParsedTask[] = [];

    // Match tree planting patterns
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

    // Match weeding patterns
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

    // Match general plant patterns
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

  /**
   * Normalize unit strings to a consistent format.
   */
  private normalizeUnit(unit: string | undefined): string {
    if (!unit) return "kg";
    const lower = unit.toLowerCase();
    if (lower.startsWith("lb") || lower === "pounds") return "lbs";
    return "kg";
  }

  /**
   * Lazy-load the Whisper transcriber model.
   */
  private async loadTranscriber(): Promise<TranscriberPipeline> {
    if (this.transcriber) {
      return this.transcriber;
    }

    // Prevent multiple concurrent model loads
    if (this.modelLoading) {
      return this.modelLoading;
    }

    this.modelLoading = (async () => {
      console.log("Loading Whisper model (this may take a moment on first run)...");
      try {
        const { pipeline } = await import("@xenova/transformers");
        const transcriber = await pipeline(
          "automatic-speech-recognition",
          "Xenova/whisper-tiny.en"
        );
        this.transcriber = transcriber as TranscriberPipeline;
        this.modelLoaded = true;
        console.log("Whisper model loaded successfully.");
        return this.transcriber;
      } catch (error) {
        this.modelLoading = null;
        const message =
          error instanceof Error ? error.message : "Unknown error";
        console.error("Failed to load Whisper model:", message);
        throw new Error(
          `Voice processing unavailable: ${message}. Please use text input instead.`
        );
      }
    })();

    return this.modelLoading;
  }
}

