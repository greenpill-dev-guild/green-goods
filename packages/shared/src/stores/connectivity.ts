import { onlineManager } from "@tanstack/react-query";

export type ConnectivityState = "online" | "offline" | "unavailable" | "checking";
export interface ConnectivitySnapshot {
  state: ConnectivityState;
  checkedAt?: number;
}

const readOnline = () => typeof navigator === "undefined" || navigator.onLine;
const serverSnapshot: ConnectivitySnapshot = { state: "online" };
let snapshot: ConnectivitySnapshot = { state: readOnline() ? "online" : "offline" };
const listeners = new Set<() => void>();
let probeUrl: string | undefined;
let pending: Promise<void> | undefined;
let generation = 0;
let activeController: AbortController | undefined;
let recheckTimer: ReturnType<typeof setTimeout> | undefined;
const isVisible = () => typeof document === "undefined" || document.visibilityState !== "hidden";

function publish(state: ConnectivityState, checkedAt?: number) {
  snapshot = { state, checkedAt };
  onlineManager.setOnline(state === "online");
  listeners.forEach((listener) => listener());
}

function scheduleRecheck() {
  clearTimeout(recheckTimer);
  if (probeUrl && isVisible() && snapshot.state === "unavailable") {
    recheckTimer = setTimeout(() => void check(), 30_000);
  }
}

async function check(): Promise<void> {
  if (!readOnline()) {
    generation++;
    activeController?.abort();
    publish("offline");
    return;
  }
  if (!probeUrl) {
    publish("online");
    return;
  }
  if (!isVisible()) return;
  if (pending) {
    if (!activeController?.signal.aborted) return pending;
    await pending;
    return check();
  }
  const currentGeneration = ++generation;
  const endpoint = probeUrl;
  // A healthy connection remains usable during a background check. Recovery
  // stays paused until a response actually arrives from the origin.
  if (snapshot.state !== "online") publish("checking");
  pending = (async () => {
    for (let attempt = 0; attempt < 2; attempt++) {
      const controller = new AbortController();
      activeController = controller;
      let timeout: ReturnType<typeof setTimeout> | undefined;
      try {
        const url = new URL(endpoint, window.location.origin);
        url.searchParams.set("check", `${Date.now()}-${attempt}`);
        // The worker routes this endpoint NetworkOnly. A service HTTP error
        // still proves a connection; it must not label the device offline.
        await Promise.race([
          fetch(url.href, {
            cache: "no-store",
            credentials: "same-origin",
            signal: controller.signal,
          }),
          new Promise<never>((_, reject) => {
            timeout = setTimeout(() => {
              controller.abort();
              reject(new Error("Connectivity check timed out"));
            }, 3_000);
          }),
        ]);
        if (generation === currentGeneration) publish("online", Date.now());
        return;
      } catch {
        if (generation !== currentGeneration || !isVisible()) return;
        if (!readOnline()) {
          publish("offline");
          return;
        }
      } finally {
        clearTimeout(timeout);
      }
    }
    if (generation === currentGeneration) publish("unavailable");
  })().finally(() => {
    pending = undefined;
    activeController = undefined;
    scheduleRecheck();
  });
  return pending;
}

onlineManager.setOnline(snapshot.state === "online");
// Lifecycle observation belongs to the store, not to the lifetime of its
// consumers. Android may resume before a query or banner subscribes.
onlineManager.setEventListener(() => undefined);
if (typeof window !== "undefined") {
  const offline = () => {
    generation++;
    activeController?.abort();
    clearTimeout(recheckTimer);
    publish("offline");
  };
  const resume = () => {
    if (isVisible()) void check();
    else {
      clearTimeout(recheckTimer);
      generation++;
      activeController?.abort();
    }
  };
  const online = () => void check();
  window.addEventListener("online", online);
  window.addEventListener("offline", offline);
  window.addEventListener("pageshow", resume);
  document.addEventListener("visibilitychange", resume);
  import.meta.hot?.dispose(() => {
    window.removeEventListener("online", online);
    window.removeEventListener("offline", offline);
    window.removeEventListener("pageshow", resume);
    document.removeEventListener("visibilitychange", resume);
    clearTimeout(recheckTimer);
    generation++;
    activeController?.abort();
  });
}

export const connectivityStore = {
  getSnapshot: () => onlineManager.isOnline(),
  getServerSnapshot: () => true,
  getStatusSnapshot: () => snapshot,
  getServerStatusSnapshot: () => serverSnapshot,
  // Subscriptions only observe. In particular a stale navigator.onLine hint
  // must never erase an offline event when another component mounts.
  subscribe: (listener: () => void) => onlineManager.subscribe(listener),
  subscribeStatus: (listener: () => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  configureProbe: (url: string) => {
    const endpoint = new URL(url, window.location.origin);
    if (endpoint.origin !== window.location.origin)
      throw new Error("Connectivity probe must be same-origin");
    probeUrl = endpoint.href;
    void check();
    return () => {
      probeUrl = undefined;
      generation++;
      activeController?.abort();
      clearTimeout(recheckTimer);
    };
  },
  check,
  // An individual API failure merely requests an independent origin check.
  reportNetworkFailure: () => (probeUrl ? check() : Promise.resolve()),
};
