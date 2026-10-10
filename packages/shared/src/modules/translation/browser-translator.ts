import { logger } from "../app/logger";
import { translationCache, type TranslationCache } from "./db";

interface TranslationSession {
  translate(text: string): Promise<string>;
}

export interface Translator {
  readonly isSupported: boolean;
  translate(text: string, targetLang: string, sourceLang?: string): Promise<string | null>;
  translateBatch(
    texts: string[],
    targetLang: string,
    sourceLang?: string
  ): Promise<(string | null)[]>;
}

export interface LegacyTranslatorApi {
  createTranslator(config: {
    sourceLanguage: string;
    targetLanguage: string;
  }): Promise<TranslationSession>;
  canTranslate?(config: { sourceLanguage: string; targetLanguage: string }): Promise<string>;
}

export interface AiTranslatorApi {
  create(config: { sourceLanguage: string; targetLanguage: string }): Promise<TranslationSession>;
  capabilities?(): Promise<{
    available: "readily" | "after-download" | "no";
    languagePairAvailable(source: string, target: string): "readily" | "after-download" | "no";
  }>;
}

export interface StableTranslatorApi {
  availability?(config: {
    sourceLanguage: string;
    targetLanguage: string;
  }): Promise<"available" | "downloadable" | "downloading" | "unavailable">;
  create(config: {
    sourceLanguage: string;
    targetLanguage: string;
    monitor?: (monitor: EventTarget) => void;
  }): Promise<TranslationSession>;
}

export type DetectedTranslatorApi =
  | { kind: "stable"; api: StableTranslatorApi }
  | { kind: "ai"; api: AiTranslatorApi }
  | { kind: "legacy"; api: LegacyTranslatorApi }
  | { kind: "unsupported" };

interface TranslationGlobal {
  Translator?: StableTranslatorApi;
  ai?: { translator?: AiTranslatorApi };
  translation?: LegacyTranslatorApi;
}

export function detectTranslatorApi(root: unknown): DetectedTranslatorApi {
  if (!root || (typeof root !== "object" && typeof root !== "function")) {
    return { kind: "unsupported" };
  }
  const candidate = root as TranslationGlobal;
  if (candidate.Translator && typeof candidate.Translator.create === "function") {
    return { kind: "stable", api: candidate.Translator };
  }
  if (candidate.ai?.translator && typeof candidate.ai.translator.create === "function") {
    return { kind: "ai", api: candidate.ai.translator };
  }
  if (candidate.translation && typeof candidate.translation.createTranslator === "function") {
    return { kind: "legacy", api: candidate.translation };
  }
  return { kind: "unsupported" };
}

async function createSession(
  detected: DetectedTranslatorApi,
  sourceLanguage: string,
  targetLanguage: string
): Promise<TranslationSession | null> {
  const config = { sourceLanguage, targetLanguage };
  if (detected.kind === "stable") {
    const availability = await detected.api.availability?.(config);
    if (availability === "unavailable") return null;
    return detected.api.create(config);
  }
  if (detected.kind === "ai") {
    const capabilities = await detected.api.capabilities?.();
    if (capabilities?.languagePairAvailable(sourceLanguage, targetLanguage) === "no") return null;
    return detected.api.create(config);
  }
  if (detected.kind === "legacy") {
    const availability = await detected.api.canTranslate?.(config);
    if (availability === "no") return null;
    return detected.api.createTranslator(config);
  }
  return null;
}

export function createBrowserTranslator({
  api = detectTranslatorApi(globalThis),
  cache = translationCache,
}: {
  api?: DetectedTranslatorApi;
  cache?: TranslationCache;
} = {}): Translator {
  const sessions = new Map<string, Promise<TranslationSession | null>>();

  const translate = async (
    text: string,
    targetLang: string,
    sourceLang = "en"
  ): Promise<string | null> => {
    if (api.kind === "unsupported") return null;
    if (!text || text.trim() === "") return text;
    const cached = await cache.get(text, sourceLang, targetLang);
    if (cached) return cached;

    try {
      const key = `${sourceLang}_${targetLang}`;
      let sessionPromise = sessions.get(key);
      if (!sessionPromise) {
        sessionPromise = createSession(api, sourceLang, targetLang);
        sessions.set(key, sessionPromise);
      }
      const session = await sessionPromise;
      if (!session) {
        logger.warn(`[Translation] ${sourceLang} → ${targetLang} not supported by browser`);
        return null;
      }
      const translated = await session.translate(text);
      await cache.set(text, translated, sourceLang, targetLang);
      return translated;
    } catch (error) {
      logger.warn("[BrowserTranslator] Translation failed", { error });
      return null;
    }
  };

  return {
    isSupported: api.kind !== "unsupported",
    translate,
    translateBatch: (texts, targetLang, sourceLang = "en") =>
      Promise.all(texts.map((text) => translate(text, targetLang, sourceLang))),
  };
}

export const browserTranslator = createBrowserTranslator();
