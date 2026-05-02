import { APP_NAME, cn, useEventListener } from "@green-goods/shared";
import { RiCloseLine, RiMenuLine } from "@remixicon/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useIntl } from "react-intl";
import { Link, useLocation } from "react-router-dom";
import { PublicInstallAction } from "@/components/Public/PublicInstallAction";

const NAV_ITEMS = [
  { path: "/gardens", labelId: "public.nav.gardens", defaultLabel: "Gardens" },
  { path: "/impact", labelId: "public.nav.impact", defaultLabel: "Impact" },
  { path: "/fund", labelId: "public.nav.fund", defaultLabel: "Fund" },
  { path: "/actions", labelId: "public.nav.actions", defaultLabel: "Actions" },
] as const;

/**
 * SiteHeader — public website header for browser mode.
 *
 * Visual contract: transparent over the page top on every public route
 * (no background, no border, no blur). It fades out as the visitor scrolls
 * past the hero rather than turning into a solid sticky bar — the editorial
 * surfaces below own their own chrome, and footer nav covers wayfinding once
 * the hero leaves the viewport. The mobile drawer pins the header to its
 * fully-visible state regardless of scroll.
 *
 * Wallet connect is intentionally NOT a header CTA — it appears only at the
 * wallet-required step inside funding flows. The header CTA is `Install App`
 * (or `Open App` when the PWA is already installed) per the public browser
 * editorial direction.
 */
// Scroll distance over which the header fades from fully visible (opacity 1)
// to fully hidden (opacity 0). Picked so the header is gone roughly when the
// hero image has scrolled past, but the fade is gradual.
const HEADER_FADE_DISTANCE_PX = 220;

/**
 * Walks up from the given node to find the nearest scrollable ancestor.
 * Returns `window` if no element ancestor scrolls — the page-level scroll
 * container in this app is the wrapper from `routes/Root.tsx`, not window,
 * because that wrapper is `h-full overflow-x-hidden`.
 */
function findScrollAncestor(node: HTMLElement | null): HTMLElement | Window {
  if (typeof window === "undefined") return null as unknown as Window;
  let el: HTMLElement | null = node?.parentElement ?? null;
  while (el) {
    const cs = window.getComputedStyle(el);
    const overflowY = cs.overflowY;
    if (overflowY === "auto" || overflowY === "scroll") {
      if (el.scrollHeight > el.clientHeight) return el;
    }
    el = el.parentElement;
  }
  return window;
}

function readScrollTop(target: HTMLElement | Window): number {
  return target instanceof Window ? target.scrollY : target.scrollTop;
}

function computeHeaderOpacity(scrollTop: number): number {
  // Defensive: jsdom and some older browsers can return undefined for
  // `window.scrollY` / `el.scrollTop`. Treat any non-finite value as 0
  // so the header starts fully visible instead of NaN.
  if (!Number.isFinite(scrollTop) || scrollTop <= 0) return 1;
  if (scrollTop >= HEADER_FADE_DISTANCE_PX) return 0;
  return 1 - scrollTop / HEADER_FADE_DISTANCE_PX;
}

export const SiteHeader = () => {
  const intl = useIntl();
  const { pathname } = useLocation();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [headerOpacity, setHeaderOpacity] = useState(1);
  const [scrollTarget, setScrollTarget] = useState<HTMLElement | Window | null>(null);
  const headerRef = useRef<HTMLElement | null>(null);

  const closeDrawer = useCallback(() => setIsDrawerOpen(false), []);

  // Locate the real scroll container once mounted, then mirror its scroll
  // position into the fade opacity. The page-level scroll container is the
  // wrapper div from routes/Root.tsx (overflow-x-hidden + h-full), not window,
  // so window.scrollY would never change.
  useEffect(() => {
    const target = findScrollAncestor(headerRef.current);
    setScrollTarget(target);
    setHeaderOpacity(computeHeaderOpacity(readScrollTop(target)));
  }, [pathname]);

  useEventListener(
    scrollTarget,
    "scroll",
    () => {
      if (!scrollTarget) return;
      setHeaderOpacity(computeHeaderOpacity(readScrollTop(scrollTarget)));
    },
    { passive: true }
  );

  // Close drawer on route change.
  useEffect(() => {
    setIsDrawerOpen(false);
  }, [pathname]);

  // Close drawer on Escape key.
  useEffect(() => {
    if (!isDrawerOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsDrawerOpen(false);
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isDrawerOpen]);

  // Prevent body scroll when drawer is open.
  useEffect(() => {
    if (isDrawerOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isDrawerOpen]);

  // Drawer pins the header fully visible regardless of scroll position; the
  // user opened it deliberately and needs to read its CTAs.
  const effectiveOpacity = isDrawerOpen ? 1 : headerOpacity;
  const isFullyHidden = effectiveOpacity <= 0.02;

  return (
    <PublicInstallAction>
      {({ label, href, onClick, dataInstallAction }) => (
        <>
          <header
            ref={headerRef}
            className={cn(
              "fixed inset-x-0 top-0 z-sticky border-0 bg-transparent transition-opacity duration-[var(--spring-effects-fast-duration)] ease-out",
              isFullyHidden && "pointer-events-none"
            )}
            style={{ opacity: effectiveOpacity }}
            aria-hidden={isFullyHidden ? "true" : undefined}
            data-variant="transparent"
          >
            <div className="px-6 sm:px-10">
              <div className="mx-auto flex h-16 max-w-7xl items-center justify-between">
                {/* Logo — image only, h-8 keeps the GG mark at a stable height while w-auto
                preserves the 16:9 aspect ratio (the source asset is 819x464). */}
                <Link to="/" className="flex items-center" aria-label={APP_NAME}>
                  <img src="/icon.png" alt={APP_NAME} className="h-8 w-auto" />
                </Link>

                {/* Desktop nav — hidden on mobile. Slightly larger than the body to
              read clearly against the hero image; the parent header is fully
              transparent so contrast comes from the hero top gradient. */}
                <nav className="hidden items-center gap-2 md:flex" aria-label="Main navigation">
                  {NAV_ITEMS.map(({ path, labelId, defaultLabel }) => {
                    const isActive = pathname.startsWith(path);
                    return (
                      <Link
                        key={path}
                        to={path}
                        className={cn(
                          "rounded-lg px-3 py-2 text-base font-medium transition-colors",
                          isActive
                            ? "text-static-white"
                            : "text-static-white/90 hover:text-static-white"
                        )}
                        aria-current={isActive ? "page" : undefined}
                      >
                        {intl.formatMessage({ id: labelId, defaultMessage: defaultLabel })}
                      </Link>
                    );
                  })}
                </nav>

                {/* Desktop: Install App | Mobile: hamburger */}
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={onClick}
                    data-install-action={dataInstallAction}
                    className="hidden cursor-pointer rounded-full bg-primary-action px-4 py-2 text-sm font-semibold text-primary-action-foreground transition-colors hover:bg-primary-action-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-action focus-visible:ring-offset-2 md:inline-flex"
                  >
                    {label}
                  </button>

                  {/* Mobile hamburger */}
                  <button
                    type="button"
                    onClick={() => setIsDrawerOpen(true)}
                    className="flex h-10 w-10 items-center justify-center rounded-lg text-static-white/90 transition-colors hover:text-static-white md:hidden"
                    aria-label={intl.formatMessage({
                      id: "public.nav.openMenu",
                      defaultMessage: "Open menu",
                    })}
                    aria-expanded={isDrawerOpen}
                    aria-controls="mobile-nav-drawer"
                  >
                    <RiMenuLine className="h-6 w-6" />
                  </button>
                </div>
              </div>
            </div>
          </header>

          {/* Mobile drawer overlay */}
          {isDrawerOpen && (
            <div
              className="fixed inset-0 z-overlay md:hidden"
              role="dialog"
              aria-modal="true"
              id="mobile-nav-drawer"
            >
              <button
                type="button"
                className="absolute inset-0 bg-static-black/40"
                onClick={() => setIsDrawerOpen(false)}
                aria-label={intl.formatMessage({
                  id: "public.nav.closeMenu",
                  defaultMessage: "Close menu",
                })}
              />

              <nav
                className="absolute inset-y-0 left-0 flex w-72 flex-col bg-bg-white-0 shadow-xl"
                aria-label="Mobile navigation"
              >
                <div className="flex h-16 items-center justify-between border-b border-stroke-soft-200 px-4">
                  <Link
                    to="/"
                    className="flex items-center"
                    aria-label={APP_NAME}
                    onClick={() => setIsDrawerOpen(false)}
                  >
                    <img src="/icon.png" alt={APP_NAME} className="h-8 w-auto" />
                  </Link>
                  <button
                    type="button"
                    onClick={() => setIsDrawerOpen(false)}
                    className="flex h-10 w-10 items-center justify-center rounded-lg text-text-sub-600 hover:text-text-strong-950"
                    aria-label={intl.formatMessage({
                      id: "public.nav.closeMenu",
                      defaultMessage: "Close menu",
                    })}
                  >
                    <RiCloseLine className="h-6 w-6" />
                  </button>
                </div>

                <div className="flex flex-1 flex-col gap-1 p-4">
                  {NAV_ITEMS.map(({ path, labelId, defaultLabel }) => {
                    const isActive = pathname.startsWith(path);
                    return (
                      <Link
                        key={path}
                        to={path}
                        className={cn(
                          "rounded-lg px-3 py-3 text-base transition-colors",
                          isActive
                            ? "bg-primary-base/10 font-medium text-primary-base"
                            : "text-text-sub-600 hover:bg-bg-weak-50 hover:text-text-strong-950"
                        )}
                        aria-current={isActive ? "page" : undefined}
                      >
                        {intl.formatMessage({ id: labelId, defaultMessage: defaultLabel })}
                      </Link>
                    );
                  })}
                </div>

                <div className="border-t border-stroke-soft-200 p-4">
                  <a
                    href={href}
                    data-install-action={dataInstallAction}
                    onClick={(event) => {
                      closeDrawer();
                      onClick(event);
                    }}
                    className="block w-full cursor-pointer rounded-lg bg-primary-action px-4 py-3 text-center text-sm font-medium text-primary-action-foreground transition-colors hover:bg-primary-action-hover"
                  >
                    {label}
                  </a>
                </div>
              </nav>
            </div>
          )}
        </>
      )}
    </PublicInstallAction>
  );
};
