import React, { useState, useEffect, useContext } from "react";

export type DisplayMode = "standalone" | "browser" | "twa";
export type Platform = "ios" | "android" | "windows" | "unknown";
export type InstallState =
  | "idle"
  | "not-installed"
  | "installed"
  | "unsupported";

export interface PWADataProps {
  isMobile?: boolean;
  isInstalled?: boolean;
  deferredPrompt?: BeforeInstallPromptEvent | null;
  promptInstall?: () => void;
  handleInstallCheck?: (e: any) => void;
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

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

const PWAContext = React.createContext<PWADataProps>({});

export const usePWA = () => {
  return useContext(PWAContext);
};

export const PWAProvider = ({ children }: { children: React.ReactNode }) => {
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

      console.log("PWA was installed", e);
    } else {
      setInstalledState("not-installed");

      console.log("PWA was not installed", e);
    }
  }

  function handleBeforeInstallPrompt(e: Event) {
    e.preventDefault();
    setDeferredPrompt(e as BeforeInstallPromptEvent);
  }

  function handlePWAInstalled() {
    setInstalledState("installed");

    // TODO: Add analytics and fire notification
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

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handlePWAInstalled);

    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt
      );
      window.removeEventListener("appinstalled", handlePWAInstalled);
    };
  }, []);

  return (
    <PWAContext.Provider
      value={{
        isMobile: platform === "ios" || platform === "android",
        isInstalled: installState === "installed",
        deferredPrompt,
        promptInstall,
        handleInstallCheck,
      }}
    >
      {children}
    </PWAContext.Provider>
  );
};
