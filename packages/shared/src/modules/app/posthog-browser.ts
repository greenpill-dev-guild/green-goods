import { type CaptureResult, posthog } from "posthog-js";
import { registerTelemetrySink, restoreExceptionTopLevelProps } from "./posthog";

const POSTHOG_API_HOST = "https://us.i.posthog.com";
const EXTENSION_TAB_ERROR = /^No tab with id: \d+\.$/;
let initializedKey: string | null = null;

type ExceptionEntry = {
  mechanism?: { handled?: unknown; synthetic?: unknown };
  stacktrace?: { frames?: unknown };
  value?: unknown;
};

/** Drop extension-owned exceptions while preserving frameless application failures. */
export function dropExtensionExceptions(event: CaptureResult | null): CaptureResult | null {
  if (!event || event.event !== "$exception" || !event.properties) return event;

  const list = event.properties.$exception_list;
  if (!Array.isArray(list)) return event;

  const entries = list as ExceptionEntry[];
  const frames = entries.flatMap((entry) =>
    Array.isArray(entry?.stacktrace?.frames) ? entry.stacktrace.frames : []
  );
  const hasExtensionFrame = frames.some((frame) => {
    const filename = (frame as { filename?: unknown } | null)?.filename;
    return typeof filename === "string" && filename.includes("extension://");
  });
  if (hasExtensionFrame) return null;

  const isKnownFramelessExtensionError =
    frames.length === 0 &&
    entries.some(
      (entry) =>
        typeof entry?.value === "string" &&
        EXTENSION_TAB_ERROR.test(entry.value) &&
        entry.mechanism?.handled === false &&
        entry.mechanism.synthetic === true
    );

  return isKnownFramelessExtensionError ? null : event;
}

/** Development hosts whose exceptions must never reach the shared production project. */
function isDevelopmentHost(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  return (
    normalized === "localhost" ||
    normalized.endsWith(".localhost") ||
    normalized === "127.0.0.1" ||
    normalized === "0.0.0.0" ||
    normalized === "::1" ||
    normalized === "[::1]" ||
    // `bun run dev:tunnel` exposes the local dev server over a generated
    // Cloudflare quick-tunnel host for mobile/device QA.
    normalized.endsWith(".trycloudflare.com")
  );
}

/** Resolve the host that raised an exception, preferring the event's own captured URL. */
function exceptionHost(event: CaptureResult): string | null {
  const currentUrl = event.properties?.$current_url;
  if (typeof currentUrl === "string") {
    try {
      return new URL(currentUrl).hostname;
    } catch {
      // A malformed URL falls through to the live location below.
    }
  }
  return typeof window !== "undefined" ? window.location.hostname : null;
}

/** Drop exceptions raised on a development host so local QA never mints issues in production. */
export function dropDevelopmentHostExceptions(event: CaptureResult | null): CaptureResult | null {
  if (!event || event.event !== "$exception") return event;

  const host = exceptionHost(event);
  return host && isDevelopmentHost(host) ? null : event;
}

/** Load and connect the browser analytics transport after the application is interactive. */
export function initializePostHog(apiKey: string): void {
  if (!apiKey || initializedKey === apiKey) return;

  posthog.init(apiKey, {
    api_host: POSTHOG_API_HOST,
    capture_exceptions: true,
    before_send: [
      dropDevelopmentHostExceptions,
      restoreExceptionTopLevelProps,
      dropExtensionExceptions,
    ],
    debug: import.meta.env.VITE_POSTHOG_DEBUG === "true",
  });

  registerTelemetrySink({
    capture: (event, properties) => posthog.capture(event, properties),
    identify: (distinctId, properties) => posthog.identify(distinctId, properties),
    reset: () => posthog.reset(),
    getDistinctId: () => posthog.get_distinct_id(),
    register: (properties) => posthog.register(properties),
    isReady: () => typeof posthog.config?.api_host === "string",
  });
  initializedKey = apiKey;
}
