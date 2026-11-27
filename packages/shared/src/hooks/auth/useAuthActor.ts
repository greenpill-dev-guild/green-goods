import { useEffect, useMemo } from "react";
import { invalidateSmartAccountClientResolver } from "../../modules/auth/smartAccountClientResolver";
import type { OpenfortSessionServices } from "../../workflows/auth-openfort-session";
import type { PasskeyAdapters } from "../../workflows/auth-passkey-adapters";
import { createAuthActor, getAuthActor } from "../../workflows/authActor";
import { createAuthServices } from "../../workflows/authServices";

/** Injected adapters or Openfort services give the provider its own actor (tests, stories). */
export function useAuthActor(adapters?: PasskeyAdapters, openfort?: OpenfortSessionServices) {
  const actor = useMemo(() => {
    if (typeof window === "undefined") return null;
    return adapters || openfort
      ? createAuthActor(createAuthServices(adapters, openfort))
      : getAuthActor();
  }, [adapters, openfort]);

  useEffect(() => {
    if (!actor || !(adapters || openfort)) return;
    actor.start();
    return () => {
      invalidateSmartAccountClientResolver(actor.getSnapshot().context.resolveSmartAccountClient);
      actor.stop();
    };
  }, [actor, adapters, openfort]);

  return actor;
}
