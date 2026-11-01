import { CountBadge } from "@green-goods/shared/components/Badge/Badge";
import { useActiveGarden } from "@green-goods/shared/hooks/garden/useActiveGarden";
import { useYourWorkCount } from "@green-goods/shared/hooks/work/useYourWorkCount";
import { useApp } from "@green-goods/shared/providers/App";
import { useUIStore } from "@green-goods/shared/stores/useUIStore";
import { cn } from "@green-goods/shared/utils/styles/cn";
import { type RemixiconComponentType, RiHomeLine, RiPlantLine, RiUserLine } from "@remixicon/react";
import { useIntl } from "react-intl";
import { Link, useLocation } from "react-router-dom";
import { APP_ROUTES, isImmersiveAppRoute } from "@/config/pwaRouting";

export const AppBar = () => {
  const { pathname } = useLocation();
  const intl = useIntl();
  const { count: pendingCount } = useYourWorkCount();
  const { isPwaPresentation } = useApp();
  // The bar's tabs are about a garden, so it waits until one is entered (DL-155).
  const { gardenId } = useActiveGarden();

  // Every sheet and dialog registers itself while open, so the bar steps aside
  // for all of them without a hand-maintained list (DL-015).
  const isAnySheetOpen = useUIStore((s) => s.openSheetCount > 0);
  // Browser mode shows SiteHeader only (D6); bottom nav is PWA-only
  const shouldHideBar =
    !isPwaPresentation || isImmersiveAppRoute(pathname) || isAnySheetOpen || gardenId === null;

  const tabs: {
    path: string;
    title: string;
    Icon: RemixiconComponentType;
  }[] = [
    {
      path: APP_ROUTES.home,
      title: intl.formatMessage({ id: "app.home" }),
      Icon: RiHomeLine,
    },
    {
      path: APP_ROUTES.garden,
      title: intl.formatMessage({ id: "app.garden" }),
      Icon: RiPlantLine,
    },
    {
      path: APP_ROUTES.profile,
      title: intl.formatMessage({ id: "app.profile" }),
      Icon: RiUserLine,
    },
  ];

  return (
    <nav
      data-testid="authenticated-nav"
      className={cn(
        // Keep AppBar above page content (z-nav), but below modal/drawer overlays (z-overlay/z-modal).
        // Hide AppBar on routes that own their chrome (Submit Work, a garden's pages) or when any sheet is open.
        // vt-app-bar keeps it above the page cross-fade when switching tabs.
        // The bar is its own white surface, so the badge's ring takes white too.
        // The 32px pill row and the 20px label sit between 8px paddings, so the bar
        // stays 69px tall: the height #app-scroll and AppScreenError reserve for it.
        "vt-app-bar fixed bottom-0 bg-bg-white-0 [--gg-count-badge-ring:rgb(var(--bg-white-0))] border-t border-t-stroke-soft-200 rounded-t-[var(--radius-lg)] overflow-hidden flex flex-row justify-evenly items-center w-full py-2 pb-[calc(0.5rem+var(--safe-area-bottom))] z-nav transition-transform duration-[var(--spring-spatial-duration)] ease-[var(--spring-spatial-easing)]",
        shouldHideBar ? "translate-y-full" : "translate-y-0"
      )}
      // Off screen is out of reach too: no tab stops or screen-reader links.
      inert={shouldHideBar}
    >
      {tabs.map(({ path, Icon, title }) => {
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
              // Keyboard focus rings every tab, active or not, in the app's focus role
              // (DL-098): one solid 2px ring with a 2px offset, around the pill and label.
              "flex flex-col items-center rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgb(var(--focus-ring))]",
              isActive && "text-text-strong-950",
              !isActive && "text-text-soft-400"
            )}
          >
            {/* The cockpit's active recipe in the app's green (F6): a pill behind the
                active icon. Every tab holds the pill's 56px, so no tab moves when the
                active one changes. Forced colors drop the fill, so there the pill
                draws its outline. */}
            <div
              data-slot="icon"
              className={cn(
                "flex h-8 w-14 items-center justify-center rounded-full",
                isActive &&
                  "bg-[rgb(var(--primary-container))] text-[rgb(var(--primary-container-foreground))] forced-colors:outline"
              )}
            >
              <div className="relative">
                <Icon className="w-6 h-6" />
                {showBadge && (
                  <CountBadge
                    count={pendingCount}
                    max={9}
                    ring
                    className="absolute -top-1 -right-1.5"
                  />
                )}
              </div>
            </div>
            <p data-slot="label" className={cn("text-sm", isActive && "font-semibold")}>
              {title}
            </p>
          </Link>
        );
      })}
    </nav>
  );
};
