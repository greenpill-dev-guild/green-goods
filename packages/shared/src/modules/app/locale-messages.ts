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
export type LocaleMessages = Record<string, string>;

async function importLocaleMessages(locale: Locale): Promise<LocaleMessages> {
  switch (locale) {
    case "es":
      return (await import("../../i18n/es.json")).default;
    case "pt":
      return (await import("../../i18n/pt.json")).default;
    default:
      return (await import("../../i18n/en.json")).default;
  }
}

/**
 * A reader whose locale has not landed yet reads English rather than an empty
 * catalogue, and the next load tries their locale again.
 */
export async function loadLocaleMessages(locale: Locale): Promise<LocaleMessages> {
  try {
    return await importLocaleMessages(locale);
  } catch (error) {
    if (locale === "en") throw error;
    logger.warn("[App] Locale messages unavailable; falling back to English", { locale, error });
    return importLocaleMessages("en");
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
