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

class BrowserTranslator {
  private legacyApi: LegacyTranslatorAPI | null = null;
  private aiApi: AITranslatorAPI | null = null;
  private translators: Map<string, { translate: (text: string) => Promise<string> }> = new Map();

  constructor() {
    // Check for new AI Translation API (Chrome 127+)
    if (typeof self !== "undefined" && "ai" in self && "translator" in (self as any).ai) {
      this.aiApi = (self as any).ai.translator;
      console.log("🌐 [Translation] Chrome AI Translation API detected (window.ai.translator)");
    }
    // Check for Legacy Translation API (Chrome 125-126)
    else if (typeof self !== "undefined" && "translation" in self) {
      this.legacyApi = (self as unknown as { translation: LegacyTranslatorAPI }).translation;
      console.log("🌐 [Translation] Legacy Browser Translation API detected (window.translation)");
    } else {
      console.warn(
        "⚠️ [Translation] Browser Translation API not available. " +
          "Auto-translation requires Chrome 125+ or Edge 125+. " +
          "Content will display in English."
      );
    }
  }

  get isSupported(): boolean {
    return this.aiApi !== null || this.legacyApi !== null;
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
        // 1. Try New AI API
        if (this.aiApi) {
          // Check capabilities if available
          if (this.aiApi.capabilities) {
            const caps = await this.aiApi.capabilities();
            const availability = caps.languagePairAvailable(sourceLang, targetLang);

            if (availability === "no") {
              console.warn(
                `⚠️ [Translation] ${sourceLang} → ${targetLang} not supported by browser`
              );
              return null;
            }

            if (availability === "after-download") {
              console.log(`⏳ [Translation] Downloading language model for ${targetLang}...`);
            }
          }

          translator = await this.aiApi.create({
            sourceLanguage: sourceLang,
            targetLanguage: targetLang,
          });
        }
        // 2. Try Legacy API
        else if (this.legacyApi) {
          // Check if translation is available
          if (this.legacyApi.canTranslate) {
            const availability = await this.legacyApi.canTranslate({
              sourceLanguage: sourceLang,
              targetLanguage: targetLang,
            });

            if (availability === "no") {
              console.warn(
                `⚠️ [Translation] ${sourceLang} → ${targetLang} not supported by browser`
              );
              return null;
            }

            if (availability === "after-download") {
              console.log(`⏳ [Translation] Downloading language model for ${targetLang}...`);
            }
          }

          translator = await this.legacyApi.createTranslator({
            sourceLanguage: sourceLang,
            targetLanguage: targetLang,
          });
        }

        if (translator) {
          this.translators.set(key, translator);
          console.log(`✅ [Translation] Translator ready: ${sourceLang} → ${targetLang}`);
        }
      }

      if (!translator) return null;

      const translated = await translator.translate(text);

      // Cache the result
      await translationCache.set(text, translated, sourceLang, targetLang);

      return translated;
    } catch (error) {
      console.warn("[BrowserTranslator] Translation failed:", error);
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
