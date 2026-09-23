import type { ClientBootstrapPresentation } from "./bootstrap";

interface LegacyServiceWorkerRegistration {
  readonly scope: string;
  unregister(): Promise<boolean>;
}

export interface LegacyServiceWorkerMigrationRuntime {
  readonly href: string;
  readonly origin: string;
  getRegistrations(): Promise<readonly LegacyServiceWorkerRegistration[]>;
  replace(url: string): void;
}

function browserRuntime(): LegacyServiceWorkerMigrationRuntime | null {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return null;

  return {
    getRegistrations: () => navigator.serviceWorker.getRegistrations(),
    href: window.location.href,
    origin: window.location.origin,
    replace: (url) => window.location.replace(url),
  };
}

export function isLegacyRootServiceWorker(scope: string, origin: string): boolean {
  try {
    const scopeUrl = new URL(scope, origin);
    return scopeUrl.origin === new URL(origin).origin && scopeUrl.pathname === "/";
  } catch {
    return false;
  }
}

/**
 * A retired root-scoped worker can still control public pages and intercept a
 * newly deployed lazy chunk. Remove it before the public bootstrap imports any
 * route code, then navigate once so the replacement document is uncontrolled.
 */
export async function restartPublicPageWithoutLegacyRootWorker(
  presentation: ClientBootstrapPresentation,
  version: string,
  runtime: LegacyServiceWorkerMigrationRuntime | null = browserRuntime()
): Promise<boolean> {
  if (presentation !== "public" || !runtime) return false;

  let registrations: readonly LegacyServiceWorkerRegistration[];
  try {
    registrations = await runtime.getRegistrations();
  } catch {
    return false;
  }

  const legacyRegistrations = registrations.filter((registration) =>
    isLegacyRootServiceWorker(registration.scope, runtime.origin)
  );
  if (legacyRegistrations.length === 0) return false;

  const outcomes = await Promise.all(
    legacyRegistrations.map(async (registration) => {
      try {
        return await registration.unregister();
      } catch {
        return false;
      }
    })
  );
  if (!outcomes.some(Boolean)) return false;

  const nextUrl = new URL(runtime.href);
  nextUrl.searchParams.set("gg_sw_retired", version.trim().slice(0, 12) || "current");
  runtime.replace(nextUrl.toString());
  return true;
}
