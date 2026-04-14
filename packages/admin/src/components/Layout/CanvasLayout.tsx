import {
  FabProvider,
  GardenChip,
  LeftSheet,
  MainSheet,
  NavigationBar,
  NotificationPanel,
  RightSheet,
  TopContextBar,
  useAdminStore,
  useAuth,
  useEligibleAdminGardens,
  useEffectiveToolbarPermissions,
  useFabConfigValue,
  useGardenUrlSync,
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
import { ConnectButton } from "@/components/ConnectButton";
import { AccountSheet } from "./AccountSheet";
import { CanvasGardenAccessState } from "./CanvasGardenAccessState";
import { CommandPalette } from "./CommandPalette";
import { PageTransition } from "./PageTransition";
import { SeedlingIllustration } from "./SeedlingIllustration";
import { ConnectShell, WalletRequiredConnectShell } from "./ConnectShell";
import { UserAvatar } from "./UserAvatar";
import {
  ACCOUNT_TAB_SEARCH_PARAM,
  ACCOUNT_SHEET_CONTENT_ID,
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
 * - TopContextBar renders garden context, search, settings, and avatar
 * - NavigationBar stays focused on route navigation only
 * - No sidebar, no legacy header, no layout shift
 *
 * Paradigm: Command Surface — thick material, controls visible and ready.
 */
export function CanvasLayout() {
  const intl = useIntl();
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, eoaAddress, isReady, authMode, signOut } = useAuth();
  const {
    eligibleGardens,
    canCreateGarden,
    isLoaded: eligibleGardensLoaded,
  } = useEligibleAdminGardens();

  const selectedGarden = useAdminStore((s) => s.selectedGarden);
  const setSelectedGarden = useAdminStore((s) => s.setSelectedGarden);
  const [searchOpen, setSearchOpen] = useState(false);
  const isDesktop = useMediaQuery("(min-width: 600px)");
  const permissions = useEffectiveToolbarPermissions();
  useGardenUrlSync();
  useStaleGardenGuard();

  // Sheet orchestrator — manages pane-scoped sheets + main-sheet recession
  const orchestrator = useSheetOrchestrator();
  const overlayRootRef = useRef<HTMLDivElement>(null);
  const pendingDesktopAccountTabRef = useRef<AccountSheetTab | null>(null);
  const [accountTab, setAccountTab] = useState<AccountSheetTab>("profile");

  const accountSheetOpen =
    orchestrator.activeSheet === "right" &&
    orchestrator.activeContentId === ACCOUNT_SHEET_CONTENT_ID;

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<OpenAccountSheetEventDetail>).detail;
      const nextTab = detail?.tab === "settings" ? "settings" : "profile";
      setAccountTab(nextTab);
      orchestrator.openSheet("right", ACCOUNT_SHEET_CONTENT_ID);
    };

    window.addEventListener(OPEN_ACCOUNT_SHEET_EVENT, handler as EventListener);
    return () => window.removeEventListener(OPEN_ACCOUNT_SHEET_EVENT, handler as EventListener);
  }, [orchestrator]);

  const handleOpenSearch = useCallback(() => setSearchOpen(true), []);
  const openAccountSheet = useCallback(
    (tab: AccountSheetTab) => {
      setAccountTab(tab);
      orchestrator.openSheet("right", ACCOUNT_SHEET_CONTENT_ID);
    },
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

  useEffect(() => {
    if (!isDesktop || rawWorkspaceId !== "profile") {
      return;
    }

    const requestedTab = parseAccountSheetTab(
      new URLSearchParams(location.search).get(ACCOUNT_TAB_SEARCH_PARAM)
    );

    pendingDesktopAccountTabRef.current = requestedTab;
    setAccountTab(requestedTab);
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

    setAccountTab(pendingTab);
    orchestrator.openSheet("right", ACCOUNT_SHEET_CONTENT_ID);
    pendingDesktopAccountTabRef.current = null;
  }, [isDesktop, orchestrator, rawWorkspaceId]);

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

  if (authMode === "embedded") {
    return (
      <WalletRequiredConnectShell
        action={
          <button
            type="button"
            onClick={() => signOut()}
            className="inline-flex items-center justify-center rounded-md bg-primary-base px-6 py-3 text-sm font-medium text-primary-foreground transition hover:bg-primary-darker focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-base focus-visible:ring-offset-2"
          >
            {intl.formatMessage({
              id: "app.admin.auth.signOutAndReconnect",
              defaultMessage: "Sign out & connect wallet",
            })}
          </button>
        }
      />
    );
  }

  if (!isAuthenticated || !eoaAddress) {
    return (
      <ConnectShell
        titleId="app.admin.auth.connectRequired"
        defaultTitle="Connect to continue"
        descriptionId="app.admin.auth.connectPrompt"
        defaultDescription="Connect your wallet to access this feature."
        action={<ConnectButton size="lg" />}
      />
    );
  }

  // GardenChip only needs the selector shape, not full domain objects.
  const gardenList = eligibleGardens.map((garden) => ({ id: garden.id, name: garden.name }));
  const chipGarden = selectedGarden ? { id: selectedGarden.id, name: selectedGarden.name } : null;
  const noEligibleGardens = eligibleGardens.length === 0;
  const showNoGardenAccessState = isCoreWorkspace && noEligibleGardens;

  const noGardenChipNode = (
    <span className="inline-flex max-w-[220px] items-center gap-1.5 rounded-full bg-bg-white/80 px-3 py-1.5 text-sm font-medium text-text-sub shadow-[var(--edge-rest),_var(--elevation-1)] backdrop-blur-sm supports-[backdrop-filter]:bg-bg-white/60">
      <SeedlingIllustration className="h-4 w-4" />
      <span className="truncate">
        {intl.formatMessage({
          id: "cockpit.access.noGardenChip",
          defaultMessage: "No Garden Access",
        })}
      </span>
    </span>
  );

  const gardenChipNode = showNoGardenAccessState ? (
    noGardenChipNode
  ) : (
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
      onCreateGarden={canCreateGarden ? () => navigate(adminRoutes.gardenCreate()) : undefined}
    />
  );

  const userAvatarNode = <UserAvatar onOpenProfile={() => openAccountSheet("profile")} />;
  const visibleSlotCount = slots.filter((slot) => slot.visible).length;

  return (
    <FabProvider>
      <div
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
        <div className="canvas-area-top">
          <TopContextBar
            gardenChip={gardenChipNode}
            onOpenSearch={handleOpenSearch}
            onOpenSettings={isDesktop ? () => openAccountSheet("settings") : undefined}
            onOpenNotifications={() => orchestrator.openSheet("right", "notifications")}
            userAvatar={isDesktop ? userAvatarNode : undefined}
          />
        </div>

        {/* ── Body 2: MainSheet — Content Zone (Z2) ── */}
        <MainSheet isReceded={orchestrator.isReceded} overlayRef={overlayRootRef}>
          <main
            id="main-content"
            tabIndex={-1}
            className="main-scroll-area h-full overflow-y-auto"
            style={{
              paddingBottom: isDesktop ? "6rem" : "calc(env(safe-area-inset-bottom) + 9.5rem)",
              overscrollBehaviorY: "contain",
              WebkitOverflowScrolling: "touch",
            }}
          >
            {showNoGardenAccessState ? (
              <CanvasGardenAccessState
                canCreateGarden={canCreateGarden}
                onCreateGarden={() => navigate(adminRoutes.gardenCreate())}
              />
            ) : (
              <PageTransition />
            )}
          </main>
        </MainSheet>

        {/* ── Body 3: Persistent Chrome — Navigation Bar (Z3) ── */}
        <div className="canvas-area-bottom">
          {visibleSlotCount > 0 && (
            <FabAwareNavigationBar
              slots={slots}
              activePath={activePath}
              onNavigate={(path) => navigate(path)}
            />
          )}
        </div>

        {/* Pane-scoped sheets — portal into the bounded canvas overlay root */}
        <AccountSheet
          open={accountSheetOpen}
          activeTab={accountTab}
          onClose={() => orchestrator.closeSheet()}
          onTabChange={setAccountTab}
          container={overlayRootRef.current}
        />
        <RightSheet
          open={
            orchestrator.activeSheet === "right" && orchestrator.activeContentId === "notifications"
          }
          onClose={() => orchestrator.closeSheet()}
          title={intl.formatMessage({
            id: "cockpit.notifications.title",
            defaultMessage: "Notifications",
          })}
          container={overlayRootRef.current}
        >
          <NotificationPanel />
        </RightSheet>
        <CommandPalette open={searchOpen} onOpenChange={setSearchOpen} />
      </div>
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
