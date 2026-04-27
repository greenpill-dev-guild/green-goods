import { APP_NAME, cn, useApp, useInstallGuidance } from "@green-goods/shared";
import { RiCloseLine, RiMenuLine } from "@remixicon/react";
import { useEffect, useState } from "react";
import { useIntl } from "react-intl";
import { Link, useLocation } from "react-router-dom";

const NAV_ITEMS = [
  { path: "/gardens", labelId: "public.nav.gardens", defaultLabel: "Gardens" },
  { path: "/impact", labelId: "public.nav.impact", defaultLabel: "Impact" },
  { path: "/fund", labelId: "public.nav.fund", defaultLabel: "Fund" },
  { path: "/actions", labelId: "public.nav.actions", defaultLabel: "Actions" },
] as const;

/**
 * SiteHeader — public website header for browser mode.
 *
 * Desktop: horizontal nav (Gardens, Impact, Fund, Actions) + `Install App` CTA.
 * Mobile (<768px): hamburger button that opens a slide-in drawer with nav links.
 *
 * Wallet connect is intentionally NOT a header CTA — it appears only at the
 * wallet-required step inside funding flows. The header CTA is `Install App`
 * (or `Open App` when the PWA is already installed) per the public browser
 * editorial direction.
 */
export const SiteHeader = () => {
  const intl = useIntl();
  const { pathname } = useLocation();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const { isMobile, platform, isInstalled, deferredPrompt } = useApp();
  const guidance = useInstallGuidance(
    platform,
    isMobile,
    isInstalled,
    null,
    deferredPrompt !== null
  );

  const installLabelId = isInstalled ? "public.nav.openApp" : "public.nav.installApp";
  const installDefault = isInstalled ? "Open App" : "Install App";

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

  return (
    <>
      <header className="sticky top-0 z-sticky border-b border-stroke-soft-200 bg-bg-white-0/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2">
            <img src="/icon.png" alt={`${APP_NAME} logo`} className="h-8 w-8" />
            <span className="text-lg font-bold text-text-strong-950">{APP_NAME}</span>
          </Link>

          {/* Desktop nav — hidden on mobile */}
          <nav className="hidden items-center gap-1 md:flex" aria-label="Main navigation">
            {NAV_ITEMS.map(({ path, labelId, defaultLabel }) => {
              const isActive = pathname.startsWith(path);
              return (
                <Link
                  key={path}
                  to={path}
                  className={cn(
                    "rounded-lg px-3 py-2 text-sm transition-colors",
                    isActive
                      ? "font-medium text-primary-base"
                      : "text-text-sub-600 hover:text-text-strong-950"
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
            <a
              href="#install"
              data-install-action={guidance.primaryAction.type}
              className="hidden rounded-lg bg-primary-action px-4 py-2 text-sm font-medium text-primary-action-foreground transition-colors hover:bg-primary-action-hover md:block"
            >
              {intl.formatMessage({ id: installLabelId, defaultMessage: installDefault })}
            </a>

            {/* Mobile hamburger */}
            <button
              type="button"
              onClick={() => setIsDrawerOpen(true)}
              className="flex h-10 w-10 items-center justify-center rounded-lg text-text-sub-600 hover:text-text-strong-950 md:hidden"
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
            className="absolute inset-0 bg-black/40"
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
                className="flex items-center gap-2"
                onClick={() => setIsDrawerOpen(false)}
              >
                <img src="/icon.png" alt={`${APP_NAME} logo`} className="h-8 w-8" />
                <span className="text-lg font-bold text-text-strong-950">{APP_NAME}</span>
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
                href="#install"
                data-install-action={guidance.primaryAction.type}
                onClick={() => setIsDrawerOpen(false)}
                className="block w-full rounded-lg bg-primary-action px-4 py-3 text-center text-sm font-medium text-primary-action-foreground transition-colors hover:bg-primary-action-hover"
              >
                {intl.formatMessage({ id: installLabelId, defaultMessage: installDefault })}
              </a>
            </div>
          </nav>
        </div>
      )}
    </>
  );
};
