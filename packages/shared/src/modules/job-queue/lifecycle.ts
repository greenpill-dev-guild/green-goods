import type { JobQueueLifecycle } from "./ports";

/** Owns the queue's single browser-lifecycle listener. */
export function createBrowserJobQueueLifecycle(): JobQueueLifecycle {
  let detach: (() => void) | null = null;

  return {
    attach(cleanup) {
      if (detach || typeof window === "undefined") return detach ?? (() => undefined);
      const handleBeforeUnload = () => cleanup();
      window.addEventListener("beforeunload", handleBeforeUnload);
      detach = () => {
        window.removeEventListener("beforeunload", handleBeforeUnload);
        detach = null;
      };
      return detach;
    },
  };
}
