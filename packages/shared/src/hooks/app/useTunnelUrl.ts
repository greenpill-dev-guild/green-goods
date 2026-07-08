import { useEffect, useState } from "react";

/**
 * Returns the dev-only cloudflared tunnel origin when active, or `null`.
 *
 * Polls the Vite middleware at `/__dev/tunnel`, which serves the contents of
 * the per-port `.tunnel-url` file written by `scripts/dev/tunnel.js`. The
 * effect is a no-op outside `vite dev` (gated on `MODE === "development"` so
 * test and production builds never issue the request).
 *
 * Compose with a path to build a launchable URL — e.g. for QR codes and
 * "Open App" links that must resolve on a real device while developing:
 *
 *   const tunnelUrl = useTunnelUrl();
 *   const origin = tunnelUrl ?? window.location.origin;
 *   const launchUrl = new URL(APP_ROUTES.home, origin).toString();
 */
export function useTunnelUrl(): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (import.meta.env.MODE !== "development") return;

    let cancelled = false;
    const poll = () => {
      fetch("/__dev/tunnel")
        .then((r) => r.json())
        .then((d: { url?: string | null }) => {
          if (!cancelled && d.url) setUrl(d.url);
        })
        .catch(() => {});
    };

    poll();
    const id = setInterval(poll, 5000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return url;
}
