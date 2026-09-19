import { useEffect, useState } from "react";

import type { InstalledAppEvidence } from "./useInstallGuidance";
import type { Platform } from "../../utils/app/pwa";

interface RelatedApplication {
  id?: string;
  platform?: string;
  url?: string;
}

interface NavigatorWithRelatedApps extends Navigator {
  getInstalledRelatedApps?: () => Promise<RelatedApplication[]>;
}

export interface InstalledAppEvidenceOptions {
  platform: Platform;
  isStandalone: boolean;
  wasInstalled: boolean;
  /** `appinstalled` fired this page session and the install has settled. */
  installConfirmed?: boolean;
  /**
   * Chromium fired `beforeinstallprompt` this page session and nothing has
   * installed since. The browser only offers that prompt while the app is not
   * installed, so it is the one reliable negative signal a browser tab gets;
   * dismissing the prompt does not change it.
   */
  installPromptObserved?: boolean;
}

function fallbackEvidence(wasInstalled: boolean): InstalledAppEvidence {
  return {
    status: "unknown",
    source: wasInstalled ? "history" : "unsupported",
  };
}

function resolveSessionEvidence({
  isStandalone,
  installConfirmed,
  installPromptObserved,
}: Pick<
  InstalledAppEvidenceOptions,
  "isStandalone" | "installConfirmed" | "installPromptObserved"
>): InstalledAppEvidence | null {
  if (isStandalone) return { status: "installed", source: "standalone" };
  if (installConfirmed) return { status: "installed", source: "appinstalled" };
  if (installPromptObserved) return { status: "not-installed", source: "install-prompt" };
  return null;
}

function getRelatedAppsQuery(platform: Platform) {
  if (platform !== "android" || typeof navigator === "undefined") return null;
  const relatedApps = (navigator as NavigatorWithRelatedApps).getInstalledRelatedApps;
  return typeof relatedApps === "function" ? relatedApps : null;
}

export function useInstalledAppEvidence({
  platform,
  isStandalone,
  wasInstalled,
  installConfirmed = false,
  installPromptObserved = false,
}: InstalledAppEvidenceOptions): InstalledAppEvidence {
  const [evidence, setEvidence] = useState<InstalledAppEvidence>(() => {
    const sessionEvidence = resolveSessionEvidence({
      isStandalone,
      installConfirmed,
      installPromptObserved,
    });
    if (sessionEvidence) return sessionEvidence;
    if (getRelatedAppsQuery(platform)) return { status: "checking", source: "related-app" };
    return fallbackEvidence(wasInstalled);
  });

  useEffect(() => {
    const sessionEvidence = resolveSessionEvidence({
      isStandalone,
      installConfirmed,
      installPromptObserved,
    });
    if (sessionEvidence) {
      setEvidence(sessionEvidence);
      return;
    }

    const relatedApps = getRelatedAppsQuery(platform);
    if (!relatedApps) {
      setEvidence(fallbackEvidence(wasInstalled));
      return;
    }

    let cancelled = false;
    setEvidence({ status: "checking", source: "related-app" });
    void relatedApps
      .call(navigator)
      .then((apps) => {
        if (cancelled) return;
        // A listed web app is proof of installation. An empty list is not proof of
        // absence: Chromium only reports a WebAPK bound to the exact manifest URL
        // this page declares, so a beta or preview host, a home-screen shortcut,
        // or a missing asset-link association all answer empty for an app that is
        // installed. Empty therefore falls back to history instead of overriding it.
        setEvidence(
          apps.some((app) => app.platform === "webapp")
            ? { status: "installed", source: "related-app" }
            : fallbackEvidence(wasInstalled)
        );
      })
      .catch(() => {
        if (!cancelled) setEvidence(fallbackEvidence(wasInstalled));
      });

    return () => {
      cancelled = true;
    };
  }, [installConfirmed, installPromptObserved, isStandalone, platform, wasInstalled]);

  return evidence;
}
