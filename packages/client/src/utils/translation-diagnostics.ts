/**
 * Translation System Diagnostics
 *
 * Run this in browser console to check translation support:
 * import { runTranslationDiagnostics } from '@/utils/translation-diagnostics';
 * runTranslationDiagnostics();
 */

import { browserTranslator, translationCache } from "@green-goods/shared";

export async function runTranslationDiagnostics() {
  console.group("🌐 Translation System Diagnostics");

  // 1. Check browser API support
  console.log("1️⃣ Browser API Support:");
  console.log("   - isSupported:", browserTranslator.isSupported);

  const hasLegacy = "translation" in self;
  const hasAI = "ai" in self && "translator" in (self as any).ai;

  console.log("   - Has 'translation' (Legacy):", hasLegacy);
  console.log("   - Has 'ai.translator' (New):", hasAI);

  // Check Legacy API
  if (hasLegacy) {
    const api = (self as any).translation;
    console.log("   - Legacy API object:", api);

    if (api && api.canTranslate) {
      try {
        const canTranslateEs = await api.canTranslate({
          sourceLanguage: "en",
          targetLanguage: "es",
        });
        console.log("   - [Legacy] Can translate to Spanish:", canTranslateEs);
      } catch (err) {
        console.error("   - [Legacy] Error checking canTranslate:", err);
      }
    }
  }

  // Check New AI API
  if (hasAI) {
    const api = (self as any).ai.translator;
    console.log("   - AI API object:", api);

    if (api && api.capabilities) {
      try {
        const caps = await api.capabilities();
        console.log("   - [AI] Capabilities available:", caps.available);
        console.log("   - [AI] Can translate to Spanish:", caps.languagePairAvailable("en", "es"));
      } catch (err) {
        console.error("   - [AI] Error checking capabilities:", err);
      }
    }
  }

  // 2. Test a simple translation
  console.log("\n2️⃣ Testing Simple Translation:");
  try {
    const result = await browserTranslator.translate("Hello world", "es");
    console.log("   - Input: 'Hello world'");
    console.log("   - Output (Spanish):", result);
    console.log("   - Success:", result !== null);
  } catch (err) {
    console.error("   - Translation failed:", err);
  }

  // 3. Check cache
  console.log("\n3️⃣ Translation Cache:");
  try {
    const stats = await translationCache.getStats();
    console.log("   - Total cached:", stats.total);
    console.log("   - By language:", stats.byLanguage);
  } catch (err) {
    console.error("   - Cache stats failed:", err);
  }

  // 4. Check current locale
  console.log("\n4️⃣ Current Locale:");
  const storedLocale = localStorage.getItem("gg-language");
  console.log("   - Stored locale:", storedLocale);

  console.groupEnd();

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
  console.log("💡 Run checkTranslation() in console to diagnose translation system");
}
