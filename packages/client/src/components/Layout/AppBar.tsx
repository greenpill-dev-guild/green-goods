import { cn } from "@green-goods/shared/utils/styles/cn";
import { SyncStatusBar } from "@green-goods/shared/components/SyncStatusBar";
import { useApp } from "@green-goods/shared/providers/App";
import { usePendingWorksCount } from "@green-goods/shared/hooks/work/usePendingWorksCount";
import { useUIStore } from "@green-goods/shared/stores/useUIStore";
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
import { APP_ROUTES, LEGACY_APP_ROUTES } from "@/config/pwaRouting";

export const AppBar = () => {
  const { pathname } = useLocation();
  const isGarden =
    pathname === APP_ROUTES.garden ||
    pathname.startsWith(`${APP_ROUTES.garden}/`) ||
    pathname === LEGACY_APP_ROUTES.garden ||
    pathname.startsWith(`${LEGACY_APP_ROUTES.garden}/`);
  const isWorkDetail = pathname.includes("/work/");
  // A commitment's detail and composer carry their own fixed action bar, and
  // the nav underneath it would sit exactly where the thumb lands.
  const isCommitmentRoute = pathname.includes("/commitments/");
  const intl = useIntl();
  const { data: pendingCount = 0 } = usePendingWorksCount();
  const { isPwaPresentation } = useApp();

  // Every sheet and dialog registers itself while open, so the bar steps aside
  // for all of them without a hand-maintained list (DL-015).
  const isAnySheetOpen = useUIStore((s) => s.openSheetCount > 0);
  // Browser mode shows SiteHeader only (D6); bottom nav is PWA-only
  const shouldHideBar =
    !isPwaPresentation || isGarden || isWorkDetail || isCommitmentRoute || isAnySheetOpen;

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
    <>
      <SyncStatusBar
        className={cn(
          "bottom-[calc(69px+env(safe-area-inset-bottom))] rounded-t-[var(--radius-lg)] overflow-hidden transition-transform duration-[var(--spring-spatial-duration)] ease-[var(--spring-spatial-easing)]",
          shouldHideBar ? "translate-y-full" : "translate-y-0"
        )}
      />
      <nav
        data-testid="authenticated-nav"
        className={cn(
          // Keep AppBar above page content (z-nav), but below modal/drawer overlays (z-overlay/z-modal).
          // Hide AppBar when on garden submission routes, work detail pages, or when any drawer is open.
          "fixed bottom-0 bg-bg-white-0 border-t border-t-stroke-soft-200 rounded-t-[var(--radius-lg)] overflow-hidden flex flex-row justify-evenly items-center w-full py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] z-nav transition-transform duration-[var(--spring-spatial-duration)] ease-[var(--spring-spatial-easing)]",
          shouldHideBar ? "translate-y-full" : "translate-y-0"
        )}
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
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex flex-col items-center",
                isActive && "active tab-active text-primary focus:outline-hidden",
                !isActive && "text-text-soft-400"
              )}
            >
              <div className="relative">
                {isActive ? (
                  <ActiveIcon className="w-6 h-6" />
                ) : (
                  <InactiveIcon className="w-6 h-6" />
                )}
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
              <p className={cn("text-sm", isActive && "text-primary")}>{title}</p>
            </Link>
          );
        })}
      </nav>
    </>
  );
};
