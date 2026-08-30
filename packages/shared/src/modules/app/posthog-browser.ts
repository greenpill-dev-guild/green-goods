import { posthog } from "posthog-js";
import { registerTelemetrySink, restoreExceptionTopLevelProps } from "./posthog";

const POSTHOG_API_HOST = "https://us.i.posthog.com";
let initializedKey: string | null = null;

/** Load and connect the browser analytics transport after the application is interactive. */
export function initializePostHog(apiKey: string): void {
  if (!apiKey || initializedKey === apiKey) return;

  posthog.init(apiKey, {
    api_host: POSTHOG_API_HOST,
    capture_exceptions: true,
    before_send: restoreExceptionTopLevelProps,
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
