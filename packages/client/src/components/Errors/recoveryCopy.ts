/**
 * The words for the two recovery screens that must render when the app's providers have failed:
 * the website with no frame left, and the installed app that could not open. They cannot wait for
 * the locale catalogue, which loads through the provider that may be what failed.
 *
 * Every other recovery state is inside a working frame and takes its words from the catalogue.
 */
export type RecoveryLanguage = "en" | "es" | "pt";

export interface RecoveryCopy {
  siteTitle: string;
  siteBody: string;
  siteOfflineTitle: string;
  siteOfflineBody: string;
  /** The line under the logo. One line in every language, as the loading screen's is. */
  launchTitle: string;
  /** The quiet note under the action. */
  launchNote: string;
  launchOfflineTitle: string;
  launchOfflineNote: string;
  /** The line under the logo while the app reloads itself onto a new build. */
  launchUpdating: string;
  reload: string;
}

const COPY: Record<RecoveryLanguage, RecoveryCopy> = {
  en: {
    siteTitle: "This page could not be loaded",
    siteBody: "Reload to try again.",
    siteOfflineTitle: "You're offline",
    siteOfflineBody: "This page will load as soon as you are back online.",
    launchTitle: "Green Goods couldn't open.",
    launchNote: "Nothing was lost.",
    launchOfflineTitle: "You're offline.",
    launchOfflineNote: "Green Goods opens when you are back online.",
    launchUpdating: "Updating Green Goods…",
    reload: "Reload",
  },
  es: {
    siteTitle: "No se pudo cargar esta página",
    siteBody: "Recarga para intentarlo de nuevo.",
    siteOfflineTitle: "Estás sin conexión",
    siteOfflineBody: "Esta página se cargará en cuanto vuelvas a tener conexión.",
    launchTitle: "Green Goods no pudo abrirse.",
    launchNote: "No se perdió nada.",
    launchOfflineTitle: "Estás sin conexión.",
    launchOfflineNote: "Green Goods se abrirá cuando vuelvas a tener conexión.",
    launchUpdating: "Actualizando Green Goods…",
    reload: "Recargar",
  },
  pt: {
    siteTitle: "Não foi possível carregar esta página",
    siteBody: "Recarregue para tentar novamente.",
    siteOfflineTitle: "Você está offline",
    siteOfflineBody: "Esta página será carregada assim que você voltar a ficar online.",
    launchTitle: "O Green Goods não pôde abrir.",
    launchNote: "Nada foi perdido.",
    launchOfflineTitle: "Você está offline.",
    launchOfflineNote: "O Green Goods abrirá quando você voltar a ficar online.",
    launchUpdating: "Atualizando o Green Goods…",
    reload: "Recarregar",
  },
};

function isRecoveryLanguage(tag: string): tag is RecoveryLanguage {
  return Object.hasOwn(COPY, tag);
}

/**
 * The language the app would have chosen: the stored one, else the first browser language with
 * copy here, else English. The loading screen in index.html makes the same choice.
 */
export function recoveryLanguage(): RecoveryLanguage {
  let stored: string | null = null;
  try {
    stored = window.localStorage.getItem("gg-language");
  } catch {
    // Storage can be blocked. The browser language still applies.
  }
  const browser = navigator.languages?.length ? navigator.languages : [navigator.language];
  for (const candidate of stored ? [stored] : browser) {
    const tag = String(candidate ?? "")
      .toLowerCase()
      .slice(0, 2);
    if (isRecoveryLanguage(tag)) return tag;
  }
  return "en";
}

export function recoveryCopy(language: RecoveryLanguage = recoveryLanguage()): RecoveryCopy {
  return COPY[language];
}
