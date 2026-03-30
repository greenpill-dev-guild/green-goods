import {
  FloatingToolbar,
  GardenChip,
  TopContextBar,
  useAdminStore,
  useAuth,
  useEffectiveToolbarPermissions,
  useGardenUrlSync,
  useGardens,
  useRole,
  useStaleGardenGuard,
  type ToolbarSlot,
} from "@green-goods/shared";
import { RiClipboardLine, RiHammerFill, RiSeedlingLine, RiTeamLine } from "@remixicon/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useIntl } from "react-intl";
import { useLocation, useNavigate } from "react-router-dom";
import { CommandPalette } from "./CommandPalette";
import { SettingsSheet } from "./SettingsSheet";
import { PageTransition } from "../ui/PageTransition";

/**
 * Cockpit layout — replaces DashboardLayout (sidebar + header) with
 * a floating toolbar + top context bar for the operator cockpit.
 *
 * - Desktop: Vertical floating toolbar on left, content scrolls independently
 * - Mobile: Bottom nav bar, top context bar stays sticky
 * - No sidebar, no header
 */
export function CockpitLayout() {
  const intl = useIntl();
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, eoaAddress } = useAuth();
  const { role } = useRole();
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
    [permissions.showActions, permissions.showCommunity, permissions.showGarden, permissions.showWork]
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

  // User avatar — role initial in circle
  const roleInitial = role === "deployer" ? "D" : role === "operator" ? "O" : "U";
  const userAvatar =
    isAuthenticated && eoaAddress ? (
      <button
        type="button"
        onClick={() => setSettingsOpen(true)}
        className="flex h-8 w-8 items-center justify-center rounded-full bg-bg-soft text-sm font-medium text-text-sub transition-colors hover:bg-bg-weak focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-base"
        aria-label={intl.formatMessage({
          id: "cockpit.topBar.userProfile",
          defaultMessage: "User profile",
        })}
      >
        {roleInitial}
      </button>
    ) : null;

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

      <TopContextBar
        gardenChip={
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
        }
        onOpenSearch={handleOpenSearch}
        onOpenSettings={() => setSettingsOpen(true)}
        userAvatar={userAvatar}
      />

      <CommandPalette open={searchOpen} onOpenChange={setSearchOpen} />
      <SettingsSheet open={settingsOpen} onClose={() => setSettingsOpen(false)} />

      <div className="flex flex-1 min-h-0">
        <FloatingToolbar
          slots={slots}
          activePath={activePath}
          onNavigate={(path) => navigate(path)}
        />

        {/* Main content — offset for desktop toolbar */}
        <main
          id="main-content"
          tabIndex={-1}
          className="flex-1 overflow-y-auto min-[600px]:pl-20 main-scroll-area"
          style={{
            overscrollBehaviorY: "contain",
            WebkitOverflowScrolling: "touch",
          }}
        >
          <PageTransition />
        </main>
      </div>
    </div>
  );
}
