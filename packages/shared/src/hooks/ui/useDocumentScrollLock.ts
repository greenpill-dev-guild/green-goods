import { useEffect, useLayoutEffect, useRef } from "react";

const DOCUMENT_SCROLL_LOCK_CLASS = "modal-open";
const documentScrollLockOwners = new Set<symbol>();

function reconcileDocumentScrollLock(): void {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle(
    DOCUMENT_SCROLL_LOCK_CLASS,
    documentScrollLockOwners.size > 0
  );
}

/**
 * Owns one share of the application-level document scroll lock.
 * The global class is removed only after the final mounted owner releases it.
 */
export function useDocumentScrollLock(active: boolean): void {
  const ownerRef = useRef(Symbol("document-scroll-lock-owner"));

  useEffect(() => {
    const owner = ownerRef.current;
    if (!active) {
      documentScrollLockOwners.delete(owner);
      reconcileDocumentScrollLock();
      return;
    }

    documentScrollLockOwners.add(owner);
    reconcileDocumentScrollLock();

    return () => {
      documentScrollLockOwners.delete(owner);
      reconcileDocumentScrollLock();
    };
  }, [active]);
}

/**
 * Reconciles the DOM projection of active scroll-lock ownership after route
 * changes and installed-PWA page lifecycle transitions.
 */
export function useDocumentScrollLockLifecycle(routeKey: string): void {
  useLayoutEffect(() => {
    reconcileDocumentScrollLock();
  }, [routeKey]);

  useEffect(() => {
    const reconcile = () => reconcileDocumentScrollLock();

    window.addEventListener("pagehide", reconcile);
    window.addEventListener("pageshow", reconcile);
    document.addEventListener("visibilitychange", reconcile);
    reconcile();

    return () => {
      window.removeEventListener("pagehide", reconcile);
      window.removeEventListener("pageshow", reconcile);
      document.removeEventListener("visibilitychange", reconcile);
    };
  }, []);
}
