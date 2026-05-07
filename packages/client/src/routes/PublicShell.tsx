import { useLayoutEffect } from "react";
import { Outlet, ScrollRestoration, useLocation } from "react-router-dom";
import { SiteHeader } from "@/components/Navigation/SiteHeader";

const PUBLIC_SCROLL_ROOT_ID = "client-scroll-root";

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

function usePublicRouteScrollReset() {
  const { hash, pathname, search } = useLocation();

  useLayoutEffect(() => {
    if (scrollToHashTarget(hash)) return;
    scrollPublicRootToTop();
  }, [hash, pathname, search]);
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
