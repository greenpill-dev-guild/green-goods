import { getDocumentScrollPosition } from "@green-goods/shared/hooks/ui/useDocumentScrollLock";
import { toastService } from "@green-goods/shared/components/Toast/toast.service";
import { consumeAppLaunchFallback } from "@green-goods/shared/utils/app/browser";
import { useIntl } from "react-intl";
import { useEffect, useLayoutEffect, useRef } from "react";
import { Outlet, useLocation, useNavigationType } from "react-router-dom";
import { SiteHeader } from "@/components/Navigation/SiteHeader";
import { publicCuration } from "@/content/publicCuration";

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

function scrollPublicRootToTop() {
  window.scrollTo({ top: 0, left: 0, behavior: "auto" });
}

function readPublicScrollPosition(): PublicScrollPosition {
  return getDocumentScrollPosition();
}

function restorePublicScrollPosition(position: PublicScrollPosition) {
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
    const scrollTarget = window;
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
  const { hash, key, pathname, search } = useLocation();
  const navigationType = useNavigationType();
  const previousRouteRef = useRef<PublicRouteSnapshot | null>(null);
  // Preserve editorial management transitions alongside history-entry positions.
  const positionsRef = useRef<Map<string, PublicScrollPosition>>(new Map());
  const previousKeyRef = useRef<string | null>(null);
  const { interactionScrollPositionRef, scrollPositionRef } = useLatestPublicScrollPositionRef();

  useLayoutEffect(() => {
    const previousRoute = previousRouteRef.current;
    previousRouteRef.current = { hash, pathname, search };

    // Bank the outgoing entry's position before anything moves the container.
    // `scrollPositionRef` still holds where the previous route was left.
    if (previousKeyRef.current && previousKeyRef.current !== key) {
      positionsRef.current.set(previousKeyRef.current, scrollPositionRef.current);
    }
    const restoringKey = previousKeyRef.current === key ? null : key;
    previousKeyRef.current = key;

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

    // Back/forward returns the reader to where they were. That was free while
    // `/gardens/:id` was a modal over a never-unmounting grid; as a route it is
    // not. PUSH and REPLACE still start at the top, and the initial render
    // reports POP, so it stays excluded.
    if (navigationType === "POP" && !isInitialRender) {
      const saved = restoringKey ? positionsRef.current.get(restoringKey) : undefined;
      // No banked position means this entry predates the current mount — a hard
      // reload mid-history, or a shell remount. Falling through to the top is
      // right: keeping the outgoing route's offset would drop the reader into
      // the middle of a page they have not seen.
      if (!saved) {
        scrollPublicRootToTop();
        interactionScrollPositionRef.current = null;
        scrollPositionRef.current = { left: 0, top: 0 };
        return;
      }
      // The scroll listener is asynchronous, so without this a fast
      // Back → Forward → Back banks the pre-restore position for this entry.
      scrollPositionRef.current = saved;
      // The incoming route has not painted yet, so the container has no height
      // to scroll within. Re-apply across the next two frames.
      restorePublicScrollPosition(saved);
      let second = 0;
      const first = requestAnimationFrame(() => {
        restorePublicScrollPosition(saved);
        second = requestAnimationFrame(() => restorePublicScrollPosition(saved));
      });
      return () => {
        cancelAnimationFrame(first);
        if (second) cancelAnimationFrame(second);
      };
    }

    scrollPublicRootToTop();
    interactionScrollPositionRef.current = null;
    scrollPositionRef.current = { left: 0, top: 0 };
  }, [
    hash,
    interactionScrollPositionRef,
    key,
    navigationType,
    pathname,
    scrollPositionRef,
    search,
  ]);
}

/**
 * Warm every curated hero image once after the landing view paints. Each
 * public view swaps in its own hero, and the `vt-header` shared-element
 * morph cross-fades the old hero into the new one — if the incoming image
 * hasn't loaded yet, the morph lands on the deep-navy backdrop and reads as
 * a dark flash on the first visit to each view. The set is a handful of
 * local webp files, and the browser cache dedupes the current view's image.
 * Skipped under Save-Data.
 */
function useWarmPublicHeroImages() {
  useEffect(() => {
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean } })
      .connection;
    if (connection?.saveData) return;

    const sources = new Set<string>([
      publicCuration.heroImagePath,
      ...Object.values(publicCuration.viewHeroImages).filter(
        (src): src is string => typeof src === "string"
      ),
    ]);
    for (const src of sources) {
      const image = new Image();
      image.decoding = "async";
      image.src = src;
    }
  }, []);
}

/**
 * PublicShell — layout wrapper for public routes (no auth required).
 *
 * Provides the SiteHeader (top navigation) and a main content area.
 * Used for the public-facing website experience (browser mode).
 */
export default function PublicShell() {
  usePublicRouteScrollReset();
  useWarmPublicHeroImages();
  const { formatMessage } = useIntl();
  const fallbackPositionRef = useRef<PublicScrollPosition | null>(null);
  useEffect(() => {
    const position = fallbackPositionRef.current ?? consumeAppLaunchFallback();
    if (!position) return;
    fallbackPositionRef.current = position;
    const frame = requestAnimationFrame(() => {
      window.scrollTo({ ...position, behavior: "instant" });
      fallbackPositionRef.current = null;
      toastService.info({
        id: "app-launch-unavailable",
        message: formatMessage({
          id: "public.install.openFailed",
          defaultMessage: "Couldn’t open Green Goods. Open it from your apps.",
        }),
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [formatMessage]);

  return (
    <div className="flex min-h-screen flex-col bg-bg-white-0">
      <SiteHeader />
      <main className="vt-main flex-1">
        <Outlet />
      </main>
    </div>
  );
}
