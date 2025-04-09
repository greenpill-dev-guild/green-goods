import browserLang from "browser-lang";
import { IntlProvider } from "react-intl";
import React, { useState, useEffect, useContext } from "react";

import enMessages from "@/i18n/en.json";
import ptMessages from "@/i18n/pt.json";

export type InstallState =
  | "idle"
  | "not-installed"
  | "installed"
  | "unsupported";
export type Locale = "en" | "pt";
export type Platform = "ios" | "android" | "windows" | "unknown";

const supportedLanguages: Locale[] = ["en", "pt"];

export interface AppDataProps {
  isMobile: boolean;
  isInstalled: boolean;
  platform: Platform;
  locale: Locale;
  deferredPrompt: BeforeInstallPromptEvent | null;
  promptInstall: () => void;
  handleInstallCheck: (e: any) => void;
  switchLanguage: (lang: Locale) => void;
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const messages = {
  en: enMessages,
  pt: ptMessages,
};

function getMobileOperatingSystem(): Platform {
  // @ts-ignore
  var userAgent = navigator.userAgent || navigator.vendor || window.opera;

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

const AppContext = React.createContext<AppDataProps>({
  isMobile: false,
  isInstalled: false,
  locale: "en",
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
  const defaultLocale = browserLang({
    languages: supportedLanguages,
    fallback: "en",
  });
  const [locale, setLocale] = useState<Locale>(defaultLocale as Locale);
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [installState, setInstalledState] = useState<InstallState>("idle");

  const platform = getMobileOperatingSystem();

  async function handleInstallCheck(e: any | null) {
    e?.preventDefault(); // Prevent the automatic prompt
    setDeferredPrompt(e);

    if (
      window.matchMedia("(display-mode: standalone)").matches ||
      window.matchMedia("(display-mode: fullscreen)").matches ||
      (window.navigator as any).standalone
    ) {
      setInstalledState("installed");

      console.log("App was installed", e);
    } else {
      setInstalledState("not-installed");

      console.log("App was not installed", e);
    }
  }

  function handleBeforeInstall(e: Event) {
    e.preventDefault();
    setDeferredPrompt(e as BeforeInstallPromptEvent);
  }

  function handleAppInstalled() {
    setInstalledState("installed");

    // TODO: Add analytics and fire notification
  }

  function switchLanguage(lang: Locale) {
    setLocale(lang);
  }

  const promptInstall = () => {
    if (deferredPrompt) {
      deferredPrompt.prompt(); // Show the install prompt
      deferredPrompt.userChoice.then((choiceResult) => {
        if (choiceResult.outcome === "accepted") {
          console.log("User accepted the install prompt");
        } else {
          console.log("User dismissed the install prompt");
        }
        setDeferredPrompt(null); // Clear the saved prompt
      });
    }
  };

  useEffect(() => {
    handleInstallCheck(null);

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  return (
    <AppContext.Provider
      value={{
        isMobile:
          platform === "ios" ||
          platform === "android" ||
          platform === "windows",
        isInstalled: installState === "installed",
        platform,
        locale,
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
};
