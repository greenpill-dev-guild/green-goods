import { cn, SyncStatusBar, useApp, usePendingWorksCount, useUIStore } from "@green-goods/shared";
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
import { APP_ROUTES, LEGACY_APP_ROUTES } from "@/config/pwa-routing";

export const AppBar = () => {
  const { pathname } = useLocation();
  const isGarden =
    pathname === APP_ROUTES.garden ||
    pathname.startsWith(`${APP_ROUTES.garden}/`) ||
    pathname === LEGACY_APP_ROUTES.garden ||
    pathname.startsWith(`${LEGACY_APP_ROUTES.garden}/`);
  const isWorkDetail = pathname.includes("/work/");
  const intl = useIntl();
  const { data: pendingCount = 0 } = usePendingWorksCount();
  const { isPwaPresentation } = useApp();

  // Check if any drawer is open to hide AppBar beneath them
  const isWorkDashboardOpen = useUIStore((s) => s.isWorkDashboardOpen);
  const isGardenFilterOpen = useUIStore((s) => s.isGardenFilterOpen);
  const isEndowmentDrawerOpen = useUIStore((s) => s.isEndowmentDrawerOpen);
  const isAnyDrawerOpen = isWorkDashboardOpen || isGardenFilterOpen || isEndowmentDrawerOpen;
  // Browser mode shows SiteHeader only (D6); bottom nav is PWA-only
  const shouldHideBar = !isPwaPresentation || isGarden || isWorkDetail || isAnyDrawerOpen;

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
                  <span className="absolute -top-1 -right-1.5 min-w-4 h-4 flex items-center justify-center rounded-full bg-primary text-primary-accent-foreground text-[10px] font-bold leading-none px-1">
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
