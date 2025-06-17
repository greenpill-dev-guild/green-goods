import { posthog } from "posthog-js";

const IS_DEV = import.meta.env.DEV;

posthog.init(import.meta.env.VITE_PUBLIC_POSTHOG_KEY, {
  api_host: import.meta.env.VITE_PUBLIC_POSTHOG_HOST,
  debug: IS_DEV,
});

export function track(event: string, properties: Record<string, unknown>) {
  posthog.capture(event, properties);
}

export function identify(distinctId: string) {
  posthog.identify(distinctId);
}

export function reset() {
  posthog.reset();
}

export function getDistinctId() {
  return posthog.get_distinct_id();
}
