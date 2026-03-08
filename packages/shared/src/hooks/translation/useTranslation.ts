import { useContext, useEffect, useState } from "react";
import { logger } from "../../modules/app/logger";
import { browserTranslator } from "../../modules/translation/browser-translator";
import { logger } from "../../modules/app/logger";
import { AppContext } from "../../providers/App";

type TranslatableValue =
  | string
  | string[]
  | Record<string, unknown>
  | Record<string, unknown>[]
  | null
  | undefined;

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
    let isMounted = true;

    // Skip if same language or no translation API
    if (locale === sourceLang) {
      setTranslated(content);
      return () => {
        isMounted = false;
      };
    }

    if (!browserTranslator.isSupported) {
      logger.debug("[Translation] Skipping - browser API not supported", { locale });
      setTranslated(content);
      return () => {
        isMounted = false;
      };
    }

    // Skip if content is null/undefined
    if (!content) {
      setTranslated(content);
      return () => {
        isMounted = false;
      };
    }

    const translateContent = async () => {
      if (!isMounted) return;
      setIsTranslating(true);
      logger.debug("[Translation] Translating content", { locale });

      try {
        const result = await translateValue(content, locale, sourceLang);
        if (!isMounted) return;
        setTranslated(result as T);
        logger.debug("[Translation] Content translated", { locale });
      } catch (error) {
        if (!isMounted) return;
        logger.error(`Translation to ${locale} failed`, { source: "useTranslation", error });
        setTranslated(content); // Fallback to original
      } finally {
        if (!isMounted) return;
        setIsTranslating(false);
      }
    };

    translateContent();

    return () => {
      isMounted = false;
    };
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
