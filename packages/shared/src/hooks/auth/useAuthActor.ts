import { useEffect, useMemo } from "react";
import type { PasskeyAdapters } from "../../workflows/auth-passkey-adapters";
import { createAuthActor, getAuthActor } from "../../workflows/authActor";
import { createAuthServices } from "../../workflows/authServices";

export function useAuthActor(adapters?: PasskeyAdapters) {
  const actor = useMemo(() => {
    if (typeof window === "undefined") return null;
    return adapters ? createAuthActor(createAuthServices(adapters)) : getAuthActor();
  }, [adapters]);

  useEffect(() => {
    if (!actor || !adapters) return;
    actor.start();
    return () => {
      actor.stop();
    };
  }, [actor, adapters]);

  return actor;
}
