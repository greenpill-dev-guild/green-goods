import { posthog } from "posthog-js";

const IS_DEV = import.meta.env.DEV;

posthog.init(import.meta.env.VITE_PUBLIC_POSTHOG_KEY, {
  api_host: import.meta.env.VITE_PUBLIC_POSTHOG_HOST,
  debug: IS_DEV,
});

export function track(event: string, properties: Record<string, any>) {
  if (!IS_DEV) {
    console.log("track", event, properties);
  } else {
    posthog.capture(event, properties);
  }
}

export function identify(distinctId: string) {
  if (!IS_DEV) {
    console.log("identify", distinctId);
  } else {
    posthog.identify(distinctId);
  }
}

export function reset() {
  if (IS_DEV) {
    console.log("reset");
  } else {
    posthog.reset();
  }
}

export function getDistinctId() {
  if (IS_DEV) {
    console.log("getDistinctId");
  } else {
    return posthog.get_distinct_id();
  }
}
