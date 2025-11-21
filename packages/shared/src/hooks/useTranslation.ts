import { useContext, useEffect, useState } from "react";
import { AppContext } from "../providers/app";
import { browserTranslator } from "../modules/translation/browser-translator";

type TranslatableValue = string | string[] | Record<string, unknown> | null | undefined;

export function useTranslation<T extends TranslatableValue>(
  content: T,
  sourceLang = "en"
): {
  translated: T;
  isTranslating: boolean;
  isSupported: boolean;
} {
  const { locale } = useContext(AppContext);
  const [translated, setTranslated] = useState<T>(content);
  const [isTranslating, setIsTranslating] = useState(false);

  useEffect(() => {
    // Skip if same language or no translation API
    if (locale === sourceLang) {
      setTranslated(content);
      return;
    }

    if (!browserTranslator.isSupported) {
      console.debug(
        `⚠️ [Translation] Skipping translation - browser API not supported (locale: ${locale})`
      );
      setTranslated(content);
      return;
    }

    // Skip if content is null/undefined
    if (!content) {
      setTranslated(content);
      return;
    }

    const translateContent = async () => {
      setIsTranslating(true);
      console.debug(`🔄 [Translation] Translating content to ${locale}...`);

      try {
        const result = await translateValue(content, locale, sourceLang);
        setTranslated(result as T);
        console.debug(`✅ [Translation] Content translated to ${locale}`);
      } catch (error) {
        console.error(`❌ [Translation] Error translating to ${locale}:`, error);
        setTranslated(content); // Fallback to original
      } finally {
        setIsTranslating(false);
      }
    };

    translateContent();
  }, [content, locale, sourceLang]);

  return {
    translated,
    isTranslating,
    isSupported: browserTranslator.isSupported,
  };
}

/**
 * Recursively translate any value type
 */
async function translateValue(
  value: unknown,
  targetLang: string,
  sourceLang: string
): Promise<unknown> {
  // String - translate directly
  if (typeof value === "string") {
    const result = await browserTranslator.translate(value, targetLang, sourceLang);
    return result || value; // Fallback to original if translation fails
  }

  // Array - translate each item
  if (Array.isArray(value)) {
    return Promise.all(value.map((item) => translateValue(item, targetLang, sourceLang)));
  }

  // Object - translate each property
  if (typeof value === "object" && value !== null) {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      result[key] = await translateValue(val, targetLang, sourceLang);
    }
    return result;
  }

  // Other types (numbers, booleans, etc.) - return as-is
  return value;
}
