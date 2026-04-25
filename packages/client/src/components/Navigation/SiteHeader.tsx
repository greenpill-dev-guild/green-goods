import { APP_NAME, cn, useAppKit } from "@green-goods/shared";
import { RiMenuLine, RiCloseLine } from "@remixicon/react";
import { useCallback, useEffect, useState } from "react";
import { useIntl } from "react-intl";
import { Link, useLocation } from "react-router-dom";

const NAV_ITEMS = [
  { path: "/gardens", labelId: "public.nav.gardens", defaultLabel: "Gardens" },
  { path: "/actions", labelId: "public.nav.actions", defaultLabel: "Actions" },
  { path: "/impact", labelId: "public.nav.impact", defaultLabel: "Impact" },
  { path: "/fund", labelId: "public.nav.fund", defaultLabel: "Fund" },
] as const;

/**
 * SiteHeader — public website header for browser mode.
 *
 * Desktop: horizontal nav links with Connect Wallet button on the right.
 * Mobile (<768px): hamburger button that opens a slide-in drawer with nav links.
 *
 * Sticky, with backdrop blur. No bottom nav in browser mode (D6).
 */
export const SiteHeader = () => {
  const intl = useIntl();
  const { pathname } = useLocation();
  const { open: openWalletModal } = useAppKit();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Close drawer on route change
  useEffect(() => {
    setIsDrawerOpen(false);
  }, [pathname]);

  // Close drawer on Escape key
  useEffect(() => {
    if (!isDrawerOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsDrawerOpen(false);
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isDrawerOpen]);

  // Prevent body scroll when drawer is open
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

  const handleConnectWallet = useCallback(() => {
    openWalletModal();
  }, [openWalletModal]);

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

          {/* Desktop: Connect Wallet button | Mobile: hamburger */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleConnectWallet}
              className="hidden rounded-lg bg-primary-action px-4 py-2 text-sm font-medium text-primary-action-foreground transition-colors hover:bg-primary-action-hover md:block"
            >
              {intl.formatMessage({
                id: "public.nav.connectWallet",
                defaultMessage: "Connect Wallet",
              })}
            </button>

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
          {/* Backdrop */}
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            onClick={() => setIsDrawerOpen(false)}
            aria-label={intl.formatMessage({
              id: "public.nav.closeMenu",
              defaultMessage: "Close menu",
            })}
          />

          {/* Drawer panel — slides in from left */}
          <nav
            className="absolute inset-y-0 left-0 flex w-72 flex-col bg-bg-white-0 shadow-xl"
            aria-label="Mobile navigation"
          >
            {/* Drawer header */}
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

            {/* Nav links stacked vertically */}
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
                        : "text-text-sub-600 hover:text-text-strong-950 hover:bg-bg-weak-50"
                    )}
                    aria-current={isActive ? "page" : undefined}
                  >
                    {intl.formatMessage({ id: labelId, defaultMessage: defaultLabel })}
                  </Link>
                );
              })}
            </div>

            {/* Connect Wallet at bottom of drawer */}
            <div className="border-t border-stroke-soft-200 p-4">
              <button
                type="button"
                onClick={() => {
                  setIsDrawerOpen(false);
                  handleConnectWallet();
                }}
                className="w-full rounded-lg bg-primary-action px-4 py-3 text-sm font-medium text-primary-action-foreground transition-colors hover:bg-primary-action-hover"
              >
                {intl.formatMessage({
                  id: "public.nav.connectWallet",
                  defaultMessage: "Connect Wallet",
                })}
              </button>
            </div>
          </nav>
        </div>
      )}
    </>
  );
};
