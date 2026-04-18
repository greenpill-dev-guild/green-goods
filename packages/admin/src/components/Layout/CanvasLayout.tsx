import {
  BottomSheet,
  FabProvider,
  GardenChip,
  LeftSheet,
  LeftSheetProvider,
  MainSheet,
  NavigationBar,
  NotificationPanel,
  RightSheet,
  AppBar,
  useAdminStore,
  useAuth,
  useEligibleAdminGardens,
  useEffectiveToolbarPermissions,
  useFabConfigValue,
  useGardenUrlSync,
  useLeftSheetConfigValue,
  adminRoutes,
  getAdminWorkspaceForPath,
  getAdminWorkspaceRoot,
  useSheetOrchestrator,
  useStaleGardenGuard,
  type ToolbarSlot,
} from "@green-goods/shared";
import { RiAppsLine, RiHammerFill, RiSeedlingLine, RiTeamLine, RiUserLine } from "@remixicon/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useIntl } from "react-intl";
import { useLocation, useNavigate } from "react-router-dom";
import { CommandPalette } from "./CommandPalette";
import { PageTransition } from "./PageTransition";
import { AccountProfilePanel } from "./AccountProfilePanel";
import { AccountSettingsPanel } from "./AccountSettingsPanel";
import {
  ACCOUNT_TAB_SEARCH_PARAM,
  PROFILE_SHEET_CONTENT_ID,
  SETTINGS_SHEET_CONTENT_ID,
  OPEN_ACCOUNT_SHEET_EVENT,
  parseAccountSheetTab,
  type AccountSheetTab,
  type OpenAccountSheetEventDetail,
} from "./accountSheet.events";

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(
    () => typeof window !== "undefined" && window.matchMedia(query).matches
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia(query);
    const handleChange = (event: MediaQueryListEvent) => setMatches(event.matches);
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [query]);

  return matches;
}

/**
 * Canvas layout — top context bar above the main sheet and floating navigation below.
 *
 * - AppBar renders garden context, search, settings, and avatar
 * - NavigationBar stays focused on route navigation only
 * - No sidebar, no legacy header, no layout shift
 *
 * Paradigm: Command Surface — thick material, controls visible and ready.
 */
const RIGHT_SHEET_TITLES: Record<string, { id: string; defaultMessage: string }> = {
  profile: { id: "cockpit.profile.title", defaultMessage: "Profile" },
  settings: { id: "cockpit.settings.title", defaultMessage: "Settings" },
  notifications: { id: "cockpit.notifications.title", defaultMessage: "Notifications" },
};

export function CanvasLayout() {
  const intl = useIntl();
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, eoaAddress, isReady, authMode } = useAuth();
  const { eligibleGardens, isLoaded: eligibleGardensLoaded } = useEligibleAdminGardens();

  const selectedGarden = useAdminStore((s) => s.selectedGarden);
  const setSelectedGarden = useAdminStore((s) => s.setSelectedGarden);
  const [searchOpen, setSearchOpen] = useState(false);
  const isDesktop = useMediaQuery("(min-width: 600px)");
  const permissions = useEffectiveToolbarPermissions();
  useGardenUrlSync();
  useStaleGardenGuard();

  // Sheet orchestrator — manages pane-scoped sheets + main-sheet recession
  const orchestrator = useSheetOrchestrator();
  // State-driven overlay root: sheets need to re-render once MainSheet mounts
  // its overlay container so `container` flips from null to the bounded div.
  // A plain ref wouldn't trigger re-renders, leaving sheets in unbounded mode
  // on first open (covering AppBar + NavigationBar).
  const [overlayRoot, setOverlayRoot] = useState<HTMLDivElement | null>(null);
  const overlayRootRef = useCallback((node: HTMLDivElement | null) => {
    setOverlayRoot(node);
  }, []);
  const pendingDesktopAccountTabRef = useRef<AccountSheetTab | null>(null);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<OpenAccountSheetEventDetail>).detail;
      const contentId =
        detail?.tab === "settings" ? SETTINGS_SHEET_CONTENT_ID : PROFILE_SHEET_CONTENT_ID;
      orchestrator.openSheet("right", contentId);
    };

    window.addEventListener(OPEN_ACCOUNT_SHEET_EVENT, handler as EventListener);
    return () => window.removeEventListener(OPEN_ACCOUNT_SHEET_EVENT, handler as EventListener);
  }, [orchestrator]);

  const handleOpenSearch = useCallback(() => setSearchOpen(true), []);
  const openProfile = useCallback(
    () => orchestrator.openSheet("right", PROFILE_SHEET_CONTENT_ID),
    [orchestrator]
  );
  const openSettings = useCallback(
    () => orchestrator.openSheet("right", SETTINGS_SHEET_CONTENT_ID),
    [orchestrator]
  );

  // Build toolbar slots — visibility driven by role-adaptive permissions
  const slots: ToolbarSlot[] = useMemo(
    () => [
      {
        id: "hub",
        label: "Hub",
        labelId: "cockpit.nav.hub",
        icon: RiAppsLine,
        path: "/hub",
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
      {
        id: "profile",
        label: "Profile",
        labelId: "cockpit.nav.profile",
        icon: RiUserLine,
        path: adminRoutes.profile(),
        visible: true,
        mobileOnly: true,
      },
    ],
    [
      permissions.showActions,
      permissions.showCommunity,
      permissions.showGarden,
      permissions.showWork,
    ]
  );

  // Determine active path and workspace identity from current route
  const { activePath, workspaceId, rawWorkspaceId } = useMemo(() => {
    const rawActivePath = getAdminWorkspaceRoot(location.pathname);
    const nextWorkspaceId = getAdminWorkspaceForPath(location.pathname);
    const shouldNormalizeDesktopProfile = isDesktop && nextWorkspaceId === "profile";

    return {
      activePath: shouldNormalizeDesktopProfile ? adminRoutes.hub() : rawActivePath,
      workspaceId: shouldNormalizeDesktopProfile ? "hub" : nextWorkspaceId,
      rawWorkspaceId: nextWorkspaceId,
    } as const;
  }, [isDesktop, location.pathname]);

  const isCoreWorkspace =
    activePath === "/hub" || activePath === "/garden" || activePath === "/community";
  const noEligibleGardens = eligibleGardens.length === 0;

  useEffect(() => {
    if (!isDesktop || rawWorkspaceId !== "profile") {
      return;
    }

    const requestedTab = parseAccountSheetTab(
      new URLSearchParams(location.search).get(ACCOUNT_TAB_SEARCH_PARAM)
    );

    pendingDesktopAccountTabRef.current = requestedTab;
    navigate(adminRoutes.hub(), { replace: true });
  }, [isDesktop, location.search, navigate, rawWorkspaceId]);

  useEffect(() => {
    if (!isDesktop || rawWorkspaceId === "profile") {
      return;
    }

    const pendingTab = pendingDesktopAccountTabRef.current;
    if (!pendingTab) {
      return;
    }

    const contentId =
      pendingTab === "settings" ? SETTINGS_SHEET_CONTENT_ID : PROFILE_SHEET_CONTENT_ID;
    orchestrator.openSheet("right", contentId);
    pendingDesktopAccountTabRef.current = null;
  }, [isDesktop, orchestrator, rawWorkspaceId]);

  // Redirect users with no gardens to home — they see the garden creation CTA there.
  // Hoisted above the early-return ladder below so hook count stays stable across renders.
  useEffect(() => {
    if (!isReady) return;
    if (authMode === "embedded") return;
    if (!isAuthenticated || !eoaAddress) return;
    if (!eligibleGardensLoaded) return;
    if (noEligibleGardens && isCoreWorkspace) {
      navigate("/", { replace: true });
    }
  }, [
    isReady,
    authMode,
    isAuthenticated,
    eoaAddress,
    eligibleGardensLoaded,
    noEligibleGardens,
    isCoreWorkspace,
    navigate,
  ]);

  // Shared spinner — covers every authenticated in-app route while auth state
  // resolves. Unauthenticated "/" is handled by IndexRoute; the in-app routes
  // all live under CanvasShell which mounts this layout.
  if (!isReady || (isAuthenticated && !eligibleGardensLoaded)) {
    return (
      <div
        className="flex min-h-screen items-center justify-center bg-bg-weak px-6"
        role="status"
        aria-label={intl.formatMessage({
          id: "app.admin.auth.checking",
          defaultMessage: "Checking authentication...",
        })}
      >
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-stroke-sub border-t-primary-base" />
      </div>
    );
  }

  // GardenChip only needs the selector shape, not full domain objects.
  const gardenList = eligibleGardens.map((garden) => ({ id: garden.id, name: garden.name }));
  const chipGarden = selectedGarden ? { id: selectedGarden.id, name: selectedGarden.name } : null;

  const gardenChipNode = (
    <GardenChip
      gardens={gardenList}
      selectedGarden={chipGarden}
      onSelectGarden={(g) => {
        if (g) {
          const fullGarden = eligibleGardens.find((garden) => garden.id === g.id);
          setSelectedGarden(fullGarden ?? null);
        } else {
          setSelectedGarden(null);
        }
      }}
      onCreateGarden={() => navigate(adminRoutes.gardenCreate())}
    />
  );

  const visibleSlotCount = slots.filter((slot) => slot.visible).length;

  return (
    <FabProvider>
      <LeftSheetProvider>
        <div
          data-component="CanvasLayout"
          data-workspace={workspaceId}
          className="admin-m3 h-full min-h-0 workspace-canvas workspace-canvas-grid"
        >
          {/* Skip to content */}
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-toast focus:rounded-lg focus:bg-primary-base focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground"
          >
            {intl.formatMessage({
              id: "app.admin.layout.skipToContent",
              defaultMessage: "Skip to content",
            })}
          </a>

          {/* ── Body 1: Persistent Chrome — Top Axis (Z3) ── */}
          <div data-region="canvas-area-top" className="canvas-area-top">
            <AppBar
              gardenChip={gardenChipNode}
              onOpenSearch={handleOpenSearch}
              onOpenSettings={isDesktop ? openSettings : undefined}
              onOpenNotifications={() => orchestrator.openSheet("right", "notifications")}
              onOpenProfile={isDesktop ? openProfile : undefined}
            />
          </div>

          {/* ── Body 2: MainSheet — Content Zone (Z2) ── */}
          <MainSheet isReceded={orchestrator.isReceded} overlayRef={overlayRootRef}>
            <main
              id="main-content"
              data-region="main-scroll-area"
              tabIndex={-1}
              className="main-scroll-area h-full overflow-y-auto"
              style={{
                paddingBottom: isDesktop ? "6rem" : "calc(env(safe-area-inset-bottom) + 9.5rem)",
                overscrollBehaviorY: "contain",
                WebkitOverflowScrolling: "touch",
              }}
            >
              <PageTransition />
            </main>
          </MainSheet>

          {/* ── Body 3: Persistent Chrome — Navigation Bar (Z3) ── */}
          {/* Nav slots are role-based, not garden-based. Render as soon as auth is
             resolved; slots fade in/out as role permissions resolve via FAIL_OPEN
             defaults in useEffectiveToolbarPermissions. */}
          <div data-region="canvas-area-bottom" className="canvas-area-bottom">
            {visibleSlotCount > 0 && (
              <FabAwareNavigationBar
                slots={slots}
                activePath={activePath}
                onNavigate={(path) => navigate(path)}
              />
            )}
          </div>

          {/* Pane-scoped right sheet — content driven by orchestrator contentId */}
          {/* Pane-scoped right sheet — content driven by orchestrator contentId */}
          <RightSheet
            open={orchestrator.activeSheet === "right"}
            onClose={() => orchestrator.closeSheet()}
            title={
              orchestrator.activeContentId && RIGHT_SHEET_TITLES[orchestrator.activeContentId]
                ? intl.formatMessage(RIGHT_SHEET_TITLES[orchestrator.activeContentId])
                : undefined
            }
            container={overlayRoot}
          >
            {orchestrator.activeContentId === PROFILE_SHEET_CONTENT_ID && (
              <div className="p-5">
                <AccountProfilePanel />
              </div>
            )}
            {orchestrator.activeContentId === SETTINGS_SHEET_CONTENT_ID && (
              <div className="p-5">
                <AccountSettingsPanel />
              </div>
            )}
            {orchestrator.activeContentId === "notifications" && <NotificationPanel />}
          </RightSheet>

          {/* Persistent left/bottom sheet — content declared by views via useLeftSheetConfig */}
          <CanvasLeftSheet isDesktop={isDesktop} overlayRoot={overlayRoot} />

          <CommandPalette open={searchOpen} onOpenChange={setSearchOpen} />
        </div>
      </LeftSheetProvider>
    </FabProvider>
  );
}

/** Bridge: reads FAB config from FabContext and passes to NavigationBar */
function FabAwareNavigationBar(props: {
  slots: ToolbarSlot[];
  activePath: string;
  onNavigate: (path: string) => void;
}) {
  const fabConfig = useFabConfigValue();
  return <NavigationBar {...props} fab={fabConfig} />;
}

/**
 * Bridge: reads left sheet config from LeftSheetContext and renders
 * LeftSheet (desktop) or BottomSheet (mobile). Persistent across route
 * transitions — views declare content via useLeftSheetConfig().
 */
function CanvasLeftSheet({
  isDesktop,
  overlayRoot,
}: {
  isDesktop: boolean;
  overlayRoot: HTMLElement | null;
}) {
  const config = useLeftSheetConfigValue();
  const isOpen = config !== null;

  if (isDesktop) {
    return (
      <LeftSheet
        open={isOpen}
        onClose={config?.onClose ?? (() => {})}
        title={config?.title}
        container={overlayRoot}
      >
        {config?.content}
      </LeftSheet>
    );
  }

  return (
    <BottomSheet
      open={isOpen}
      onClose={config?.onClose ?? (() => {})}
      title={config?.title}
      maxHeight={92}
    >
      {config?.content}
    </BottomSheet>
  );
}
