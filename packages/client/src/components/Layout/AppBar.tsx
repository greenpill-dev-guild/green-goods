import { usePendingWorksCount } from "@green-goods/shared/hooks";
import { SyncStatusBar } from "@green-goods/shared/components";
import { useUIStore } from "@green-goods/shared/stores";
import { cn } from "@green-goods/shared/utils";
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

export const AppBar = () => {
  const { pathname } = useLocation();
  const isGarden = pathname.startsWith("/garden");
  const isWorkDetail = pathname.includes("/work/");
  const intl = useIntl();
  const { data: pendingCount = 0 } = usePendingWorksCount();

  // Check if any drawer is open to hide AppBar beneath them
  const { isWorkDashboardOpen, isGardenFilterOpen } = useUIStore();
  const isAnyDrawerOpen = isWorkDashboardOpen || isGardenFilterOpen;
  const shouldHideBar = isGarden || isWorkDetail || isAnyDrawerOpen;

  const tabs: {
    path: string;
    title: string;
    ActiveIcon: RemixiconComponentType;
    InactiveIcon: RemixiconComponentType;
  }[] = [
    {
      path: "/home",
      title: intl.formatMessage({ id: "app.home" }),
      ActiveIcon: RiHomeFill,
      InactiveIcon: RiHomeLine,
    },
    {
      path: "/garden",
      title: intl.formatMessage({ id: "app.garden" }),
      ActiveIcon: RiPlantFill,
      InactiveIcon: RiPlantLine,
    },
    {
      path: "/profile",
      title: intl.formatMessage({ id: "app.profile" }),
      ActiveIcon: RiUserFill,
      InactiveIcon: RiUserLine,
    },
  ];

  return (
    <>
      <SyncStatusBar
        className={cn(
          "bottom-[calc(69px+env(safe-area-inset-bottom))] transition-transform duration-300",
          shouldHideBar ? "translate-y-full" : "translate-y-0"
        )}
      />
      <nav
        data-testid="authenticated-nav"
        className={cn(
          // Keep AppBar above page content (z-40), but below modal/drawer overlays (z-[20000]).
          // Hide AppBar when on garden submission routes, work detail pages, or when any drawer is open.
          "fixed bottom-0 bg-bg-white-0 border-t border-t-stroke-soft-200 flex flex-row justify-evenly items-center w-full py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] z-40 transition-transform duration-300",
          shouldHideBar ? "translate-y-full" : "translate-y-0"
        )}
      >
        {tabs.map(({ path, ActiveIcon, InactiveIcon, title }) => {
          const isActive = pathname.startsWith(path);
          const isHome = path === "/home";
          const showBadge = isHome && pendingCount > 0;
          return (
            <Link
              to={path}
              key={title}
              viewTransition
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
                  <span className="absolute -top-1 -right-1.5 min-w-4 h-4 flex items-center justify-center rounded-full bg-primary text-bg-white-0 text-[10px] font-bold leading-none px-1">
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
