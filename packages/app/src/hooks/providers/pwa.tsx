import { useEffect, useState } from "react";

import { Platform, useApp } from "./app";

export type DisplayMode = "standalone" | "browser" | "twa";
export type InstallState = "idle" | "prompt" | "installed" | "unsupported";

export interface PWADataProps {
  platform: Platform;
  installState: InstallState;
  handleInstallCheck: (e: any) => void;
}

export const usePWA = (): PWADataProps => {
  const { isHandheld, platform } = useApp();

  const [installState, setInstalledState] = useState<InstallState>(
    isHandheld ? "installed" : "unsupported"
  );

  async function handleInstallCheck(e: any) {
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
