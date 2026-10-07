import { useYourWorkCount } from "@green-goods/shared/hooks/work/useYourWorkCount";
import { useApp } from "@green-goods/shared/providers/App";
import { useUIStore } from "@green-goods/shared/stores/useUIStore";
import { cn } from "@green-goods/shared/utils/styles/cn";
import {
  type RemixiconComponentType,
  RiHomeFill,
  RiHomeLine,
  RiPlantFill,
  RiPlantLine,
  RiUserFill,
  RiUserLine,
} from "@remixicon/react";
import { useIntl } from "react-intl";
import { Link, useLocation } from "react-router-dom";
import { pwaStatusStyles } from "@/components/Pwa/statusStyles";
import { APP_ROUTES, isImmersiveAppRoute } from "@/config/pwaRouting";

export const AppBar = () => {
  const { pathname } = useLocation();
  const intl = useIntl();
  const { count: pendingCount } = useYourWorkCount();
  const { isPwaPresentation } = useApp();

  // Every sheet and dialog registers itself while open, so the bar steps aside
  // for all of them without a hand-maintained list (DL-015).
  const isAnySheetOpen = useUIStore((s) => s.openSheetCount > 0);
  // Browser mode shows SiteHeader only (D6); bottom nav is PWA-only
  const shouldHideBar = !isPwaPresentation || isImmersiveAppRoute(pathname) || isAnySheetOpen;

  const tabs: {
    path: string;
    title: string;
    ActiveIcon: RemixiconComponentType;
    InactiveIcon: RemixiconComponentType;
  }[] = [
    {
      path: APP_ROUTES.home,
      title: intl.formatMessage({ id: "app.home" }),
      ActiveIcon: RiHomeFill,
      InactiveIcon: RiHomeLine,
    },
    {
      path: APP_ROUTES.garden,
      title: intl.formatMessage({ id: "app.garden" }),
      ActiveIcon: RiPlantFill,
      InactiveIcon: RiPlantLine,
    },
    {
      path: APP_ROUTES.profile,
      title: intl.formatMessage({ id: "app.profile" }),
      ActiveIcon: RiUserFill,
      InactiveIcon: RiUserLine,
    },
  ];

  return (
    <nav
      data-testid="authenticated-nav"
      className={cn(
        // Keep AppBar above page content (z-nav), but below modal/drawer overlays (z-overlay/z-modal).
        // Hide AppBar on routes that own their chrome (Submit Work, a garden's pages) or when any sheet is open.
        // vt-app-bar keeps it above the page cross-fade when switching tabs.
        "vt-app-bar fixed bottom-0 bg-bg-white-0 border-t border-t-stroke-soft-200 rounded-t-[var(--radius-lg)] overflow-hidden flex flex-row justify-evenly items-center w-full py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] z-nav transition-transform duration-[var(--spring-spatial-duration)] ease-[var(--spring-spatial-easing)]",
        shouldHideBar ? "translate-y-full" : "translate-y-0"
      )}
      // Off screen is out of reach too: no tab stops or screen-reader links.
      inert={shouldHideBar}
    >
      {tabs.map(({ path, ActiveIcon, InactiveIcon, title }) => {
        const isHome = path === APP_ROUTES.home;
        const isActive = isHome
          ? pathname === APP_ROUTES.home ||
            (pathname.startsWith(`${APP_ROUTES.home}/`) &&
              pathname !== APP_ROUTES.garden &&
              pathname !== APP_ROUTES.profile &&
              pathname !== APP_ROUTES.login)
          : pathname === path || pathname.startsWith(`${path}/`);
        const showBadge = isHome && pendingCount > 0;
        return (
          <Link
            to={path}
            key={title}
            viewTransition
            // A destination tab: it answers a press with the tab's selection tap.
            data-pressable="tab"
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "flex flex-col items-center",
              isActive && "active tab-active text-primary-on-surface focus:outline-hidden",
              !isActive && "text-text-soft-400"
            )}
          >
            <div className="relative">
              {isActive ? <ActiveIcon className="w-6 h-6" /> : <InactiveIcon className="w-6 h-6" />}
              {showBadge && (
                <span
                  className={cn(
                    "absolute -top-1 -right-1.5 min-w-4 h-4 flex items-center justify-center rounded-full text-[10px] font-bold leading-none px-1",
                    pwaStatusStyles.primary.badge
                  )}
                >
                  {pendingCount > 9 ? "9+" : pendingCount}
                </span>
              )}
            </div>
            <p className={cn("text-sm", isActive && "text-primary-on-surface")}>{title}</p>
          </Link>
        );
      })}
    </nav>
  );
};
