import { useEffect, useState } from "react";

export type DisplayMode = "standalone" | "browser" | "twa";
export type InstallState = "idle" | "prompt" | "installed" | "unsupported";

export type Platform = "ios" | "android" | "windows" | "unknown";

export interface PWADataProps {
  platform: Platform;
  installState: InstallState;
  handleInstallCheck: (e: any) => void;
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

export const isHandheld = detectHandheld();

export const usePWA = (): PWADataProps => {
  const [installState, setInstalledState] = useState<InstallState>(
    isHandheld ? "installed" : "unsupported"
  );

  const platform = getMobileOperatingSystem();

  async function handleInstallCheck(e: any) {
    const platform = getMobileOperatingSystem();

    if (
      window.matchMedia("(display-mode: standalone)").matches ||
      window.matchMedia("(display-mode: fullscreen)").matches
    ) {
      setInstalledState("installed");

      console.log("PWA was installed", e);
    } else {
      // setInstalledState("prompt");
      setInstalledState("installed"); // TODO: Update PWA flow

      console.log("PWA was not installed", e);
    }
  }

  function handlePWAInstalled() {
    setInstalledState("installed");

    // TODO: Add analytics and fire notification
  }

  useEffect(() => {
    isHandheld &&
      window.addEventListener("beforeinstallprompt", handleInstallCheck);
    isHandheld && window.addEventListener("appinstalled", handlePWAInstalled);

    return () => {
      isHandheld &&
        window.removeEventListener("beforeinstallprompt", handleInstallCheck);
      isHandheld &&
        window.removeEventListener("appinstalled", handlePWAInstalled);
    };
  }, []);

  return {
    platform,
    installState,
    handleInstallCheck,
  };
};
function detectHandheld(): boolean {
  const userAgent =
    navigator.userAgent || navigator.vendor || (window as any).opera;

  // Check if the user agent contains any keywords indicating a handheld device
  const handheldKeywords = [
    "Android",
    "webOS",
    "iPhone",
    "iPad",
    "iPod",
    "BlackBerry",
    "Windows Phone",
  ];
  const isHandheld = handheldKeywords.some((keyword) =>
    userAgent.includes(keyword)
  );

  return isHandheld;
}
