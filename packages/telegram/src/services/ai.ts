// import { pipeline } from "@xenova/transformers";
import fs from "fs";
import path from "path";
import { exec } from "child_process";
import util from "util";

const execAsync = util.promisify(exec);

// Simple regex fallback for NLU
export function parseWorkTextRegex(text: string): any {
  const lower = text.toLowerCase();
  const trees = lower.match(/(\d+)\s*trees?/);
  const weeds = lower.match(/(\d+)\s*(kg|lbs)?\s*weeds?/);
  
  const tasks = [];
  if (trees) {
    tasks.push({ type: "planting", species: "tree", count: parseInt(trees[1]) });
  }
  if (weeds) {
    tasks.push({ type: "weeding", species: "weed", amount: parseInt(weeds[1]), unit: weeds[2] || "kg" });
  }

  return {
    tasks,
    notes: text,
    date: new Date().toISOString().split("T")[0]
  };
}

export class AIService {
  private transcriber: any;
  private nlu: any;

  constructor() {
    // Lazy load models
  }

  async transcribe(audioPath: string): Promise<string> {
    if (!this.transcriber) {
      console.log("Loading Whisper model...");
      try {
        const { pipeline } = await import("@xenova/transformers");
        this.transcriber = await pipeline("automatic-speech-recognition", "Xenova/whisper-tiny.en");
      } catch (error) {
        console.error("Failed to load Whisper model:", error);
        throw new Error("Voice processing is currently unavailable due to missing dependencies (sharp). Please use text input.");
      }
    }

    // Convert audio to wav if needed (transformers.js expects wav usually or can handle some formats)
    // For now assuming we might need ffmpeg to convert OGG (Telegram voice) to WAV
    const wavPath = audioPath.replace(".ogg", ".wav");
    if (audioPath.endsWith(".ogg")) {
      await execAsync(`ffmpeg -i ${audioPath} -ar 16000 -ac 1 -c:a pcm_s16le ${wavPath}`);
      audioPath = wavPath;
    }

    const result = await this.transcriber(audioPath);
    return result.text;
  }

  async parseWorkText(text: string): Promise<any> {
    // Fallback to regex for now as Flan-T5 might be heavy or need specific prompting
    // We can enable Flan-T5 later if needed
    return parseWorkTextRegex(text);
  }
}

export const ai = new AIService();
