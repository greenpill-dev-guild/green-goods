import { useCallback, useEffect, useRef } from "react";
import {
  getSignOutRevision,
  publishSignOut,
  SIGN_OUT_REVISION_KEY,
} from "../../modules/auth/sessionSignOut";

/** Same-origin logout delivery, including a tab returning from suspension. */
export function useCrossTabSignOut(endSession: () => void) {
  const revisionRef = useRef(getSignOutRevision());

  const syncSignOut = useCallback(() => {
    const revision = getSignOutRevision();
    if (revision === revisionRef.current) return false;
    revisionRef.current = revision;
    endSession();
    return true;
  }, [endSession]);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (
        event.storageArea === localStorage &&
        (event.key === SIGN_OUT_REVISION_KEY || event.key === null)
      ) {
        syncSignOut();
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") syncSignOut();
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener("pageshow", syncSignOut);
    document.addEventListener("visibilitychange", onVisibility);
    syncSignOut();
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("pageshow", syncSignOut);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [syncSignOut]);

  const notifySignOut = useCallback(() => {
    revisionRef.current = publishSignOut();
  }, []);

  // Explicit sign-in first observes any outstanding logout. A queued storage
  // event then cannot tear down that newer, deliberately chosen session.
  return { syncSignOut, notifySignOut };
}
