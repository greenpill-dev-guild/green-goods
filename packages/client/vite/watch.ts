import type { ServerOptions } from "vite";

export const VITE_POLL_INTERVAL_MS = 250;

type ViteWatchOptions = Exclude<ServerOptions["watch"], null | undefined>;
type WatchEnvironment = Record<string, string | undefined>;

export function resolveViteWatchOptions(
  environment: WatchEnvironment = process.env
): ViteWatchOptions {
  const usePolling = environment.VITE_USE_POLLING === "true";

  return {
    ignored: ["**/dev-dist/**"],
    ...(usePolling ? { usePolling: true, interval: VITE_POLL_INTERVAL_MS } : {}),
  };
}
