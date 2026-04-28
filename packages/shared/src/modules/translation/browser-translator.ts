import { logger } from "../app/logger";
import { translationCache } from "./db";

// Old API shape (window.translation)
type LegacyTranslatorAPI = {
  createTranslator: (config: {
    sourceLanguage: string;
    targetLanguage: string;
  }) => Promise<{ translate: (text: string) => Promise<string> }>;
  canTranslate?: (config: { sourceLanguage: string; targetLanguage: string }) => Promise<string>;
};

// New API shape (window.ai.translator)
type AITranslatorAPI = {
  create: (config: {
    sourceLanguage: string;
    targetLanguage: string;
  }) => Promise<{ translate: (text: string) => Promise<string> }>;
  capabilities?: () => Promise<{
    available: "readily" | "after-download" | "no";
    languagePairAvailable: (source: string, target: string) => "readily" | "after-download" | "no";
  }>;
};

type StableTranslatorAPI = {
  availability?: (config: {
    sourceLanguage: string;
    targetLanguage: string;
  }) => Promise<"available" | "downloadable" | "downloading" | "unavailable">;
  create: (config: {
    sourceLanguage: string;
    targetLanguage: string;
    monitor?: (monitor: EventTarget) => void;
  }) => Promise<{ translate: (text: string) => Promise<string> }>;
};

/** Chrome experimental AI API surface (self.ai) */
interface ExperimentalAI {
  ai: { translator: AITranslatorAPI };
}

/** Chrome stable built-in AI Translator API surface (self.Translator). */
interface StableTranslatorGlobal {
  Translator: StableTranslatorAPI;
}

/** Chrome experimental translation API surface (self.translation) */
interface ExperimentalTranslation {
  translation: LegacyTranslatorAPI;
}

class BrowserTranslator {
  private stableApi: StableTranslatorAPI | null = null;
  private legacyApi: LegacyTranslatorAPI | null = null;
  private aiApi: AITranslatorAPI | null = null;
  private translators: Map<string, { translate: (text: string) => Promise<string> }> = new Map();

  constructor() {
    // Check for the stable Translator API (Chrome 138+)
    if (typeof self !== "undefined" && "Translator" in self) {
      this.stableApi = (self as unknown as StableTranslatorGlobal).Translator;
    }
    // Check for new AI Translation API (Chrome 127+)
    else if (
      typeof self !== "undefined" &&
      "ai" in self &&
      "translator" in (self as ExperimentalAI).ai
    ) {
      this.aiApi = (self as unknown as ExperimentalAI).ai.translator;
    }
    // Check for Legacy Translation API (Chrome 125-126)
    else if (typeof self !== "undefined" && "translation" in self) {
      this.legacyApi = (self as unknown as ExperimentalTranslation).translation;
    } else {
      // Browser Translation API not available - silently fall back to English
      // Only log in debug mode to reduce console noise
      if (import.meta.env.DEV && import.meta.env.VITE_DEBUG_MODE === "true") {
        logger.warn(
          "[Translation] Browser Translation API not available. " +
            "Auto-translation requires Chrome 125+ or Edge 125+. " +
            "Content will display in English."
        );
      }
    }
  }

  get isSupported(): boolean {
    return this.stableApi !== null || this.aiApi !== null || this.legacyApi !== null;
  }

  private translatorKey(source: string, target: string): string {
    return `${source}_${target}`;
  }

  async translate(text: string, targetLang: string, sourceLang = "en"): Promise<string | null> {
    if (!this.isSupported) return null;

    // Skip empty strings
    if (!text || text.trim() === "") return text;

    // Check cache first
    const cached = await translationCache.get(text, sourceLang, targetLang);
    if (cached) return cached;

    try {
      // Get or create translator for this language pair
      const key = this.translatorKey(sourceLang, targetLang);
      let translator = this.translators.get(key);

      if (!translator) {
        // 1. Try stable Translator API
        if (this.stableApi) {
          if (this.stableApi.availability) {
            const availability = await this.stableApi.availability({
              sourceLanguage: sourceLang,
              targetLanguage: targetLang,
            });

            if (availability === "unavailable") {
              logger.warn(`[Translation] ${sourceLang} → ${targetLang} not supported by browser`);
              return null;
            }
          }

          translator = await this.stableApi.create({
            sourceLanguage: sourceLang,
            targetLanguage: targetLang,
          });
        }
        // 2. Try experimental AI API
        else if (this.aiApi) {
          // Check capabilities if available
          if (this.aiApi.capabilities) {
            const caps = await this.aiApi.capabilities();
            const availability = caps.languagePairAvailable(sourceLang, targetLang);

            if (availability === "no") {
              logger.warn(`[Translation] ${sourceLang} → ${targetLang} not supported by browser`);
              return null;
            }
          }

          translator = await this.aiApi.create({
            sourceLanguage: sourceLang,
            targetLanguage: targetLang,
          });
        }
        // 3. Try Legacy API
        else if (this.legacyApi) {
          // Check if translation is available
          if (this.legacyApi.canTranslate) {
            const availability = await this.legacyApi.canTranslate({
              sourceLanguage: sourceLang,
              targetLanguage: targetLang,
            });

            if (availability === "no") {
              logger.warn(`[Translation] ${sourceLang} → ${targetLang} not supported by browser`);
              return null;
            }
          }

          translator = await this.legacyApi.createTranslator({
            sourceLanguage: sourceLang,
            targetLanguage: targetLang,
          });
        }

        if (translator) {
          this.translators.set(key, translator);
        }
      }

      if (!translator) return null;

      const translated = await translator.translate(text);

      // Cache the result
      await translationCache.set(text, translated, sourceLang, targetLang);

      return translated;
    } catch (error) {
      logger.warn("[BrowserTranslator] Translation failed", { error });
      return null;
    }
  }

  /**
   * Batch translate (processes in parallel)
   */
  async translateBatch(
    texts: string[],
    targetLang: string,
    sourceLang = "en"
  ): Promise<(string | null)[]> {
    return Promise.all(texts.map((text) => this.translate(text, targetLang, sourceLang)));
  }
}

export const browserTranslator = new BrowserTranslator();
