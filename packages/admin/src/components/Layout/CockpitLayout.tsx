import {
  GardenChip,
  NavigationBar,
  useAdminStore,
  useAuth,
  useEffectiveToolbarPermissions,
  useGardenUrlSync,
  useGardens,
  useStaleGardenGuard,
  type ToolbarSlot,
} from "@green-goods/shared";
import {
  RiClipboardLine,
  RiHammerFill,
  RiSearchLine,
  RiSeedlingLine,
  RiTeamLine,
} from "@remixicon/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useIntl } from "react-intl";
import { useLocation, useNavigate } from "react-router-dom";
import { CommandPalette } from "./CommandPalette";
import { SettingsSheet } from "./SettingsSheet";
import { UserMenu } from "./UserMenu";
import { PageTransition } from "../ui/PageTransition";

/**
 * Cockpit layout — floating navigation bar at bottom, no header.
 *
 * - Desktop: Centered floating nav pill with GardenChip (leading) + UserMenu (trailing)
 * - Mobile: Full-width bottom bar; GardenChip and search float at top
 * - No sidebar, no header, no layout shift
 *
 * Paradigm: Command Surface — thick material, controls visible and ready.
 */
export function CockpitLayout() {
  const intl = useIntl();
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated } = useAuth();
  const { data: gardens = [] } = useGardens();

  const selectedGarden = useAdminStore((s) => s.selectedGarden);
  const setSelectedGarden = useAdminStore((s) => s.setSelectedGarden);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const permissions = useEffectiveToolbarPermissions();
  useGardenUrlSync();
  useStaleGardenGuard();

  // Listen for custom event from CommandPalette "open-settings" quick action
  useEffect(() => {
    const handler = () => setSettingsOpen(true);
    window.addEventListener("open-settings-sheet", handler);
    return () => window.removeEventListener("open-settings-sheet", handler);
  }, []);

  const handleOpenSearch = useCallback(() => setSearchOpen(true), []);

  // Build toolbar slots — visibility driven by role-adaptive permissions
  const slots: ToolbarSlot[] = useMemo(
    () => [
      {
        id: "work",
        label: "Work",
        labelId: "cockpit.nav.work",
        icon: RiClipboardLine,
        path: "/work",
        visible: permissions.showWork,
      },
      {
        id: "garden",
        label: "Garden",
        labelId: "cockpit.nav.garden",
        icon: RiSeedlingLine,
        path: "/garden",
        visible: permissions.showGarden,
      },
      {
        id: "community",
        label: "Community",
        labelId: "cockpit.nav.community",
        icon: RiTeamLine,
        path: "/community",
        visible: permissions.showCommunity,
      },
      {
        id: "actions",
        label: "Actions",
        labelId: "app.admin.nav.actions",
        icon: RiHammerFill,
        path: "/actions",
        visible: permissions.showActions,
      },
    ],
    [
      permissions.showActions,
      permissions.showCommunity,
      permissions.showGarden,
      permissions.showWork,
    ]
  );

  // Determine active path from current route
  const activePath = useMemo(() => {
    const path = location.pathname;
    if (path.startsWith("/work")) return "/work";
    if (path.startsWith("/garden")) return "/garden";
    if (path.startsWith("/community")) return "/community";
    if (path.startsWith("/actions")) return "/actions";
    return "/work";
  }, [location.pathname]);

  // Map gardens for GardenChip
  const gardenList = useMemo(() => gardens.map((g) => ({ id: g.id, name: g.name })), [gardens]);
  const chipGarden = selectedGarden ? { id: selectedGarden.id, name: selectedGarden.name } : null;

  const gardenChipNode = (
    <GardenChip
      gardens={gardenList}
      selectedGarden={chipGarden}
      onSelectGarden={(g) => {
        if (g) {
          const full = gardens.find((gd) => gd.id === g.id);
          setSelectedGarden(full ?? null);
        } else {
          setSelectedGarden(null);
        }
      }}
      onCreateGarden={() => navigate("/gardens/create")}
    />
  );

  return (
    <div className="flex h-full min-h-0 flex-col bg-bg-weak">
      {/* Skip to content */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-[9999] focus:rounded-lg focus:bg-primary-base focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground"
      >
        {intl.formatMessage({
          id: "app.admin.layout.skipToContent",
          defaultMessage: "Skip to content",
        })}
      </a>

      {/* Mobile floating controls — GardenChip (top-left) + Search (top-right) */}
      <div className="fixed top-3 left-3 z-30 min-[600px]:hidden">{gardenChipNode}</div>
      <button
        type="button"
        onClick={handleOpenSearch}
        aria-label={intl.formatMessage({
          id: "cockpit.topBar.openSearch",
          defaultMessage: "Search",
        })}
        className="fixed top-3 right-3 z-30 flex h-10 w-10 items-center justify-center rounded-full bg-bg-soft/95 shadow-sm backdrop-blur min-[600px]:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-base"
      >
        <RiSearchLine className="h-5 w-5 text-text-sub" />
      </button>

      <CommandPalette open={searchOpen} onOpenChange={setSearchOpen} />
      <SettingsSheet open={settingsOpen} onClose={() => setSettingsOpen(false)} />

      {/* Main content — no left padding offset, bottom padding for nav clearance */}
      <main
        id="main-content"
        tabIndex={-1}
        className="flex-1 overflow-y-auto pb-24 max-[599px]:pb-20 main-scroll-area"
        style={{
          overscrollBehaviorY: "contain",
          WebkitOverflowScrolling: "touch",
        }}
      >
        <PageTransition />
      </main>

      {/* Floating navigation bar */}
      {isAuthenticated && (
        <NavigationBar
          slots={slots}
          activePath={activePath}
          onNavigate={(path) => navigate(path)}
          leading={gardenChipNode}
          trailing={<UserMenu onOpenSettings={() => setSettingsOpen(true)} />}
        />
      )}
    </div>
  );
}
