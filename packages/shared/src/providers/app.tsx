import { PostHogProvider } from "posthog-js/react";
import React, { useCallback, useContext, useEffect, useState } from "react";
import { IntlProvider } from "react-intl";

import enMessages from "../i18n/en.json";
import esMessages from "../i18n/es.json";
import ptMessages from "../i18n/pt.json";

const messages = {
  en: enMessages,
  pt: ptMessages,
  es: esMessages,
};

import { track } from "../modules/app/posthog";

export type InstallState = "idle" | "not-installed" | "installed" | "unsupported";
export const supportedLanguages = ["en", "pt", "es"] as const;
export type Locale = (typeof supportedLanguages)[number];
export type Platform = "ios" | "android" | "windows" | "unknown";

export interface AppDataProps {
  isMobile: boolean;
  isInstalled: boolean;
  isStandalone: boolean;
  platform: Platform;
  locale: Locale;
  availableLocales: readonly Locale[];
  deferredPrompt: BeforeInstallPromptEvent | null;
  promptInstall: () => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handleInstallCheck: (e: any) => void;
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

function getMobileOperatingSystem(): Platform {
  // @ts-ignore
  const userAgent = navigator.userAgent || navigator.vendor || window.opera;

  // Windows Phone must come first because its UA also contains "Android"
  if (/windows phone/i.test(userAgent)) {
    return "windows";
  }

  if (/android/i.test(userAgent)) {
    return "android";
  }

  // iOS detection from: http://stackoverflow.com/a/9039885/177710
  // @ts-ignore
  if (/iPad|iPhone|iPod/.test(userAgent) && !window.MSStream) {
    return "ios";
  }

  return "unknown";
}

export const AppContext = React.createContext<AppDataProps>({
  isMobile: false,
  isInstalled: false,
  isStandalone: false,
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

export const AppProvider = ({ children }: { children: React.ReactNode }) => {
  const defaultLocale = localStorage.getItem("gg-language")
    ? (localStorage.getItem("gg-language") as Locale)
    : (getBrowserLocale(supportedLanguages, "en") as Locale); // Use helper instead of browserLang
  const [locale, setLocale] = useState<Locale>(defaultLocale as Locale);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  // Initialize state synchronously to prevent PWA landing page flash
  const [installState, setInstalledState] = useState<InstallState>(() => {
    if (typeof window !== "undefined") {
      const mockInstalled = import.meta.env.VITE_MOCK_PWA_INSTALLED === "true";
      if (
        mockInstalled ||
        window.matchMedia("(display-mode: standalone)").matches ||
        window.matchMedia("(display-mode: fullscreen)").matches ||
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (window.navigator as any).standalone
      ) {
        return "installed";
      }
    }
    // Use "idle" to indicate we haven't checked yet (will trigger useEffect check)
    return "idle";
  });

  const platform = getMobileOperatingSystem();

  const isStandalone = React.useMemo(() => {
    if (typeof window === "undefined") return false;
    return (
      window.matchMedia("(display-mode: standalone)").matches ||
      window.matchMedia("(display-mode: fullscreen)").matches ||
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window.navigator as any).standalone
    );
  }, []);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleInstallCheck = useCallback(async (e: any) => {
    e?.preventDefault(); // Prevent the automatic prompt
    setDeferredPrompt(e);

    // Check if we should mock PWA installation for testing
    const mockInstalled = import.meta.env.VITE_MOCK_PWA_INSTALLED === "true";

    if (
      mockInstalled ||
      window.matchMedia("(display-mode: standalone)").matches ||
      window.matchMedia("(display-mode: fullscreen)").matches ||
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window.navigator as any).standalone
    ) {
      setInstalledState("installed");

      // App was installed or mocked as installed
    } else {
      setInstalledState("not-installed");

      // App was not installed
    }
  }, []);

  const handleBeforeInstall = useCallback((e: Event) => {
    e.preventDefault();
    setDeferredPrompt(e as BeforeInstallPromptEvent);
  }, []);

  const handleAppInstalled = useCallback(() => {
    setInstalledState("installed");
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

  return (
    <PostHogProvider
      apiKey={import.meta.env.VITE_PUBLIC_POSTHOG_KEY}
      options={{
        api_host: import.meta.env.VITE_PUBLIC_POSTHOG_HOST,
        capture_exceptions: true,
        debug: import.meta.env.VITE_POSTHOG_DEBUG === "true",
      }}
    >
      <AppContext.Provider
        value={{
          isMobile: platform === "ios" || platform === "android" || platform === "windows",
          isInstalled: installState === "installed",
          isStandalone,
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
    </PostHogProvider>
  );
};
