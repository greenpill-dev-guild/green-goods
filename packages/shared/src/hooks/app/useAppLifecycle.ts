import { useEffect } from "react";

export interface AppLifecycleOptions {
  posthogEnabled: boolean;
  shouldCheckInstall: boolean;
  checkInstall(): void;
  handleBeforeInstall(event: Event): void;
  handleAppInstalled(): void;
  resetInstallAttempt(): void;
}

export function useAppLifecycle(options: AppLifecycleOptions): void {
  const {
    posthogEnabled,
    shouldCheckInstall,
    checkInstall,
    handleBeforeInstall,
    handleAppInstalled,
    resetInstallAttempt,
  } = options;

  useEffect(() => {
    if (shouldCheckInstall) checkInstall();
    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    window.addEventListener("appinstalled", handleAppInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, [checkInstall, handleAppInstalled, handleBeforeInstall, shouldCheckInstall]);

  useEffect(() => () => resetInstallAttempt(), [resetInstallAttempt]);

  useEffect(() => {
    if (!posthogEnabled) return;
    let isMounted = true;
    let timeoutId: ReturnType<typeof setTimeout>;
    let attemptCount = 0;
    const tryRegister = async () => {
      if (!isMounted) return;
      const { registerGlobalProperties } = await import("../../modules/app/posthog");
      const success = registerGlobalProperties();
      if (success || attemptCount >= 10) return;
      const delay = Math.min(100 * 2 ** attemptCount, 2_000);
      attemptCount += 1;
      timeoutId = setTimeout(() => void tryRegister(), delay);
    };
    timeoutId = setTimeout(() => void tryRegister(), 100);
    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
    };
  }, [posthogEnabled]);
}
