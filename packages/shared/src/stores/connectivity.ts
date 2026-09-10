import { onlineManager } from "@tanstack/react-query";

// TanStack Query and every UI consumer share one source of connectivity events.
// This is a connectivity hint, not a gate for drafting or queuing work.
const readOnline = () => typeof navigator === "undefined" || navigator.onLine;
onlineManager.setOnline(readOnline());
onlineManager.setEventListener((setOnline) => {
  if (typeof window === "undefined") return;
  const online = () => setOnline(true);
  const offline = () => setOnline(false);
  const resume = () => {
    if (document.visibilityState === "visible") setOnline(readOnline());
  };
  window.addEventListener("online", online);
  window.addEventListener("offline", offline);
  document.addEventListener("visibilitychange", resume);
  return () => {
    window.removeEventListener("online", online);
    window.removeEventListener("offline", offline);
    document.removeEventListener("visibilitychange", resume);
  };
});

export const connectivityStore = {
  getSnapshot: () => onlineManager.isOnline(),
  getServerSnapshot: () => true,
  subscribe: (listener: () => void) => {
    onlineManager.setOnline(readOnline());
    return onlineManager.subscribe(listener);
  },
};
