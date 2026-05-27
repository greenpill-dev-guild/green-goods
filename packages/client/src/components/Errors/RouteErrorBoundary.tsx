/**
 * RouteErrorBoundary
 *
 * React Router catches errors from route loaders and lazy-loaded route components
 * BEFORE they reach a React error boundary (AppErrorBoundary, etc.). Without an
 * `errorElement` configured on the route, React Router renders its built-in default
 * UI — "Unexpected Application Error!" with the raw error message — which surfaces
 * minified React errors like "Minified React error #301" to end users and never
 * reports the exception to PostHog.
 *
 * This is especially nasty on the post-deploy SW-update flow: when the new service
 * worker activates with `skipWaiting + clientsClaim + cleanupOutdatedCaches`, old
 * dynamic-import chunks can 404 while React Router is trying to resolve a `lazy:`
 * route. The chunk-load failure throws into Router, Router shows its default screen,
 * the user reports it as an "Unexpected Application Error" that doesn't appear in
 * our telemetry.
 *
 * This component mirrors AppErrorBoundary's recovery logic at the route layer:
 *   - chunk-load errors auto-reload once via a sessionStorage one-shot flag
 *   - render-loop bugs (Minified React error #301, max update depth) offer a
 *     hard-reset that clears caches + IndexedDB
 *   - the raw error message stays hidden behind a "Show technical details" toggle
 *   - a Copy button assembles a markdown bug report ready to paste into chat
 *
 * Mount as `errorElement` on the root route in router.config.tsx so every loader,
 * `lazy:` import, and route component throws into here instead of into Router's
 * default UI.
 */
import { Alert, en, es, logger, pt, trackErrorBoundary } from "@green-goods/shared";
import {
  RiBugLine,
  RiCheckLine,
  RiClipboardLine,
  RiErrorWarningLine,
  RiHomeLine,
  RiRefreshLine,
  RiWifiOffLine,
} from "@remixicon/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { isRouteErrorResponse, useRouteError } from "react-router-dom";
import { Button } from "../Actions";

type Messages = typeof en;
type Locale = "en" | "es" | "pt";

const messages: Record<Locale, Messages> = { en, es, pt };

const CHUNK_ERROR_PATTERNS: RegExp[] = [
  /chunkloaderror/i,
  /loading chunk\s+\S+\s+failed/i,
  /failed to fetch dynamically imported module/i,
  /importing a module script failed/i,
  /unable to preload css/i,
];

const LOOP_ERROR_PATTERNS: RegExp[] = [
  /maximum update depth exceeded/i,
  /minified react error #301/i,
  /minified react error #310/i,
  /rendered more hooks than during the previous render/i,
  /rendered fewer hooks than expected/i,
];

const CHUNK_RELOAD_SESSION_KEY = "gg-route-eb-chunk-reload";

type ErrorCategory = "chunk" | "loop" | "network" | "offline" | "unknown";

interface NormalizedError {
  message: string;
  stack?: string;
  toString(): string;
}

function getBrowserLocale(): Locale {
  if (typeof navigator === "undefined") return "en";
  const browserLocales = navigator.languages || [navigator.language];
  for (const locale of browserLocales) {
    const lang = locale.split("-")[0] as Locale;
    if (lang === "en" || lang === "es" || lang === "pt") {
      return lang;
    }
  }
  return "en";
}

/**
 * React Router can give us almost anything from `useRouteError()`: an Error, a
 * thrown response, a string, or undefined. Normalize so the rest of the
 * component can treat it like a regular Error.
 */
function normalizeRouteError(raw: unknown): NormalizedError {
  if (raw instanceof Error) {
    return {
      message: raw.message || raw.name || "Unknown error",
      stack: raw.stack,
      toString: () => raw.toString(),
    };
  }
  if (isRouteErrorResponse(raw)) {
    const message = `${raw.status} ${raw.statusText || ""}${
      raw.data ? `: ${typeof raw.data === "string" ? raw.data : JSON.stringify(raw.data)}` : ""
    }`.trim();
    return {
      message,
      toString: () => `RouteErrorResponse: ${message}`,
    };
  }
  if (typeof raw === "string") {
    return { message: raw, toString: () => raw };
  }
  if (raw && typeof raw === "object" && "message" in raw && typeof raw.message === "string") {
    return {
      message: raw.message,
      stack: "stack" in raw && typeof raw.stack === "string" ? raw.stack : undefined,
      toString: () => String(raw),
    };
  }
  return {
    message: "Unknown route error",
    toString: () => "Unknown route error",
  };
}

function classifyError(error: NormalizedError): ErrorCategory {
  const message = (error.message || "").toLowerCase();
  if (CHUNK_ERROR_PATTERNS.some((p) => p.test(message))) return "chunk";
  if (LOOP_ERROR_PATTERNS.some((p) => p.test(message))) return "loop";
  if (
    ["network error", "fetch failed", "failed to fetch", "network request failed"].some((m) =>
      message.includes(m)
    )
  ) {
    return "network";
  }
  if (["offline", "job_queue", "sync", "indexeddb"].some((m) => message.includes(m))) {
    return "offline";
  }
  return "unknown";
}

function readSessionFlag(key: string): boolean {
  try {
    return window.sessionStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function writeSessionFlag(key: string): void {
  try {
    window.sessionStorage.setItem(key, "1");
  } catch {
    // best-effort
  }
}

function clearSessionFlag(key: string): void {
  try {
    window.sessionStorage.removeItem(key);
  } catch {
    // best-effort
  }
}

function buildBugReport(error: NormalizedError, category: ErrorCategory, locale: Locale): string {
  const route =
    typeof window !== "undefined"
      ? `${window.location.pathname}${window.location.search}`
      : "(unknown)";
  const userAgent = typeof navigator !== "undefined" ? navigator.userAgent : "(unknown)";
  const version =
    typeof import.meta !== "undefined" && import.meta.env?.VITE_APP_VERSION
      ? String(import.meta.env.VITE_APP_VERSION)
      : "(unknown)";
  const standalone =
    typeof window !== "undefined" && window.matchMedia?.("(display-mode: standalone)").matches
      ? "yes (installed PWA)"
      : "no (browser tab)";

  return [
    "## Green Goods bug report (route)",
    "",
    `**Error:** ${error.message}`,
    `**Category:** ${category}`,
    `**Caught by:** RouteErrorBoundary (React Router)`,
    `**Route:** ${route}`,
    `**Time:** ${new Date().toISOString()}`,
    `**Version:** ${version}`,
    `**Locale:** ${locale}`,
    `**Installed PWA:** ${standalone}`,
    `**User agent:** ${userAgent}`,
    "",
    "### Stack",
    "```",
    error.stack || "(no stack)",
    "```",
  ].join("\n");
}

export const RouteErrorBoundary: React.FC = () => {
  const rawError = useRouteError();
  const error = useMemo(() => normalizeRouteError(rawError), [rawError]);
  const category = useMemo(() => classifyError(error), [error]);
  const [locale] = useState<Locale>(getBrowserLocale);
  const [showDetails, setShowDetails] = useState(false);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "fallback">("idle");
  const [isAutoRecovering, setIsAutoRecovering] = useState(false);
  const copyResetTimer = useRef<number | null>(null);
  const trackedRef = useRef(false);

  const t = useCallback(
    (key: keyof Messages): string => messages[locale][key] || messages.en[key] || String(key),
    [locale]
  );

  // Auto-recover chunk-load errors with a one-shot reload. This is the critical
  // path for the post-SW-update refresh failure mode.
  useEffect(() => {
    if (category !== "chunk") return;
    if (readSessionFlag(CHUNK_RELOAD_SESSION_KEY)) return;

    writeSessionFlag(CHUNK_RELOAD_SESSION_KEY);
    logger.warn("[RouteErrorBoundary] Chunk load error — auto-reloading once", {
      message: error.message,
    });
    setIsAutoRecovering(true);
    const t = window.setTimeout(() => window.location.reload(), 50);
    return () => window.clearTimeout(t);
  }, [category, error.message]);

  // Clear the one-shot flag once we've rendered without the chunk category, so the
  // next deploy can also auto-recover. Effectively a "good boot" signal.
  useEffect(() => {
    if (category !== "chunk" && readSessionFlag(CHUNK_RELOAD_SESSION_KEY)) {
      clearSessionFlag(CHUNK_RELOAD_SESSION_KEY);
    }
  }, [category]);

  // Track to PostHog (once per render). Important: this fires AFTER Router catches,
  // so by the time we run, AppProvider has mounted PostHog and the capture works.
  useEffect(() => {
    if (trackedRef.current) return;
    if (category === "chunk" && !readSessionFlag(CHUNK_RELOAD_SESSION_KEY)) return; // mid-recovery
    trackedRef.current = true;

    logger.error("Route Error Boundary caught an error", {
      error: error.message,
      stack: error.stack,
      category,
    });

    const wrapped = new Error(error.message);
    if (error.stack) wrapped.stack = error.stack;

    trackErrorBoundary(wrapped, {
      boundaryName: `RouteErrorBoundary:${category}`,
      isOffline: category === "offline",
      isNetwork: category === "network",
    });
  }, [error, category]);

  useEffect(() => {
    return () => {
      if (copyResetTimer.current !== null) {
        window.clearTimeout(copyResetTimer.current);
        copyResetTimer.current = null;
      }
    };
  }, []);

  const handleCopy = useCallback(async () => {
    const text = buildBugReport(error, category, locale);

    const writeViaApi = async (): Promise<boolean> => {
      try {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(text);
          return true;
        }
      } catch (err) {
        logger.warn("[RouteErrorBoundary] Clipboard API write failed", { err });
      }
      return false;
    };

    const writeViaSelection = (): boolean => {
      try {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.setAttribute("readonly", "");
        textarea.style.position = "fixed";
        textarea.style.top = "-1000px";
        document.body.appendChild(textarea);
        textarea.select();
        const ok = document.execCommand?.("copy") ?? false;
        document.body.removeChild(textarea);
        return ok;
      } catch (err) {
        logger.warn("[RouteErrorBoundary] Selection-based copy failed", { err });
        return false;
      }
    };

    const copied = (await writeViaApi()) || writeViaSelection();

    if (copied) {
      setCopyState("copied");
    } else {
      setCopyState("fallback");
      setShowDetails(true);
    }

    if (copyResetTimer.current !== null) {
      window.clearTimeout(copyResetTimer.current);
    }
    copyResetTimer.current = window.setTimeout(() => {
      setCopyState("idle");
      copyResetTimer.current = null;
    }, 2500);
  }, [error, category, locale]);

  const handleRetry = useCallback(() => {
    // Reload to retry from a clean route boot.
    window.location.reload();
  }, []);

  const handleHardReset = useCallback(async () => {
    try {
      if ("caches" in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((key) => caches.delete(key)));
      }
    } catch (err) {
      logger.warn("[RouteErrorBoundary] Failed to clear caches", { err });
    }
    try {
      if ("indexedDB" in window && typeof indexedDB.databases === "function") {
        const dbs = await indexedDB.databases();
        await Promise.all(
          dbs
            .filter((db) => Boolean(db.name))
            .map(
              (db) =>
                new Promise<void>((resolve) => {
                  const req = indexedDB.deleteDatabase(db.name as string);
                  req.onsuccess = () => resolve();
                  req.onerror = () => resolve();
                  req.onblocked = () => resolve();
                })
            )
        );
      }
    } catch (err) {
      logger.warn("[RouteErrorBoundary] Failed to clear IndexedDB", { err });
    }
    clearSessionFlag(CHUNK_RELOAD_SESSION_KEY);
    window.location.replace("/");
  }, []);

  if (isAutoRecovering) {
    return (
      <div className="min-h-screen bg-bg-white-0 flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 rounded-full bg-bg-soft-200 flex items-center justify-center mb-3 animate-pulse">
          <RiRefreshLine className="h-6 w-6 text-text-sub-600" />
        </div>
        <p className="text-text-sub-600 text-sm">{t("app.error.boundary.update.refreshing")}</p>
      </div>
    );
  }

  const isLoopBug = category === "loop";
  const isOfflineOrNetwork = category === "offline" || category === "network";

  return (
    <div className="min-h-screen bg-bg-white-0 flex items-center justify-center p-4">
      <div className="max-w-lg w-full">
        <div className="bg-bg-weak-50 backdrop-blur-sm rounded-3xl shadow-2xl border border-stroke-soft-200 p-8 transform animate-fade-in">
          <div className="flex flex-col items-center text-center">
            <div className="relative mb-8">
              <div className="absolute inset-0 rounded-full animate-pulse">
                <div
                  className={
                    isOfflineOrNetwork
                      ? "w-24 h-24 bg-warning-lighter rounded-full"
                      : "w-24 h-24 bg-error-lighter rounded-full"
                  }
                />
              </div>
              <div className="relative flex items-center justify-center w-24 h-24 rounded-full bg-bg-soft-200 shadow-lg">
                {category === "network" ? (
                  <RiWifiOffLine className="h-12 w-12 text-warning-base" />
                ) : category === "offline" ? (
                  <RiErrorWarningLine className="h-12 w-12 text-warning-base" />
                ) : (
                  <RiBugLine className="h-12 w-12 text-error-base" />
                )}
              </div>
            </div>

            <h1 className="text-3xl font-bold text-text-strong-950 mb-3">
              {category === "network"
                ? t("app.error.boundary.title.garden")
                : category === "offline"
                  ? t("app.error.boundary.title.maintenance")
                  : t("app.error.boundary.title.error")}
            </h1>

            <h2 className="text-lg font-semibold text-text-strong-950 mb-4">
              {category === "network"
                ? t("app.error.boundary.subtitle.connection")
                : category === "offline"
                  ? t("app.error.boundary.subtitle.technical")
                  : t("app.error.boundary.subtitle.error")}
            </h2>

            <div className="space-y-3 mb-8">
              <p className="text-text-sub-600 leading-relaxed">
                {category === "network"
                  ? t("app.error.boundary.description.network")
                  : category === "offline"
                    ? t("app.error.boundary.description.offline")
                    : isLoopBug
                      ? t("app.error.boundary.description.loop")
                      : t("app.error.boundary.description.error")}
              </p>

              {isOfflineOrNetwork && (
                <Alert variant="success" className="p-3">
                  <p className="text-sm text-success-dark font-medium">
                    {t("app.error.boundary.protection.message")}
                  </p>
                </Alert>
              )}
            </div>

            <div className="flex flex-col gap-3 w-full">
              {isLoopBug ? (
                <>
                  <Button
                    variant="primary"
                    size="medium"
                    onClick={handleHardReset}
                    label={t("app.error.boundary.action.clearData")}
                    leadingIcon={<RiRefreshLine className="h-5 w-5" />}
                    className="w-full shadow-lg"
                  />
                  <Button
                    variant="neutral"
                    size="medium"
                    onClick={() => {
                      window.location.href = "/";
                    }}
                    label={t("app.error.boundary.action.returnHome")}
                    leadingIcon={<RiHomeLine className="h-5 w-5" />}
                    className="w-full border-2 hover:bg-bg-weak-50"
                  />
                </>
              ) : (
                <>
                  <Button
                    variant="primary"
                    size="medium"
                    onClick={handleRetry}
                    label={t("app.error.boundary.action.tryAgain")}
                    leadingIcon={<RiRefreshLine className="h-5 w-5" />}
                    className="w-full shadow-lg"
                  />
                  <Button
                    variant="neutral"
                    size="medium"
                    onClick={() => {
                      window.location.href = "/";
                    }}
                    label={t("app.error.boundary.action.returnHome")}
                    leadingIcon={<RiHomeLine className="h-5 w-5" />}
                    className="w-full border-2 hover:bg-bg-weak-50"
                  />
                  <button
                    type="button"
                    onClick={handleHardReset}
                    className="text-xs text-text-sub-600 underline hover:text-text-strong-950 transition-colors"
                  >
                    {t("app.error.boundary.action.clearData")}
                  </button>
                </>
              )}
            </div>

            <div className="mt-8 w-full">
              <div className="flex flex-col gap-2">
                <Button
                  variant="neutral"
                  mode="stroke"
                  size="small"
                  onClick={handleCopy}
                  label={
                    copyState === "copied"
                      ? t("app.error.boundary.action.copied")
                      : copyState === "fallback"
                        ? t("app.error.boundary.action.copyManual")
                        : t("app.error.boundary.action.copyDetails")
                  }
                  leadingIcon={
                    copyState === "copied" ? (
                      <RiCheckLine className="h-4 w-4" />
                    ) : (
                      <RiClipboardLine className="h-4 w-4" />
                    )
                  }
                  className="w-full"
                />
                <button
                  type="button"
                  onClick={() => setShowDetails((v) => !v)}
                  className="text-xs text-text-sub-600 underline hover:text-text-strong-950 transition-colors"
                >
                  {showDetails
                    ? t("app.error.boundary.devMode.hide")
                    : t("app.error.boundary.devMode.show")}
                </button>
              </div>
              {showDetails && (
                <div className="mt-3 text-left bg-bg-soft-200 border border-stroke-soft-200 rounded-lg p-4">
                  <pre className="text-xs text-text-strong-950 overflow-auto max-h-48 whitespace-pre-wrap select-all">
                    {buildBugReport(error, category, locale)}
                  </pre>
                </div>
              )}
            </div>

            <div className="mt-8 p-4 bg-information-lighter rounded-xl border border-information-light">
              <p className="text-xs text-information-dark leading-relaxed">
                <strong>{t("app.error.boundary.help.title")}</strong>{" "}
                {t("app.error.boundary.help.description")}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
