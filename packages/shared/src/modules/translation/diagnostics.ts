/**
 * Translation System Diagnostics
 *
 * Run this in browser console to check translation support:
 * import { runTranslationDiagnostics } from '@green-goods/shared';
 * runTranslationDiagnostics();
 */

import { logger } from "../app/logger";
import { browserTranslator } from "./browser-translator";
import { translationCache } from "./db";

export async function runTranslationDiagnostics() {
  const hasLegacy = "translation" in self;
  const hasAI = "ai" in self && "translator" in (self as any).ai;

  // 1. Check browser API support
  logger.info("[Translation Diagnostics] Browser API Support", {
    isSupported: browserTranslator.isSupported,
    hasLegacyAPI: hasLegacy,
    hasAIAPI: hasAI,
  });

  // Check Legacy API
  if (hasLegacy) {
    const api = (self as any).translation;
    if (api && api.canTranslate) {
      try {
        const canTranslateEs = await api.canTranslate({
          sourceLanguage: "en",
          targetLanguage: "es",
        });
        logger.info("[Translation Diagnostics] Legacy API", {
          canTranslateToSpanish: canTranslateEs,
        });
      } catch (err) {
        logger.error("[Translation Diagnostics] Legacy API canTranslate check failed", {
          error: err,
        });
      }
    }
  }

  // Check New AI API
  if (hasAI) {
    const api = (self as any).ai.translator;
    if (api && api.capabilities) {
      try {
        const caps = await api.capabilities();
        logger.info("[Translation Diagnostics] AI API", {
          available: caps.available,
          canTranslateToSpanish: caps.languagePairAvailable("en", "es"),
        });
      } catch (err) {
        logger.error("[Translation Diagnostics] AI API capabilities check failed", { error: err });
      }
    }
  }

  // 2. Test a simple translation
  try {
    const result = await browserTranslator.translate("Hello world", "es");
    logger.info("[Translation Diagnostics] Simple translation test", {
      input: "Hello world",
      output: result,
      success: result !== null,
    });
  } catch (err) {
    logger.error("[Translation Diagnostics] Translation test failed", { error: err });
  }

  // 3. Check cache
  try {
    const stats = await translationCache.getStats();
    logger.info("[Translation Diagnostics] Cache stats", {
      total: stats.total,
      byLanguage: stats.byLanguage,
    });
  } catch (err) {
    logger.error("[Translation Diagnostics] Cache stats failed", { error: err });
  }

  // 4. Check current locale
  const storedLocale = localStorage.getItem("gg-language");
  logger.info("[Translation Diagnostics] Current locale", { storedLocale });

  // Return diagnostic info
  return {
    isSupported: browserTranslator.isSupported,
    hasAPI: "translation" in self,
    locale: storedLocale,
  };
}

/**
 * Quick check in console
 */
if (typeof window !== "undefined") {
  (window as any).checkTranslation = runTranslationDiagnostics;
  logger.info("[Translation] Run checkTranslation() in console to diagnose translation system");
}
