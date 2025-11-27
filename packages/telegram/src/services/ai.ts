import { exec } from "child_process";
import util from "util";

const execAsync = util.promisify(exec);

// ============================================================================
// TYPES
// ============================================================================

export interface ParsedTask {
  type: "planting" | "weeding" | "maintenance" | "harvesting" | "other";
  species: string;
  count?: number;
  amount?: number;
  unit?: string;
}

export interface ParsedWorkData {
  tasks: ParsedTask[];
  notes: string;
  date: string;
}

// ============================================================================
// NLU PARSING (REGEX FALLBACK)
// ============================================================================

/**
 * Parses work text using regex patterns to extract structured task data.
 * This is a fallback/simple NLU implementation that handles common patterns.
 *
 * @param text - Raw text input from user (voice transcription or direct text)
 * @returns Structured work data with tasks, notes, and date
 *
 * @example
 * parseWorkTextRegex("I planted 5 trees today")
 * // => { tasks: [{ type: "planting", species: "tree", count: 5 }], notes: "I planted 5 trees today", date: "2024-01-15" }
 */
export function parseWorkTextRegex(text: string): ParsedWorkData {
  const lower = text.toLowerCase();
  const tasks: ParsedTask[] = [];

  // Match tree planting patterns: "planted 5 trees", "5 trees planted"
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

  // Match weeding patterns: "removed 10kg weeds", "weeded 5 lbs"
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
        unit: normalizeUnit(match[2]),
      });
      break;
    }
  }

  // Match general plant patterns: "planted 10 tomatoes"
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
 * Normalizes unit strings to a consistent format.
 */
function normalizeUnit(unit: string | undefined): string {
  if (!unit) return "kg";
  const lower = unit.toLowerCase();
  if (lower.startsWith("lb") || lower === "pounds") return "lbs";
  return "kg";
}

// ============================================================================
// AI SERVICE
// ============================================================================

type TranscriberPipeline = (audio: string) => Promise<{ text: string }>;

/**
 * AIService handles voice transcription (STT) and natural language understanding (NLU)
 * for processing user input in the Telegram bot.
 *
 * Features:
 * - Lazy-loaded Whisper model for speech-to-text
 * - Regex-based NLU fallback (can be upgraded to LLM-based)
 * - Automatic audio format conversion via ffmpeg
 *
 * @example
 * const text = await ai.transcribe("/path/to/voice.ogg");
 * const workData = await ai.parseWorkText(text);
 */
export class AIService {
  private transcriber: TranscriberPipeline | null = null;
  private modelLoading: Promise<TranscriberPipeline> | null = null;

  /**
   * Transcribes audio file to text using Whisper model.
   *
   * Note: Requires ffmpeg to be installed for OGG to WAV conversion.
   * The Whisper model is lazy-loaded on first use.
   *
   * @param audioPath - Path to the audio file (supports OGG, WAV)
   * @returns Transcribed text
   * @throws Error if transcription fails or dependencies are missing
   */
  async transcribe(audioPath: string): Promise<string> {
    const transcriber = await this.loadTranscriber();

    // Convert OGG to WAV if needed (Whisper works best with WAV)
    let processedPath = audioPath;
    if (audioPath.endsWith(".ogg")) {
      processedPath = audioPath.replace(".ogg", ".wav");
      try {
        // Escape paths for shell safety
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
   * Parses natural language text to extract structured work data.
   *
   * Currently uses regex-based parsing. Can be upgraded to use
   * an LLM for more sophisticated understanding.
   *
   * @param text - Raw text to parse
   * @returns Structured work data with tasks, notes, and date
   */
  async parseWorkText(text: string): Promise<ParsedWorkData> {
    // TODO: Consider upgrading to LLM-based parsing for better accuracy
    // Options: Flan-T5, Llama, or external API (OpenAI, Anthropic)
    return parseWorkTextRegex(text);
  }

  /**
   * Lazy-loads the Whisper transcriber model.
   * Uses singleton pattern to prevent multiple model loads.
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
        console.log("Whisper model loaded successfully.");
        return this.transcriber;
      } catch (error) {
        this.modelLoading = null; // Reset so we can retry
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

/** Singleton AI service instance */
export const ai = new AIService();
