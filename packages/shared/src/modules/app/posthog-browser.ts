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

/** Load and connect the browser analytics transport after the application is interactive. */
export function initializePostHog(apiKey: string): void {
  if (!apiKey || initializedKey === apiKey) return;

  posthog.init(apiKey, {
    api_host: POSTHOG_API_HOST,
    capture_exceptions: true,
    before_send: [restoreExceptionTopLevelProps, dropExtensionExceptions],
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
