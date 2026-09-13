import { useEffect, useLayoutEffect, useRef } from "react";

const DOCUMENT_SCROLL_LOCK_CLASS = "modal-open";
const documentScrollLockOwners = new Set<symbol>();
const LOCKED_BODY_PROPERTIES = ["position", "top", "left", "width", "overflow"] as const;
let savedDocument: {
  left: number;
  top: number;
  styles: Array<{ property: string; value: string; priority: string }>;
} | null = null;

/** The page position remains meaningful while its body is fixed behind an overlay. */
export function getDocumentScrollPosition(): { left: number; top: number } {
  return savedDocument
    ? { left: savedDocument.left, top: savedDocument.top }
    : { left: window.scrollX, top: window.scrollY };
}

function reconcileDocumentScrollLock(): void {
  if (typeof document === "undefined") return;
  const locked = documentScrollLockOwners.size > 0;
  const body = document.body;
  if (locked && !savedDocument) {
    savedDocument = {
      left: window.scrollX,
      top: window.scrollY,
      styles: LOCKED_BODY_PROPERTIES.map((property) => ({
        property,
        value: body.style.getPropertyValue(property),
        priority: body.style.getPropertyPriority(property),
      })),
    };
    // Fix only the background while an overlay owns it, including on iOS.
    // Radix RemoveScroll also owns some dialogs and injects position:relative!important.
    body.style.setProperty("position", "fixed", "important");
    body.style.top = `-${savedDocument.top}px`;
    body.style.left = `-${savedDocument.left}px`;
    body.style.width = "100%";
    body.style.overflow = "hidden";
  }
  document.documentElement.classList.toggle(DOCUMENT_SCROLL_LOCK_CLASS, locked);
  if (!locked && savedDocument) {
    const previous = savedDocument;
    savedDocument = null;
    for (const { property, value, priority } of previous.styles) {
      if (value) body.style.setProperty(property, value, priority);
      else body.style.removeProperty(property);
    }
    window.scrollTo({ left: previous.left, top: previous.top, behavior: "instant" });
  }
}

/**
 * Owns one share of the application-level document scroll lock.
 * The global class is removed only after the final mounted owner releases it.
 */
export function useDocumentScrollLock(active: boolean): void {
  const ownerRef = useRef(Symbol("document-scroll-lock-owner"));

  useLayoutEffect(() => {
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
