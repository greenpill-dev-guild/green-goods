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
  installConfirmed?: boolean;
}

function fallbackEvidence(wasInstalled: boolean): InstalledAppEvidence {
  return {
    status: "unknown",
    source: wasInstalled ? "history" : "unsupported",
  };
}

export function useInstalledAppEvidence({
  platform,
  isStandalone,
  wasInstalled,
  installConfirmed = false,
}: InstalledAppEvidenceOptions): InstalledAppEvidence {
  const [evidence, setEvidence] = useState<InstalledAppEvidence>(() => {
    if (isStandalone) return { status: "installed", source: "standalone" };
    if (installConfirmed) return { status: "installed", source: "appinstalled" };
    if (platform === "android" && typeof navigator !== "undefined") {
      const relatedApps = (navigator as NavigatorWithRelatedApps).getInstalledRelatedApps;
      if (typeof relatedApps === "function") {
        return { status: "checking", source: "related-app" };
      }
    }
    return fallbackEvidence(wasInstalled);
  });

  useEffect(() => {
    if (isStandalone) {
      setEvidence({ status: "installed", source: "standalone" });
      return;
    }
    if (installConfirmed) {
      setEvidence({ status: "installed", source: "appinstalled" });
      return;
    }

    const relatedApps = (navigator as NavigatorWithRelatedApps).getInstalledRelatedApps;
    if (platform !== "android" || typeof relatedApps !== "function") {
      setEvidence(fallbackEvidence(wasInstalled));
      return;
    }

    let cancelled = false;
    setEvidence({ status: "checking", source: "related-app" });
    void relatedApps
      .call(navigator)
      .then((apps) => {
        if (cancelled) return;
        setEvidence({
          status: apps.some((app) => app.platform === "webapp") ? "installed" : "not-installed",
          source: "related-app",
        });
      })
      .catch(() => {
        if (!cancelled) setEvidence(fallbackEvidence(wasInstalled));
      });

    return () => {
      cancelled = true;
    };
  }, [installConfirmed, isStandalone, platform, wasInstalled]);

  return evidence;
}
