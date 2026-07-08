/**
 * Reliable Brave detection hook.
 *
 * Brave on Android ships a Chrome user agent (it omits the "Brave" token for
 * fingerprinting resistance), so UA-based browser detection classifies it as
 * Chrome. The async `navigator.brave.isBrave()` API is the only dependable
 * signal, which is why this lives behind a hook with resolved state.
 *
 * Brave matters for PWA launch: it does not mint a WebAPK on Android, so an
 * installed app is a home-screen shortcut without OS intent filters. An in-page
 * navigation to a scoped URL therefore stays in the browser tab instead of
 * launching the standalone app (Chrome's WebAPK captures the same navigation).
 * Callers use this to give honest "open from your home screen" guidance rather
 * than a navigation that silently fails to switch into the app.
 *
 * @module hooks/app/useIsBraveBrowser
 */

import { useEffect, useState } from "react";

interface NavigatorWithBrave extends Navigator {
  brave?: {
    isBrave: () => Promise<boolean>;
  };
}

/**
 * Resolve whether the current browser is Brave.
 *
 * Returns `false` until the async check resolves (and on non-Brave browsers).
 */
export function useIsBraveBrowser(): boolean {
  const [isBrave, setIsBrave] = useState(false);

  useEffect(() => {
    let cancelled = false;

    if (typeof navigator === "undefined") return;
    const brave = (navigator as NavigatorWithBrave).brave;
    if (!brave?.isBrave) return;

    brave
      .isBrave()
      .then((result) => {
        if (!cancelled) setIsBrave(result);
      })
      .catch(() => {
        if (!cancelled) setIsBrave(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return isBrave;
}
