import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { IntlProvider } from "react-intl";

import { toastService } from "../components/toast";
import { useAppLifecycle } from "../hooks/app/useAppLifecycle";
import { logger } from "../modules/app/logger";
import { track } from "../modules/app/posthog";
import { useInstalledAppEvidence } from "../hooks/app/useInstalledAppEvidence";
import type { InstalledAppEvidence } from "../hooks/app/useInstallGuidance";
import {
  type ClientPresentationMode,
  getClientPresentationMode,
  getMobileOperatingSystem,
  isAppInstalled,
  isMobilePlatform,
  isStandaloneMode,
  type InstallPromptEvent,
  type Platform,
} from "../utils/app/pwa";

type LocaleMessages = Record<string, string>;

async function loadLocaleMessages(locale: Locale): Promise<LocaleMessages> {
  switch (locale) {
    case "es":
      return (await import("../i18n/es.json")).default;
    case "pt":
      return (await import("../i18n/pt.json")).default;
    default:
      return (await import("../i18n/en.json")).default;
  }
}

export type InstallState =
  | "idle"
  | "not-installed"
  | "installing"
  | "finalizing"
  | "installed"
  | "unsupported";
const INSTALL_READY_SETTLE_MS = 1000;
const INSTALL_FINALIZING_FALLBACK_MS = 30_000;
export const supportedLanguages = ["en", "pt", "es"] as const;
export type Locale = (typeof supportedLanguages)[number];
export type { Platform };

const installSuccessToastIds = {
  title: "app.toast.install.success.title",
  message: "app.toast.install.success.message",
} as const;

const installSuccessMessages: Record<Locale, { title: string; message: string }> = {
  en: {
    title: "App installed",
    message: "Green Goods is ready from your home screen.",
  },
  es: {
    title: "App instalada",
    message: "Green Goods está lista desde tu pantalla de inicio.",
  },
  pt: {
    title: "App instalada",
    message: "O Green Goods está pronto na tela inicial.",
  },
};

async function clearInstalledAppSessionState() {
  const [{ clearActiveSessionAuth }, { queryClient }, { serviceWorkerManager }] = await Promise.all(
    [
      import("../modules/auth/session"),
      import("../config/react-query"),
      import("../modules/app/service-worker"),
    ]
  );
  clearActiveSessionAuth();
  queryClient.clear();
  await serviceWorkerManager.clearAllCaches().catch((error) => {
    logger.warn("[AppProvider] clearAllCaches failed after app install", { error });
  });
}

export interface AppDataProps {
  isMobile: boolean;
  isInstalled: boolean;
  isInstalling: boolean;
  isPwaPresentation: boolean;
  isStandalone: boolean;
  installState: InstallState;
  installedAppEvidence: InstalledAppEvidence;
  presentationMode: ClientPresentationMode;
  wasInstalled: boolean;
  platform: Platform;
  locale: Locale;
  availableLocales: readonly Locale[];
  deferredPrompt: InstallPromptEvent | null;
  promptInstall: () => void;
  handleInstallCheck: (e: InstallPromptEvent | null) => void;
  switchLanguage: (lang: Locale) => void;
}

function getBrowserLocale(available: readonly string[], fallback: string): string {
  if (typeof navigator === "undefined") return fallback;

  const browserLocales = navigator.languages || [navigator.language];

  for (const locale of browserLocales) {
    const lang = locale.split("-")[0]; // "en-US" -> "en"
    if (available.includes(lang)) {
      return lang;
    }
  }

  return fallback;
}

export const AppContext = React.createContext<AppDataProps>({
  isMobile: false,
  isInstalled: false,
  isInstalling: false,
  isPwaPresentation: false,
  isStandalone: false,
  installState: "idle",
  installedAppEvidence: { status: "unknown", source: "unsupported" },
  presentationMode: "website",
  wasInstalled: false,
  locale: "en",
  availableLocales: supportedLanguages,
  deferredPrompt: null,
  platform: "unknown",
  promptInstall: () => {},
  handleInstallCheck: () => {},
  switchLanguage: () => {},
});

export const useApp = () => {
  return useContext(AppContext);
};

interface AppProviderProps {
  children: React.ReactNode;
  posthogKey?: string;
  allowPosthogKeyFallback?: boolean;
}

export const AppProvider = ({
  children,
  posthogKey,
  allowPosthogKeyFallback = true,
}: AppProviderProps) => {
  // Use provided key or fall back to default client key
  const apiKey = posthogKey || (allowPosthogKeyFallback ? import.meta.env.VITE_POSTHOG_KEY : "");
  const defaultLocale = localStorage.getItem("gg-language")
    ? (localStorage.getItem("gg-language") as Locale)
    : (getBrowserLocale(supportedLanguages, "en") as Locale); // Use helper instead of browserLang
  const [locale, setLocale] = useState<Locale>(defaultLocale as Locale);
  const [localeMessages, setLocaleMessages] = useState<LocaleMessages>({});
  const [deferredPrompt, setDeferredPrompt] = useState<InstallPromptEvent | null>(null);
  const installSettleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const installAttemptHadExistingInstallRef = useRef<boolean | null>(null);
  const installReadinessSettledRef = useRef(false);
  const installReadyConfirmationScheduledRef = useRef(false);
  const appInstalledEventCountRef = useRef(0);
  const reinstallCleanupRanRef = useRef(false);
  // Wall-clock of the first `appinstalled` for this attempt. Powers the
  // finalize-duration telemetry that tells us, on real devices, whether Chrome
  // fires one `appinstalled` (we settle via the blind fallback) or two (we
  // settle ~1s after the real WebAPK-ready event). This is the load-bearing
  // fact the two-phase gate assumes — measure it rather than trust it.
  const installFinalizeStartedAtRef = useRef<number | null>(null);

  // Track if app was ever installed on this browser (persistent)
  const [wasInstalled, setWasInstalled] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("gg-pwa-installed") === "true";
    }
    return false;
  });

  // Initialize state synchronously to prevent PWA landing page flash
  const [installState, setInstalledState] = useState<InstallState>(() => {
    if (typeof window !== "undefined" && isAppInstalled()) {
      return "installed";
    }
    // Use "idle" to indicate we haven't checked yet (will trigger useEffect check)
    return "idle";
  });

  const platform = getMobileOperatingSystem();

  useEffect(() => {
    if (!apiKey) return;
    let cancelled = false;
    let idleHandle: number | null = null;

    const initialize = () => {
      void import("../modules/app/posthog-browser").then(({ initializePostHog }) => {
        if (!cancelled) initializePostHog(apiKey);
      });
    };
    const schedule = () => {
      if (window.requestIdleCallback) idleHandle = window.requestIdleCallback(initialize);
      else idleHandle = window.setTimeout(initialize, 1_000);
    };

    if (document.readyState === "complete") schedule();
    else window.addEventListener("load", schedule, { once: true });

    return () => {
      cancelled = true;
      window.removeEventListener("load", schedule);
      if (idleHandle !== null) {
        if (window.cancelIdleCallback) window.cancelIdleCallback(idleHandle);
        else window.clearTimeout(idleHandle);
      }
    };
  }, [apiKey]);

  useEffect(() => {
    let cancelled = false;
    void loadLocaleMessages(locale).then((nextMessages) => {
      if (!cancelled) setLocaleMessages(nextMessages);
    });
    return () => {
      cancelled = true;
    };
  }, [locale]);

  const isStandalone = React.useMemo(() => isStandaloneMode(), []);

  const clearInstallSettleTimer = useCallback(() => {
    if (installSettleTimerRef.current === null) return;
    clearTimeout(installSettleTimerRef.current);
    installSettleTimerRef.current = null;
  }, []);

  const resetInstallAttempt = useCallback(() => {
    clearInstallSettleTimer();
    installAttemptHadExistingInstallRef.current = null;
    installReadinessSettledRef.current = false;
    installReadyConfirmationScheduledRef.current = false;
    appInstalledEventCountRef.current = 0;
    reinstallCleanupRanRef.current = false;
    installFinalizeStartedAtRef.current = null;
  }, [clearInstallSettleTimer]);

  const startInstallAttempt = useCallback(() => {
    clearInstallSettleTimer();
    installAttemptHadExistingInstallRef.current =
      localStorage.getItem("gg-pwa-installed") === "true";
    installReadinessSettledRef.current = false;
    installReadyConfirmationScheduledRef.current = false;
    appInstalledEventCountRef.current = 0;
    reinstallCleanupRanRef.current = false;
    installFinalizeStartedAtRef.current = null;
    setInstalledState("installing");
  }, [clearInstallSettleTimer]);

  const scheduleInstalledState = useCallback(
    (delayMs: number, onSettled?: () => void) => {
      clearInstallSettleTimer();
      installSettleTimerRef.current = setTimeout(() => {
        installSettleTimerRef.current = null;
        if (installReadinessSettledRef.current) return;
        installReadinessSettledRef.current = true;
        setInstalledState("installed");
        onSettled?.();
      }, delayMs);
    },
    [clearInstallSettleTimer]
  );

  const handleInstallCheck = useCallback(
    (e: InstallPromptEvent | null) => {
      e?.preventDefault(); // Prevent the automatic prompt
      setDeferredPrompt(e);

      if (isAppInstalled()) {
        installReadinessSettledRef.current = true;
        setInstalledState("installed");
      } else {
        resetInstallAttempt();
        setInstalledState("not-installed");
      }
    },
    [resetInstallAttempt]
  );

  const handleBeforeInstall = useCallback((e: Event) => {
    e.preventDefault();
    setDeferredPrompt(e as InstallPromptEvent);
  }, []);

  const handleAppInstalled = useCallback(() => {
    if (installReadinessSettledRef.current) return;

    const wasPreviouslyInstalled =
      installAttemptHadExistingInstallRef.current ??
      localStorage.getItem("gg-pwa-installed") === "true";

    installAttemptHadExistingInstallRef.current = wasPreviouslyInstalled;
    appInstalledEventCountRef.current += 1;
    if (appInstalledEventCountRef.current === 1) {
      installFinalizeStartedAtRef.current = Date.now();
    }
    setInstalledState("finalizing");
    setWasInstalled(true);
    if (wasPreviouslyInstalled && !reinstallCleanupRanRef.current) {
      reinstallCleanupRanRef.current = true;
      void clearInstalledAppSessionState();
    }
    localStorage.setItem("gg-pwa-installed", "true");

    const settleInstall = () => {
      const successMessage = installSuccessMessages[locale];
      toastService.success({
        id: "app-install-success",
        title: localeMessages[installSuccessToastIds.title] || successMessage.title,
        message: localeMessages[installSuccessToastIds.message] || successMessage.message,
        context: "pwa install",
        suppressLogging: true,
      });
      track("App Installed", {
        platform,
        locale,
        installState: "installed",
        appinstalled_event_count: appInstalledEventCountRef.current,
        settled_via_fallback: appInstalledEventCountRef.current === 1,
        finalize_duration_ms:
          installFinalizeStartedAtRef.current === null
            ? undefined
            : Date.now() - installFinalizeStartedAtRef.current,
      });
    };

    if (appInstalledEventCountRef.current === 1) {
      scheduleInstalledState(INSTALL_FINALIZING_FALLBACK_MS, settleInstall);
      return;
    }

    if (installReadyConfirmationScheduledRef.current) return;
    installReadyConfirmationScheduledRef.current = true;
    scheduleInstalledState(INSTALL_READY_SETTLE_MS, settleInstall);
  }, [locale, localeMessages, platform, scheduleInstalledState]);

  const switchLanguage = useCallback((lang: Locale) => {
    setLocale(lang);
    localStorage.setItem("gg-language", lang);
  }, []);

  const promptInstall = useCallback(() => {
    if (deferredPrompt) {
      startInstallAttempt();
      void deferredPrompt
        .prompt()
        .then(() => deferredPrompt.userChoice)
        .then((choiceResult) => {
          if (choiceResult.outcome === "accepted") return;

          resetInstallAttempt();
          setInstalledState(isAppInstalled() ? "installed" : "not-installed");
        })
        .catch(() => {
          resetInstallAttempt();
          setInstalledState(isAppInstalled() ? "installed" : "not-installed");
        })
        .finally(() => {
          setDeferredPrompt(null); // Clear the saved prompt
        });
    }
  }, [deferredPrompt, resetInstallAttempt, startInstallAttempt]);

  const checkInstall = useCallback(() => handleInstallCheck(null), [handleInstallCheck]);
  useAppLifecycle({
    posthogEnabled: Boolean(apiKey),
    shouldCheckInstall: installState === "idle",
    checkInstall,
    handleBeforeInstall,
    handleAppInstalled,
    resetInstallAttempt,
  });

  const isMobile = isMobilePlatform();
  const installedAppEvidence = useInstalledAppEvidence({
    platform,
    isStandalone,
    wasInstalled,
    installConfirmed: installState === "installed",
  });
  const isInstalled = installedAppEvidence.status === "installed";
  const isInstalling = installState === "installing" || installState === "finalizing";
  const presentationMode = getClientPresentationMode();
  const isPwaPresentation = presentationMode === "pwa";

  const contextValue = useMemo(
    () => ({
      isMobile,
      isInstalled,
      isInstalling,
      isPwaPresentation,
      isStandalone,
      installState,
      installedAppEvidence,
      presentationMode,
      wasInstalled,
      platform,
      locale,
      availableLocales: supportedLanguages,
      deferredPrompt,
      promptInstall,
      handleInstallCheck,
      switchLanguage,
    }),
    [
      isMobile,
      isInstalled,
      isInstalling,
      isPwaPresentation,
      isStandalone,
      installState,
      installedAppEvidence,
      presentationMode,
      wasInstalled,
      platform,
      locale,
      deferredPrompt,
      promptInstall,
      handleInstallCheck,
      switchLanguage,
    ]
  );

  const appContent = (
    <AppContext.Provider value={contextValue}>
      <IntlProvider locale={locale} messages={localeMessages}>
        {children}
      </IntlProvider>
    </AppContext.Provider>
  );

  return appContent;
};
