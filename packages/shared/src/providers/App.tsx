import { PostHogProvider } from "posthog-js/react";
import React, { useCallback, useContext, useEffect, useState } from "react";
import { IntlProvider } from "react-intl";

import enMessages from "../i18n/en.json";
import esMessages from "../i18n/es.json";
import ptMessages from "../i18n/pt.json";
import { track } from "../modules/app/posthog";
import {
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

export type InstallState = "idle" | "not-installed" | "installed" | "unsupported";
export const supportedLanguages = ["en", "pt", "es"] as const;
export type Locale = (typeof supportedLanguages)[number];
export type { Platform };

export interface AppDataProps {
  isMobile: boolean;
  isInstalled: boolean;
  isStandalone: boolean;
  wasInstalled: boolean;
  platform: Platform;
  locale: Locale;
  availableLocales: readonly Locale[];
  deferredPrompt: BeforeInstallPromptEvent | null;
  promptInstall: () => void;
  handleInstallCheck: (e: BeforeInstallPromptEvent | null) => void;
  switchLanguage: (lang: Locale) => void;
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
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
  isStandalone: false,
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
}

export const AppProvider = ({ children, posthogKey }: AppProviderProps) => {
  // Use provided key or fall back to default client key
  const apiKey = posthogKey || import.meta.env.VITE_POSTHOG_KEY;
  const defaultLocale = localStorage.getItem("gg-language")
    ? (localStorage.getItem("gg-language") as Locale)
    : (getBrowserLocale(supportedLanguages, "en") as Locale); // Use helper instead of browserLang
  const [locale, setLocale] = useState<Locale>(defaultLocale as Locale);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);

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

  const handleInstallCheck = useCallback((e: BeforeInstallPromptEvent | null) => {
    e?.preventDefault(); // Prevent the automatic prompt
    setDeferredPrompt(e);

    if (isAppInstalled()) {
      setInstalledState("installed");
    } else {
      setInstalledState("not-installed");
    }
  }, []);

  const handleBeforeInstall = useCallback((e: Event) => {
    e.preventDefault();
    setDeferredPrompt(e as BeforeInstallPromptEvent);
  }, []);

  const handleAppInstalled = useCallback(() => {
    setInstalledState("installed");
    setWasInstalled(true);
    localStorage.setItem("gg-pwa-installed", "true");
    track("App Installed", {
      platform,
      locale,
      installState,
    });
  }, [platform, locale, installState]);

  function switchLanguage(lang: Locale) {
    setLocale(lang);
    localStorage.setItem("gg-language", lang);
  }

  const promptInstall = () => {
    if (deferredPrompt) {
      deferredPrompt.prompt(); // Show the install prompt
      deferredPrompt.userChoice.then((choiceResult) => {
        if (choiceResult.outcome === "accepted") {
          // User accepted the install prompt
        } else {
          // User dismissed the install prompt
        }
        setDeferredPrompt(null); // Clear the saved prompt
      });
    }
  };

  useEffect(() => {
    // Only run install check if not already detected as installed during initialization
    // This prevents state changes that could trigger redirects mid-render
    if (installState !== "installed") {
      handleInstallCheck(null);
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, [handleAppInstalled, handleBeforeInstall, handleInstallCheck, installState]);

  const appContent = (
    <AppContext.Provider
      value={{
        isMobile: isMobilePlatform(),
        isInstalled: installState === "installed",
        isStandalone,
        wasInstalled,
        platform,
        locale,
        availableLocales: supportedLanguages,
        deferredPrompt,
        promptInstall,
        handleInstallCheck,
        switchLanguage,
      }}
    >
      <IntlProvider locale={locale} messages={messages[locale]}>
        {children}
      </IntlProvider>
    </AppContext.Provider>
  );

  // Only wrap with PostHogProvider if API key is available
  if (apiKey) {
    return (
      <PostHogProvider
        apiKey={apiKey}
        options={{
          api_host: import.meta.env.VITE_POSTHOG_HOST,
          capture_exceptions: true,
          debug: import.meta.env.VITE_POSTHOG_DEBUG === "true",
        }}
      >
        {appContent}
      </PostHogProvider>
    );
  }

  return appContent;
};
