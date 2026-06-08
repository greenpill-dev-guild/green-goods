import { useEffect, useLayoutEffect, useRef } from "react";
import { Outlet, ScrollRestoration, useLocation } from "react-router-dom";
import { SiteHeader } from "@/components/Navigation/SiteHeader";

const PUBLIC_SCROLL_ROOT_ID = "client-scroll-root";
const PUBLIC_SCROLL_PRESERVED_SEARCH_PARAMS = new Set(["manage"]);
const PUBLIC_SCROLL_DISMISSED_ON_MANAGEMENT_OPEN_SEARCH_PARAMS = new Set(["intent"]);

type PublicScrollPosition = {
  left: number;
  top: number;
};

type PublicRouteSnapshot = {
  hash: string;
  pathname: string;
  search: string;
};

function getPublicScrollRoot(): HTMLElement | null {
  return document.getElementById(PUBLIC_SCROLL_ROOT_ID);
}

function scrollPublicRootToTop() {
  const scrollRoot = getPublicScrollRoot();
  if (scrollRoot) {
    scrollRoot.scrollTop = 0;
    scrollRoot.scrollLeft = 0;
    scrollRoot.scrollTo?.({ top: 0, left: 0, behavior: "auto" });
  }
  window.scrollTo({ top: 0, left: 0, behavior: "auto" });
}

function readPublicScrollPosition(): PublicScrollPosition {
  const scrollRoot = getPublicScrollRoot();
  if (scrollRoot) {
    return { left: scrollRoot.scrollLeft, top: scrollRoot.scrollTop };
  }
  return { left: window.scrollX, top: window.scrollY };
}

function restorePublicScrollPosition(position: PublicScrollPosition) {
  const scrollRoot = getPublicScrollRoot();
  if (scrollRoot) {
    scrollRoot.scrollTop = position.top;
    scrollRoot.scrollLeft = position.left;
    scrollRoot.scrollTo?.({ top: position.top, left: position.left, behavior: "auto" });
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    return;
  }

  window.scrollTo({ top: position.top, left: position.left, behavior: "auto" });
}

function scrollToHashTarget(hash: string): boolean {
  if (!hash) return false;
  const rawTargetId = hash.replace(/^#/, "");
  let targetId = rawTargetId;
  try {
    targetId = decodeURIComponent(rawTargetId);
  } catch {
    targetId = rawTargetId;
  }
  if (!targetId) return false;
  const target = document.getElementById(targetId);
  if (!target) return false;
  target.scrollIntoView({ block: "start", behavior: "auto" });
  return true;
}

function getChangedSearchParamNames(previousSearch: string, nextSearch: string): Set<string> {
  const previous = new URLSearchParams(previousSearch);
  const next = new URLSearchParams(nextSearch);
  const names = new Set([...previous.keys(), ...next.keys()]);
  const changed = new Set<string>();

  for (const name of names) {
    if (previous.getAll(name).join("\u0000") !== next.getAll(name).join("\u0000")) {
      changed.add(name);
    }
  }

  return changed;
}

function shouldPreservePublicSearchScroll(previousSearch: string, nextSearch: string): boolean {
  const previousParams = new URLSearchParams(previousSearch);
  const nextParams = new URLSearchParams(nextSearch);
  const changedParamNames = getChangedSearchParamNames(previousSearch, nextSearch);
  if (changedParamNames.size === 0) return false;

  if (
    Array.from(changedParamNames).every((name) => PUBLIC_SCROLL_PRESERVED_SEARCH_PARAMS.has(name))
  ) {
    return true;
  }

  const didOpenManagement =
    previousParams.get("manage") !== nextParams.get("manage") &&
    nextParams.get("manage") === "endowments";

  if (!didOpenManagement) return false;

  return Array.from(changedParamNames).every(
    (name) =>
      PUBLIC_SCROLL_PRESERVED_SEARCH_PARAMS.has(name) ||
      (PUBLIC_SCROLL_DISMISSED_ON_MANAGEMENT_OPEN_SEARCH_PARAMS.has(name) &&
        previousParams.has(name) &&
        !nextParams.has(name))
  );
}

function useLatestPublicScrollPositionRef() {
  const scrollPositionRef = useRef<PublicScrollPosition>({ left: 0, top: 0 });
  const interactionScrollPositionRef = useRef<PublicScrollPosition | null>(null);

  useEffect(() => {
    const scrollTarget = getPublicScrollRoot() ?? window;
    const updateScrollPosition = () => {
      scrollPositionRef.current = readPublicScrollPosition();
    };
    const captureInteractionScrollPosition = () => {
      interactionScrollPositionRef.current = readPublicScrollPosition();
    };

    updateScrollPosition();
    scrollTarget.addEventListener("scroll", updateScrollPosition, { passive: true });
    document.addEventListener("pointerdown", captureInteractionScrollPosition, {
      capture: true,
      passive: true,
    });
    document.addEventListener("click", captureInteractionScrollPosition, {
      capture: true,
      passive: true,
    });
    document.addEventListener("keydown", captureInteractionScrollPosition, { capture: true });

    return () => {
      scrollTarget.removeEventListener("scroll", updateScrollPosition);
      document.removeEventListener("pointerdown", captureInteractionScrollPosition, {
        capture: true,
      });
      document.removeEventListener("click", captureInteractionScrollPosition, { capture: true });
      document.removeEventListener("keydown", captureInteractionScrollPosition, { capture: true });
    };
  }, []);

  return { interactionScrollPositionRef, scrollPositionRef };
}

function usePublicRouteScrollReset() {
  const { hash, pathname, search } = useLocation();
  const previousRouteRef = useRef<PublicRouteSnapshot | null>(null);
  const { interactionScrollPositionRef, scrollPositionRef } = useLatestPublicScrollPositionRef();

  useLayoutEffect(() => {
    const previousRoute = previousRouteRef.current;
    previousRouteRef.current = { hash, pathname, search };

    const isInitialRender = previousRoute === null;
    const didPathnameChange = previousRoute?.pathname !== pathname;
    const didHashChange = previousRoute?.hash !== hash;
    const didSearchChange = previousRoute?.search !== search;

    if (
      !isInitialRender &&
      !didPathnameChange &&
      !didHashChange &&
      didSearchChange &&
      shouldPreservePublicSearchScroll(previousRoute.search, search)
    ) {
      const preservedPosition = interactionScrollPositionRef.current ?? scrollPositionRef.current;
      interactionScrollPositionRef.current = null;
      restorePublicScrollPosition(preservedPosition);
      const frame = requestAnimationFrame(() => restorePublicScrollPosition(preservedPosition));
      return () => cancelAnimationFrame(frame);
    }

    if (!isInitialRender && !didPathnameChange && !didHashChange && !didSearchChange) return;

    if (scrollToHashTarget(hash)) return;
    scrollPublicRootToTop();
    interactionScrollPositionRef.current = null;
    scrollPositionRef.current = { left: 0, top: 0 };
  }, [hash, interactionScrollPositionRef, pathname, scrollPositionRef, search]);
}

/**
 * PublicShell — layout wrapper for public routes (no auth required).
 *
 * Provides the SiteHeader (top navigation) and a main content area.
 * Used for the public-facing website experience (browser mode).
 */
export default function PublicShell() {
  usePublicRouteScrollReset();

  return (
    <div className="flex min-h-screen flex-col bg-bg-white-0">
      <SiteHeader />
      <main className="vt-main flex-1">
        <Outlet />
      </main>
      <ScrollRestoration />
    </div>
  );
}
