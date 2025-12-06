/**
 * AI Port - Interface for AI/ML services
 *
 * This port defines the contract for speech-to-text and NLU services.
 * Implementations can use local models (Whisper) or cloud APIs.
 */

/**
 * Parsed task from NLU
 */
export interface ParsedTask {
  type: "planting" | "weeding" | "maintenance" | "harvesting" | "other";
  species: string;
  count?: number;
  amount?: number;
  unit?: string;
}

/**
 * Structured work data from NLU parsing
 */
export interface ParsedWorkData {
  tasks: ParsedTask[];
  notes: string;
  date: string;
}

/**
 * AI port interface
 */
export interface AIPort {
  /**
   * Transcribe audio file to text.
   *
   * @param audioPath - Path to the audio file (OGG, WAV, etc.)
   * @returns Transcribed text
   * @throws Error if transcription fails
   */
  transcribe(audioPath: string): Promise<string>;

  /**
   * Parse natural language text to extract structured work data.
   *
   * @param text - Raw text to parse
   * @param locale - Optional locale for language-specific parsing
   * @returns Structured work data
   */
  parseWorkText(text: string, locale?: string): Promise<ParsedWorkData>;

  /**
   * Check if the AI model is loaded and ready.
   */
  isModelLoaded(): boolean;
}
