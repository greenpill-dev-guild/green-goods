import type { Locale } from "@green-goods/shared/providers/App";

/** Shared still owns locale fallback; this importer changes only the payload. */
export async function importPublicLocaleCatalogue(locale: Locale) {
  switch (locale) {
    case "es":
      return { locale, messages: (await import("virtual:green-goods-public-locale/es")).default };
    case "pt":
      return { locale, messages: (await import("virtual:green-goods-public-locale/pt")).default };
    default:
      return {
        locale: "en" as const,
        messages: (await import("virtual:green-goods-public-locale/en")).default,
      };
  }
}
