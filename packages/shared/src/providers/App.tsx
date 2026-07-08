import { PostHogProvider } from "posthog-js/react";
import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { IntlProvider } from "react-intl";

import enMessages from "../i18n/en.json";
import esMessages from "../i18n/es.json";
import ptMessages from "../i18n/pt.json";
import { toastService } from "../components/toast";
import {
  registerGlobalProperties,
  restoreExceptionTopLevelProps,
  track,
} from "../modules/app/posthog";
import { queryClient } from "../config/react-query";
import { logger } from "../modules/app/logger";
import { serviceWorkerManager } from "../modules/app/service-worker";
import { clearActiveSessionAuth } from "../modules/auth/session";
import {
  type ClientPresentationMode,
  getClientPresentationMode,
  getMobileOperatingSystem,
  isAppInstalled,
  isMobilePlatform,
  isStandaloneMode,
  type Platform,
} from "../utils/app/pwa";

const messages = {
  en: enMessages,
  pt: ptMessages,
  es: esMessages,
};

const POSTHOG_API_HOST = "https://us.i.posthog.com";

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

function clearInstalledAppSessionState() {
  clearActiveSessionAuth();
  queryClient.clear();
  serviceWorkerManager.clearAllCaches().catch((error) => {
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
  presentationMode: ClientPresentationMode;
  wasInstalled: boolean;
  platform: Platform;
  locale: Locale;
  availableLocales: readonly Locale[];
  deferredPrompt: BeforeInstallPromptEvent | null;
  promptInstall: () => void;
  handleInstallCheck: (e: BeforeInstallPromptEvent | null) => void;
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

function formatAppProviderMessage(locale: Locale, id: string, fallback: string) {
  const localizedMessage = (messages[locale] as Record<string, string>)[id];
  return localizedMessage || fallback;
}

export const AppContext = React.createContext<AppDataProps>({
  isMobile: false,
  isInstalled: false,
  isInstalling: false,
  isPwaPresentation: false,
  isStandalone: false,
  installState: "idle",
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
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
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
    (e: BeforeInstallPromptEvent | null) => {
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
    setDeferredPrompt(e as BeforeInstallPromptEvent);
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
      clearInstalledAppSessionState();
    }
    localStorage.setItem("gg-pwa-installed", "true");

    const settleInstall = () => {
      toastService.success({
        id: "app-install-success",
        title: formatAppProviderMessage(locale, installSuccessToastIds.title, "App installed"),
        message: formatAppProviderMessage(
          locale,
          installSuccessToastIds.message,
          "Green Goods is ready from your home screen."
        ),
        context: "pwa install",
        suppressLogging: true,
      });
      track("App Installed", {
        platform,
        locale,
        installState: "installed",
        // Diagnostics for the two-phase readiness gate. `appinstalled_event_count`
        // === 1 means we settled via the blind fallback (Chrome fired a single
        // event); >= 2 means we confirmed off the second, WebAPK-ready event.
        // `finalize_duration_ms` is first-event → settle, so a value near the
        // fallback window flags the single-event path even without the count.
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
  }, [platform, locale, scheduleInstalledState]);

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

  useEffect(() => {
    // Only run install check if not already detected as installed during initialization
    // This prevents state changes that could trigger redirects mid-render
    if (installState === "idle") {
      handleInstallCheck(null);
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, [handleAppInstalled, handleBeforeInstall, handleInstallCheck, installState]);

  useEffect(() => {
    return () => resetInstallAttempt();
  }, [resetInstallAttempt]);

  const isMobile = isMobilePlatform();
  const isInstalled = installState === "installed";
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
      <IntlProvider locale={locale} messages={messages[locale]}>
        {children}
      </IntlProvider>
    </AppContext.Provider>
  );

  // Register global PostHog properties after PostHog initializes
  useEffect(() => {
    if (!apiKey) return;

    let isMounted = true;
    let timeoutId: ReturnType<typeof setTimeout>;
    let attemptCount = 0;
    const maxAttempts = 10;

    const tryRegister = () => {
      if (!isMounted) return;

      // Try to register - returns true if successful
      const success = registerGlobalProperties();

      if (success || attemptCount >= maxAttempts) {
        return; // Done - either success or max attempts reached
      }

      // Exponential backoff: 100ms, 200ms, 400ms, 800ms, etc.
      const delay = Math.min(100 * Math.pow(2, attemptCount), 2000);
      attemptCount += 1;
      timeoutId = setTimeout(tryRegister, delay);
    };

    // Start first attempt after initial delay
    timeoutId = setTimeout(tryRegister, 100);

    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
    };
  }, [apiKey]);

  // Only wrap with PostHogProvider if API key is available
  if (apiKey) {
    return (
      <PostHogProvider
        apiKey={apiKey}
        options={{
          api_host: POSTHOG_API_HOST,
          capture_exceptions: true,
          // Restore legacy top-level $exception_type/$exception_message that
          // posthog-js >= 1.3xx moved into $exception_list — downstream routines
          // and the posthog-questions HogQL still query the top-level fields.
          before_send: restoreExceptionTopLevelProps,
          debug: import.meta.env.VITE_POSTHOG_DEBUG === "true",
        }}
      >
        {appContent}
      </PostHogProvider>
    );
  }

  return appContent;
};
