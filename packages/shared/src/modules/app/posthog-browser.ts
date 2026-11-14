import { type CaptureResult, posthog } from "posthog-js";
import { flushCrashReports } from "./crash-reports";
import { getAppContext, restoreExceptionTopLevelProps, track } from "./posthog";
import { isReportingCeremonyPath, redactPrivatePaths } from "./private-paths";
import { registerTelemetrySink } from "./telemetry-sink";

const POSTHOG_API_HOST = "https://us.i.posthog.com";
const EXTENSION_TAB_ERROR = /^No tab with id: \d+\.$/;
// Vercel injects its Live feedback toolbar on preview deployments such as beta. Its script calls
// browser APIs that older engines lack, such as the Popover API before Chrome 114.
const VERCEL_TOOLBAR_ORIGIN = "https://vercel.live/";
// When a navigation interrupts an in-flight view transition, the browser skips it and rejects
// its `ready` promise with an AbortError. react-router never handles that promise, so it lands
// as an unhandled rejection even though the route still commits. posthog-js stores the
// DOMException name as a value prefix ("AbortError: ..."). Anchoring on it keeps other skip
// reasons visible, such as a duplicate view-transition-name, which engines word almost the same
// way but raise as InvalidStateError. The alternatives match Chromium, WebKit, and Gecko.
const SKIPPED_TRANSITION_ERROR = /^AbortError: .*(?:transition was skipped|view ?transition)/i;
let initializedKey: string | null = null;

type ExceptionEntry = {
  mechanism?: { handled?: unknown; synthetic?: unknown };
  stacktrace?: { frames?: unknown };
  value?: unknown;
};

function exceptionFrames(entries: ExceptionEntry[]): unknown[] {
  return entries.flatMap((entry) =>
    Array.isArray(entry?.stacktrace?.frames) ? entry.stacktrace.frames : []
  );
}

function frameFilename(frame: unknown): string | undefined {
  const filename = (frame as { filename?: unknown } | null)?.filename;
  return typeof filename === "string" ? filename : undefined;
}

/** Drop extension-owned exceptions while preserving frameless application failures. */
export function dropExtensionExceptions(event: CaptureResult | null): CaptureResult | null {
  if (!event || event.event !== "$exception" || !event.properties) return event;

  const list = event.properties.$exception_list;
  if (!Array.isArray(list)) return event;

  const entries = list as ExceptionEntry[];
  const frames = exceptionFrames(entries);
  if (frames.some((frame) => frameFilename(frame)?.includes("extension://"))) return null;

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

/** Drop exceptions thrown inside the Vercel Live feedback toolbar script. */
export function dropVercelToolbarExceptions(event: CaptureResult | null): CaptureResult | null {
  if (!event || event.event !== "$exception" || !event.properties) return event;

  const list = event.properties.$exception_list;
  if (!Array.isArray(list)) return event;

  const frames = exceptionFrames(list as ExceptionEntry[]);
  const hasToolbarFrame = frames.some((frame) =>
    frameFilename(frame)?.startsWith(VERCEL_TOOLBAR_ORIGIN)
  );

  return hasToolbarFrame ? null : event;
}

/** Drop the AbortError raised when a queued view transition is skipped by the next navigation. */
export function dropSkippedTransitionExceptions(event: CaptureResult | null): CaptureResult | null {
  if (!event || event.event !== "$exception" || !event.properties) return event;

  const list = event.properties.$exception_list;
  if (!Array.isArray(list)) return event;

  const entries = list as ExceptionEntry[];
  const isSkippedTransition = entries.some(
    (entry) => typeof entry?.value === "string" && SKIPPED_TRANSITION_ERROR.test(entry.value)
  );

  return isSkippedTransition ? null : event;
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
    // `node scripts/dev/tunnel.js` exposes the local dev server over a generated
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

// Element-level capture can carry what a ceremony page displays: pairing codes, accounts, reports.
const CEREMONY_ELEMENT_EVENTS = new Set(["$snapshot", "$autocapture", "$rageclick", "$dead_click"]);

function redactStrings(value: unknown, depth: number): unknown {
  if (typeof value === "string") return redactPrivatePaths(value);
  if (depth > 4 || value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map((entry) => redactStrings(entry, depth + 1));
  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [key, redactStrings(entry, depth + 1)])
  );
}

/** Keep reporting ceremony links and page content out of analytics. */
export function protectReportingCeremonies(event: CaptureResult | null): CaptureResult | null {
  if (!event) return event;
  const onCeremony =
    typeof window !== "undefined" && isReportingCeremonyPath(window.location.pathname);
  if (onCeremony && CEREMONY_ELEMENT_EVENTS.has(event.event)) return null;
  return {
    ...event,
    properties: redactStrings(event.properties, 0) as CaptureResult["properties"],
    ...(event.$set ? { $set: redactStrings(event.$set, 0) as CaptureResult["$set"] } : {}),
    ...(event.$set_once
      ? { $set_once: redactStrings(event.$set_once, 0) as CaptureResult["$set_once"] }
      : {}),
  };
}

/** Load and connect the browser analytics transport after the application is interactive. */
export function initializePostHog(apiKey: string): void {
  if (!apiKey || initializedKey === apiKey) return;

  posthog.init(apiKey, {
    api_host: POSTHOG_API_HOST,
    capture_exceptions: true,
    before_send: [
      protectReportingCeremonies,
      dropDevelopmentHostExceptions,
      restoreExceptionTopLevelProps,
      dropExtensionExceptions,
      dropVercelToolbarExceptions,
      dropSkippedTransitionExceptions,
    ],
    debug: import.meta.env.VITE_POSTHOG_DEBUG === "true",
  });

  registerTelemetrySink({
    // An event recorded earlier is a crash report, and the page showing a crash screen is about
    // to be reloaded: it goes out at once instead of waiting in the batch.
    capture: (event, properties, timing) =>
      posthog.capture(event, properties, timing ? { ...timing, send_instantly: true } : undefined),
    captureException: (error, properties) => posthog.captureException(error, properties),
    identify: (distinctId, properties) => posthog.identify(distinctId, properties),
    reset: () => posthog.reset(),
    getDistinctId: () => posthog.get_distinct_id(),
    register: (properties) => posthog.register(properties),
    isReady: () => typeof posthog.config?.api_host === "string",
  });
  // Crashes from before the transport existed, this visit or an earlier one, go out now, and any
  // that wait for a connection go out when it returns. The listener lives as long as the page.
  if (initializedKey === null && typeof window !== "undefined") {
    window.addEventListener("online", flushCrashReports);
    if (document.documentElement.dataset.bootPresentation === "pwa") {
      const trackStartupReady = () => {
        const mark = performance.getEntriesByName("gg-pwa-startup-ready", "mark")[0];
        if (mark)
          track("pwa_startup_ready", {
            ...getAppContext(),
            duration_ms: Math.round(mark.startTime),
          });
      };
      // Auth can become ready before or after the analytics transport connects.
      if (performance.getEntriesByName("gg-pwa-startup-ready", "mark").length) trackStartupReady();
      else window.addEventListener("gg-pwa-startup-ready", trackStartupReady, { once: true });
    }
  }
  initializedKey = apiKey;
  flushCrashReports();
}
