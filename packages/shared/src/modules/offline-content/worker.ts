let supported = false;
const listeners = new Set<() => void>();
export function getOfflineWorkerSupport(): boolean {
  return supported;
}
export function subscribeOfflineWorker(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
function publish(value: boolean) {
  if (value === supported) return;
  supported = value;
  listeners.forEach((listener) => listener());
}

/** An old active worker cannot serve the new managed cache. Never force activation. */
export function monitorOfflineWorker(): () => void {
  let generation = 0;
  const check = () => {
    const current = ++generation;
    publish(false);
    const worker = navigator.serviceWorker?.controller;
    if (!worker || typeof MessageChannel === "undefined") return;
    const channel = new MessageChannel();
    const close = () => {
      channel.port1.close();
      channel.port2.close();
    };
    const timeout = setTimeout(close, 2000);
    channel.port1.onmessage = (event) => {
      clearTimeout(timeout);
      if (current === generation) publish(event.data?.offlineContentVersion === 1);
      close();
    };
    try {
      worker.postMessage({ type: "OFFLINE_CONTENT_CAPABILITIES" }, [channel.port2]);
    } catch {
      clearTimeout(timeout);
      close();
    }
  };
  check();
  navigator.serviceWorker?.addEventListener("controllerchange", check);
  return () => {
    generation++;
    navigator.serviceWorker?.removeEventListener("controllerchange", check);
    publish(false);
  };
}
