import {
  GardenChip,
  NavigationBar,
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
import { UserAvatar } from "./UserAvatar";
import { PageTransition } from "../ui/PageTransition";

/**
 * Cockpit layout — top context bar above the main workspace and floating navigation below.
 *
 * - TopContextBar renders garden context, search, settings, and avatar
 * - NavigationBar stays focused on route navigation only
 * - No sidebar, no legacy header, no layout shift
 *
 * Paradigm: Command Surface — thick material, controls visible and ready.
 */
export function CockpitLayout() {
  const intl = useIntl();
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated } = useAuth();
  const { data: gardens = [] } = useGardens();
  const { role } = useRole();

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

  const userAvatarNode = <UserAvatar onOpenSettings={() => setSettingsOpen(true)} />;

  // Show empty state CTA for operators/deployers who have no gardens
  const hasNoGardens = gardens.length === 0 && !selectedGarden;
  const canCreateGarden = role === "operator" || role === "deployer";
  const showEmptyState = hasNoGardens && canCreateGarden;

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
        gardenChip={gardenChipNode}
        onOpenSearch={handleOpenSearch}
        onOpenSettings={() => setSettingsOpen(true)}
        userAvatar={userAvatarNode}
      />

      {/* Main content — no left padding offset, bottom padding for nav clearance */}
      <main
        id="main-content"
        tabIndex={-1}
        className="flex-1 overflow-y-auto pb-24 max-[599px]:pb-20 main-scroll-area workspace-canvas"
        style={{
          overscrollBehaviorY: "contain",
          WebkitOverflowScrolling: "touch",
        }}
      >
        {showEmptyState ? (
          <div className="flex flex-1 flex-col items-center justify-center px-4 py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-bg-soft text-text-soft">
              <RiSeedlingLine className="h-7 w-7" />
            </div>
            <h2 className="mt-4 text-lg font-semibold text-text-strong">
              {intl.formatMessage({
                id: "cockpit.workspace.noGardens",
                defaultMessage: "No gardens yet",
              })}
            </h2>
            <p className="mt-2 max-w-md text-sm text-text-sub">
              {intl.formatMessage({
                id: "cockpit.workspace.noGardensDescription",
                defaultMessage: "Create your first garden to start using the cockpit workspaces.",
              })}
            </p>
            <button
              type="button"
              className="mt-6 inline-flex items-center justify-center rounded-lg bg-primary-base px-4 py-2 text-sm font-medium text-static-white transition hover:bg-primary-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-base focus-visible:ring-offset-2"
              onClick={() => navigate("/gardens/create")}
            >
              {intl.formatMessage({
                id: "cockpit.workspace.createGarden",
                defaultMessage: "Create Garden",
              })}
            </button>
          </div>
        ) : (
          <PageTransition />
        )}
      </main>

      <CommandPalette open={searchOpen} onOpenChange={setSearchOpen} />
      <SettingsSheet open={settingsOpen} onClose={() => setSettingsOpen(false)} />

      {/* Floating navigation bar */}
      {isAuthenticated && (
        <NavigationBar
          slots={slots}
          activePath={activePath}
          onNavigate={(path) => navigate(path)}
        />
      )}
    </div>
  );
}
