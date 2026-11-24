/**
 * The app's locale catalogues and the copy for the install toast.
 *
 * English rides in the critical shell; Spanish and Portuguese arrive with the
 * offline-ready tier an installed app fetches straight away. Both facts live
 * here rather than in the provider so the provider stays about lifecycle.
 *
 * @module modules/app/locale-messages
 */

import { logger } from "./logger";

export const supportedLanguages = ["en", "pt", "es"] as const;
export type Locale = (typeof supportedLanguages)[number];
/** A catalogue together with the language its copy is written in. */
export interface LocaleCatalogue {
  locale: Locale;
  messages: Record<string, string>;
}

/**
 * The language a reader asks for: the one they stored, else the first of their browser's
 * languages with a catalogue, else English. A stored language without a catalogue reads English
 * rather than the browser's. The loading screen in the client's index.html makes the same choice
 * before the app loads, and the app must not contradict it.
 */
export function resolveRequestedLocale(
  stored: string | null,
  browserLanguages: readonly string[]
): Locale {
  for (const candidate of stored ? [stored] : browserLanguages) {
    const tag = String(candidate ?? "")
      .toLowerCase()
      .split("-")[0];
    const locale = supportedLanguages.find((supported) => supported === tag);
    if (locale) return locale;
  }
  return "en";
}

const LANGUAGE_KEY = "gg-language";
/** The App, the Hub and the website share this parent domain, and so one language choice. */
const SHARED_LANGUAGE_DOMAIN = "greengoods.app";
const LANGUAGE_COOKIE_MAX_AGE_SECONDS = 400 * 24 * 60 * 60;

function sharedCookieDomain(hostname: string): string | null {
  return hostname === SHARED_LANGUAGE_DOMAIN || hostname.endsWith(`.${SHARED_LANGUAGE_DOMAIN}`)
    ? SHARED_LANGUAGE_DOMAIN
    : null;
}

function readLanguageCookie(): string | null {
  for (const part of document.cookie.split(";")) {
    const [name, ...value] = part.trim().split("=");
    if (name === LANGUAGE_KEY) return decodeURIComponent(value.join("=")) || null;
  }
  return null;
}

/**
 * The language the reader chose on any Green Goods site of this browser (PRD-1493). Each site
 * keeps its choice in its own storage, which no other site can read, so a choice also goes into a
 * cookie on the shared parent domain: one made in the App opens the Hub in it, and the reverse.
 * The cookie wins, as the latest choice on any site, and is copied into this site's storage,
 * which the loading screens read before the app runs. Storage the browser blocks reads as none.
 */
export function readStoredLanguage(): string | null {
  let shared: string | null = null;
  let own: string | null = null;
  try {
    shared = readLanguageCookie();
  } catch {
    // Cookies can be blocked; this site's own choice still applies.
  }
  try {
    own = window.localStorage.getItem(LANGUAGE_KEY);
    if (shared && shared !== own) window.localStorage.setItem(LANGUAGE_KEY, shared);
  } catch {
    // Storage can be blocked; the shared choice still applies.
  }
  // A choice made before the cookie existed lives in this site's storage only: share it.
  const ownLocale = supportedLanguages.find((locale) => locale === own);
  if (!shared && ownLocale) writeLanguageCookie(ownLocale);
  return shared ?? own;
}

/** Keep the reader's choice for this site and, on a Green Goods domain, for the others. */
export function storeLanguage(locale: Locale): void {
  try {
    window.localStorage.setItem(LANGUAGE_KEY, locale);
  } catch {
    // Storage can be blocked; the choice holds for this visit.
  }
  writeLanguageCookie(locale);
}

function writeLanguageCookie(locale: Locale): void {
  try {
    const domain = sharedCookieDomain(window.location.hostname);
    const attributes = [
      `${LANGUAGE_KEY}=${encodeURIComponent(locale)}`,
      "Path=/",
      `Max-Age=${LANGUAGE_COOKIE_MAX_AGE_SECONDS}`,
      "SameSite=Lax",
      ...(domain ? [`Domain=${domain}`] : []),
      ...(window.location.protocol === "https:" ? ["Secure"] : []),
    ];
    document.cookie = attributes.join("; ");
  } catch {
    // Cookies can be blocked; this site still keeps the choice.
  }
}

async function importLocaleCatalogue(locale: Locale): Promise<LocaleCatalogue> {
  switch (locale) {
    case "es":
      return { locale, messages: (await import("../../i18n/es.json")).default };
    case "pt":
      return { locale, messages: (await import("../../i18n/pt.json")).default };
    default:
      return { locale: "en", messages: (await import("../../i18n/en.json")).default };
  }
}

/**
 * A reader whose locale has not landed yet reads English rather than an empty
 * catalogue, and the next load tries their locale again. The catalogue says
 * which language it came back in, so the page can declare the one on screen.
 */
export async function loadLocaleCatalogue(
  locale: Locale,
  importCatalogue = importLocaleCatalogue
): Promise<LocaleCatalogue> {
  try {
    return await importCatalogue(locale);
  } catch (error) {
    if (locale === "en") throw error;
    logger.warn("[App] Locale messages unavailable; falling back to English", { locale, error });
    return importCatalogue("en");
  }
}

/**
 * Installing is the moment the app stops being a page, so it is also when the
 * offline-ready shell tier is worth fetching. The download itself stays
 * invisible — someone browsing the public site should never see it — and one
 * toast, shown only to the person who just installed, is where it surfaces.
 */
export type InstallToastStage = "installed" | "preparing" | "offlineReady";

export const installToastIds: Record<InstallToastStage, { title: string; message: string }> = {
  installed: {
    title: "app.toast.install.success.title",
    message: "app.toast.install.success.message",
  },
  preparing: {
    title: "app.toast.install.preparing.title",
    message: "app.toast.install.preparing.message",
  },
  offlineReady: {
    title: "app.toast.install.offlineReady.title",
    message: "app.toast.install.offlineReady.message",
  },
};

/** Read when the catalogue itself is what has not arrived yet. */
export const installToastFallbacks: Record<
  Locale,
  Record<InstallToastStage, { title: string; message: string }>
> = {
  en: {
    installed: { title: "App installed", message: "Green Goods is ready from your home screen." },
    preparing: { title: "App installed", message: "Getting it ready to work offline." },
    offlineReady: {
      title: "Ready to work offline",
      message: "You can add work without a signal.",
    },
  },
  es: {
    installed: {
      title: "App instalada",
      message: "Green Goods está lista desde tu pantalla de inicio.",
    },
    preparing: { title: "App instalada", message: "Preparándola para funcionar sin conexión." },
    offlineReady: {
      title: "Lista para usar sin conexión",
      message: "Puedes registrar trabajo sin señal.",
    },
  },
  pt: {
    installed: { title: "App instalada", message: "O Green Goods está pronto na tela inicial." },
    preparing: { title: "App instalada", message: "Preparando para funcionar sem conexão." },
    offlineReady: {
      title: "Pronto para usar sem conexão",
      message: "Você pode registrar trabalho sem sinal.",
    },
  },
};
