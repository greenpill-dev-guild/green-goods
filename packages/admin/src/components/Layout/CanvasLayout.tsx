import {
  FabProvider,
  RefreshActionProvider,
  GardenChip,
  LeftSheetProvider,
  MainSheet,
  NavigationBar,
  AppBar,
  NotificationPanel,
  ACCOUNT_TAB_SEARCH_PARAM,
  ADMIN_WORKSPACE_VIEWS,
  NOTIFICATIONS_SHEET_CONTENT_ID,
  OPEN_ACCOUNT_SHEET_EVENT,
  parseAccountSheetTab,
  PROFILE_SHEET_CONTENT_ID,
  SETTINGS_SHEET_CONTENT_ID,
  toAccountSheetContentId,
  useAdminGardenWorkspaceSelection,
  useAdminRightSheetDescriptor,
  useAuth,
  useEligibleAdminGardens,
  useEffectiveToolbarPermissions,
  useFabConfigValue,
  useGardenDerivedState,
  useGardenDetailData,
  useGardenUrlSync,
  useLeftSheetConfigValue,
  adminRoutes,
  formatRelativeTime,
  getAdminWorkspaceForPath,
  getAdminWorkspaceRoot,
  resolveAdminWorkspaceSectionRoute,
  useMediaQuery,
  useSheetOrchestrator,
  compareAddresses,
  type AccountSheetTab,
  type AdminRightSheetContentId,
  type AdminWorkspaceSectionTab,
  type NavigationBarProps,
  type NotificationPanelItem,
  type OpenAccountSheetEventDetail,
  type ToolbarSlot,
} from "@green-goods/shared";
import { RiUserLine } from "@remixicon/react";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useIntl } from "react-intl";
import { AdminDialog } from "@/components/AdminDialog";
import { useLocation, useNavigate } from "react-router-dom";
import { AccountProfilePanel } from "./AccountProfilePanel";
import { AccountSettingsPanel } from "./AccountSettingsPanel";
import { CommandPalette } from "./CommandPalette";
import { PageTransition } from "./PageTransition";

type CanvasChromeProbeComponent = "CanvasLayout" | "FabAwareNavigationBar" | "NavigationBar";
type CanvasChromeProbePhase = "render" | "mount" | "update" | "unmount";

interface CanvasChromeProbeStats {
  renders: number;
  mounts: number;
  updates: number;
  unmounts: number;
  lastDetail?: unknown;
}

interface CanvasChromeProbeEvent {
  sequence: number;
  component: CanvasChromeProbeComponent;
  phase: CanvasChromeProbePhase;
  detail?: unknown;
}

interface CanvasChromeProbeState {
  sequence: number;
  components: Partial<Record<CanvasChromeProbeComponent, CanvasChromeProbeStats>>;
  events: CanvasChromeProbeEvent[];
}

declare global {
  interface Window {
    __GG_CANVAS_CHROME_DEBUG__?: CanvasChromeProbeState;
  }
}

const StableAppBar = memo(AppBar);
StableAppBar.displayName = "StableAppBar";

const StableNavigationBar = memo(NavigationBar);
StableNavigationBar.displayName = "StableNavigationBar";

function recordCanvasChromeProbe(
  component: CanvasChromeProbeComponent,
  phase: CanvasChromeProbePhase,
  detail?: unknown
) {
  if (typeof window === "undefined" || !isLocalCanvasChromeProbeHost(window.location.hostname)) {
    return;
  }

  const probe = (window.__GG_CANVAS_CHROME_DEBUG__ ??= {
    sequence: 0,
    components: {},
    events: [],
  });
  const stats = (probe.components[component] ??= {
    renders: 0,
    mounts: 0,
    updates: 0,
    unmounts: 0,
  });

  if (phase === "render") stats.renders += 1;
  if (phase === "mount") stats.mounts += 1;
  if (phase === "update") stats.updates += 1;
  if (phase === "unmount") stats.unmounts += 1;
  stats.lastDetail = detail;

  probe.sequence += 1;
  probe.events.push({ sequence: probe.sequence, component, phase, detail });
  if (probe.events.length > 200) {
    probe.events.splice(0, probe.events.length - 200);
  }
  reflectCanvasChromeProbeToDom(component, stats, probe.sequence);
}

function isLocalCanvasChromeProbeHost(hostname: string) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

function reflectCanvasChromeProbeToDom(
  component: CanvasChromeProbeComponent,
  stats: CanvasChromeProbeStats,
  sequence: number
) {
  const key = component.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase();
  const root = document.documentElement;

  root.setAttribute("data-gg-canvas-chrome-sequence", String(sequence));
  root.setAttribute(`data-gg-canvas-chrome-${key}-renders`, String(stats.renders));
  root.setAttribute(`data-gg-canvas-chrome-${key}-mounts`, String(stats.mounts));
  root.setAttribute(`data-gg-canvas-chrome-${key}-updates`, String(stats.updates));
  root.setAttribute(`data-gg-canvas-chrome-${key}-unmounts`, String(stats.unmounts));
}

function useCanvasChromeProbe(component: CanvasChromeProbeComponent, detail?: unknown) {
  recordCanvasChromeProbe(component, "render", detail);

  useEffect(() => {
    recordCanvasChromeProbe(component, "mount", detail);
    return () => recordCanvasChromeProbe(component, "unmount", detail);
    // Mount/unmount identity is component-scoped. Render detail is recorded above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [component]);
}

const ProfiledNavigationBar = memo(function ProfiledNavigationBar(props: NavigationBarProps) {
  const profileDetail = useMemo(
    () => ({
      activePath: props.activePath,
      slotIds: props.slots.map((slot) => slot.id),
      hasFab: Boolean(props.fab),
    }),
    [props.activePath, props.fab, props.slots]
  );
  useCanvasChromeProbe("NavigationBar", profileDetail);

  return <StableNavigationBar {...props} />;
});
ProfiledNavigationBar.displayName = "ProfiledNavigationBar";

/**
 * Canvas layout — top context bar above the main sheet and floating navigation below.
 *
 * - AppBar renders garden context, search, settings, and avatar
 * - NavigationBar stays focused on route navigation only
 * - No sidebar, no legacy header, no layout shift
 *
 * Paradigm: Command Surface — thick material, controls visible and ready.
 */
export function CanvasLayout() {
  const intl = useIntl();
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, eoaAddress, isReady, authMode } = useAuth();
  const { eligibleGardens, isLoaded: eligibleGardensLoaded } = useEligibleAdminGardens();
  const { selectedGarden } = useAdminGardenWorkspaceSelection();

  const [searchOpen, setSearchOpen] = useState(false);
  const isDesktop = useMediaQuery("(min-width: 600px)");
  const usesFloatingFabNavigation = useMediaQuery("(max-width: 1023px)");
  const permissions = useEffectiveToolbarPermissions();
  const { showWork, showGarden, showCommunity, showActions } = permissions;
  const { setGarden } = useGardenUrlSync();

  // Sheet orchestrator — manages pane-scoped sheets
  const orchestrator = useSheetOrchestrator();
  const { activeContentId, activeSheet, closeSheet, openSheet } = orchestrator;
  // State-driven sheet layer: sheets need to re-render once the canvas-level
  // portal root mounts so they stay bounded between AppBar and NavigationBar.
  const [sheetLayerRoot, setSheetLayerRoot] = useState<HTMLDivElement | null>(null);
  const sheetLayerRef = useCallback((node: HTMLDivElement | null) => {
    setSheetLayerRoot(node);
  }, []);
  const pendingDesktopAccountTabRef = useRef<AccountSheetTab | null>(null);
  const openRightSheetContent = useCallback(
    (contentId: AdminRightSheetContentId) => {
      openSheet("right", contentId);
    },
    [openSheet]
  );
  // Toggle: clicking the same trigger that opened the sheet should close it.
  // Plain open is kept above for callers (event handlers, redirect bridge) that
  // need to force-open a specific content id without toggling.
  const toggleRightSheetContent = useCallback(
    (contentId: AdminRightSheetContentId) => {
      if (activeSheet === "right" && activeContentId === contentId) {
        closeSheet();
      } else {
        openSheet("right", contentId);
      }
    },
    [activeContentId, activeSheet, closeSheet, openSheet]
  );
  const renderAccountProfile = useCallback(() => <AccountProfilePanel />, []);
  const renderAccountSettings = useCallback(() => <AccountSettingsPanel />, []);
  const renderNotifications = useCallback(
    () => <AdminNotificationPanel onCloseSheet={closeSheet} />,
    [closeSheet]
  );
  const rightSheetDescriptor = useAdminRightSheetDescriptor({
    contentId: activeContentId,
    renderAccountProfile,
    renderAccountSettings,
    renderNotifications,
  });

  useEffect(() => {
    if (activeSheet === "right" && rightSheetDescriptor === null) {
      closeSheet();
    }
  }, [activeSheet, closeSheet, rightSheetDescriptor]);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<OpenAccountSheetEventDetail>).detail;
      openRightSheetContent(toAccountSheetContentId(detail?.tab ?? "profile"));
    };

    window.addEventListener(OPEN_ACCOUNT_SHEET_EVENT, handler as EventListener);
    return () => window.removeEventListener(OPEN_ACCOUNT_SHEET_EVENT, handler as EventListener);
  }, [openRightSheetContent]);

  // Safety net for the "page frozen until refresh" lockup: Radix Dialog locks
  // `body { pointer-events: none }` while a modal is open and clears it on close,
  // but an action dialog that closes by navigating away can unmount mid-close and
  // leave the lock stuck — freezing the whole admin. After each navigation, if the
  // body is still locked AND no modal is actually open, release it. Guarded on
  // `[data-state="open"]` so it never unlocks behind a legitimately-open dialog
  // (route-opened flows keep their lock); worst case this is a no-op.
  useEffect(() => {
    if (typeof document === "undefined") return;
    const modalOpen = document.querySelector(
      '[role="dialog"][data-state="open"],[role="alertdialog"][data-state="open"]'
    );
    if (!modalOpen && document.body.style.pointerEvents === "none") {
      document.body.style.pointerEvents = "";
    }
  }, [location.pathname]);

  const handleOpenSearch = useCallback(() => setSearchOpen(true), []);
  const openProfile = useCallback(
    () => toggleRightSheetContent(PROFILE_SHEET_CONTENT_ID),
    [toggleRightSheetContent]
  );
  const openSettings = useCallback(
    () => toggleRightSheetContent(SETTINGS_SHEET_CONTENT_ID),
    [toggleRightSheetContent]
  );
  const openNotifications = useCallback(
    () => toggleRightSheetContent(NOTIFICATIONS_SHEET_CONTENT_ID),
    [toggleRightSheetContent]
  );
  const toolbarVisibility = useMemo(
    () => ({ showWork, showGarden, showCommunity, showActions }),
    [showActions, showCommunity, showGarden, showWork]
  );

  // Build toolbar slots — visibility driven by role-adaptive permissions
  const slots: ToolbarSlot[] = useMemo(
    () => [
      ...ADMIN_WORKSPACE_VIEWS.map((view) => ({
        id: view.id,
        label: view.label,
        labelId: view.labelId,
        icon: view.icon,
        path: view.rootPath,
        visible: toolbarVisibility[view.permission],
      })),
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
    [toolbarVisibility]
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

  // Left-inspector accent: the inspector content is workspace-scoped, so the
  // centered dialog keeps the active workspace tone (it portals out of
  // CanvasLayout's [data-tone] scope). Non-tone ids (e.g. "profile") fall back
  // to the neutral operator "hub" accent. Literal branches keep this a valid
  // AdminDialog tone regardless of the workspace-id type.
  const leftDialogTone: "hub" | "garden" | "community" | "actions" =
    workspaceId === "garden"
      ? "garden"
      : workspaceId === "community"
        ? "community"
        : workspaceId === "actions"
          ? "actions"
          : "hub";

  const isCoreWorkspace =
    activePath === "/hub" || activePath === "/garden" || activePath === "/community";
  const noEligibleGardens = eligibleGardens.length === 0;
  const visibleSlotCount = useMemo(() => slots.filter((slot) => slot.visible).length, [slots]);
  const handleNavigate = useCallback((path: string) => navigate(path), [navigate]);
  const gardenList = useMemo(
    () => eligibleGardens.map((garden) => ({ id: garden.id, name: garden.name })),
    [eligibleGardens]
  );
  const chipGarden = useMemo(
    () => (selectedGarden ? { id: selectedGarden.id, name: selectedGarden.name } : null),
    [selectedGarden]
  );
  const handleSelectGarden = useCallback(
    (garden: { id: string; name: string } | null) => {
      if (garden) {
        const fullGarden = eligibleGardens.find((eligibleGarden) =>
          compareAddresses(eligibleGarden.id, garden.id)
        );
        setGarden(fullGarden ?? null);
      } else {
        setGarden(null);
      }
    },
    [eligibleGardens, setGarden]
  );
  const handleCreateGarden = useCallback(() => navigate(adminRoutes.gardenCreate()), [navigate]);
  const gardenChipNode = useMemo(
    () => (
      <GardenChip
        gardens={gardenList}
        selectedGarden={chipGarden}
        onSelectGarden={handleSelectGarden}
        onCreateGarden={handleCreateGarden}
      />
    ),
    [chipGarden, gardenList, handleCreateGarden, handleSelectGarden]
  );

  useCanvasChromeProbe("CanvasLayout", {
    activePath,
    pathname: location.pathname,
    usesFloatingFabNavigation,
    visibleSlotCount,
    workspaceId,
  });

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

    openRightSheetContent(toAccountSheetContentId(pendingTab));
    pendingDesktopAccountTabRef.current = null;
  }, [isDesktop, openRightSheetContent, rawWorkspaceId]);

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

  // Shared spinner — covers every authenticated in-app route while auth and
  // eligible-garden state resolve. Toolbar permissions are fail-open while they
  // load, so they must not block the shell from painting.
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

  return (
    <FabProvider>
      <RefreshActionProvider>
        <LeftSheetProvider>
          <div
            data-component="CanvasLayout"
            data-tone={workspaceId}
            className="admin-m3 h-full min-h-0 workspace-canvas workspace-canvas-grid"
          >
            {/* Skip to content */}
            <a
              href="#main-content"
              className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-toast focus:rounded-lg focus:bg-[rgb(var(--tone-action,var(--primary-action)))] focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-[rgb(var(--tone-on-action,var(--primary-action-foreground)))]"
            >
              {intl.formatMessage({
                id: "app.admin.layout.skipToContent",
                defaultMessage: "Skip to content",
              })}
            </a>

            {/* ── Body 1: Persistent Chrome — Top Axis (Z3) ── */}
            <div data-region="canvas-area-top" className="canvas-area-top">
              <StableAppBar
                gardenChip={gardenChipNode}
                onOpenSearch={handleOpenSearch}
                onOpenSettings={isDesktop ? openSettings : undefined}
                onOpenNotifications={openNotifications}
                onOpenProfile={isDesktop ? openProfile : undefined}
              />
            </div>

            {/* ── Body 2: MainSheet — Content Zone (Z2) ── */}
            <MainSheet>
              <main
                id="main-content"
                data-region="main-scroll-area"
                tabIndex={-1}
                className="main-scroll-area mx-auto h-full w-full max-w-[1400px] overflow-y-auto px-5 pt-2 sm:pt-3"
                style={{
                  // Handoff sheet-system.css: floating NavigationBar at bottom: 20px
                  // with 56px height ⇒ ~100px clearance to keep last content row visible.
                  paddingBottom: isDesktop
                    ? "var(--admin-main-bottom-clearance-desktop, 6.25rem)"
                    : "var(--admin-main-bottom-clearance-mobile, calc(env(safe-area-inset-bottom) + 9.5rem))",
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
                <>
                  {usesFloatingFabNavigation ? (
                    <FabAwareNavigationBar
                      slots={slots}
                      activePath={activePath}
                      onNavigate={handleNavigate}
                    />
                  ) : (
                    <ProfiledNavigationBar
                      slots={slots}
                      activePath={activePath}
                      onNavigate={handleNavigate}
                    />
                  )}
                </>
              )}
            </div>

            <div
              ref={sheetLayerRef}
              className="admin-canvas-sheet-layer pointer-events-none absolute inset-0 overflow-hidden"
              // Sits at the overlay level (above --z-nav: 30) so an open sheet's
              // scrim dims the full viewport — AppBar + nav included — matching
              // AdminDialog (fixed inset-0 at --z-overlay). When no sheet is open
              // the layer is empty + pointer-events-none, so the floating nav
              // stays interactive; the scrim only captures clicks while open.
              style={{ zIndex: "var(--z-overlay, 40)" }}
              data-component="CanvasLayout"
              data-slot="sheet-layer"
              data-state={activeSheet ?? "idle"}
              data-testid="canvas-sheet-layer"
            />

            {/* Account / notification inspector — centered AdminDialog (the
                right sheet retired). The same orchestrator contentId drives
                open/close. Tone is the neutral operator "hub" accent: this is
                global account chrome, not workspace content, so it should not
                inherit the active garden's tint, and the dialog portals out of
                CanvasLayout's [data-tone] scope. */}
            <AdminDialog
              open={activeSheet === "right" && rightSheetDescriptor !== null}
              onOpenChange={(next) => {
                if (!next) closeSheet();
              }}
              title={rightSheetDescriptor?.title ?? ""}
              tone="hub"
              size="lg"
            >
              {rightSheetDescriptor?.content}
            </AdminDialog>

            {/* Persistent left/bottom sheet — content declared by views via useLeftSheetConfig */}
            <CanvasLeftSheet tone={leftDialogTone} />

            <CommandPalette open={searchOpen} onOpenChange={setSearchOpen} />
          </div>
        </LeftSheetProvider>
      </RefreshActionProvider>
    </FabProvider>
  );
}

function AdminNotificationPanel({ onCloseSheet }: { onCloseSheet: () => void }) {
  const { formatMessage } = useIntl();
  const navigate = useNavigate();
  const { selectedGarden } = useAdminGardenWorkspaceSelection();
  const selectedGardenAddress = selectedGarden?.id;
  const workspace = useGardenDetailData(selectedGarden?.id);

  const navigateFromNotification = useCallback(
    (path: string) => {
      navigate(path);
      onCloseSheet();
    },
    [navigate, onCloseSheet]
  );

  const openSection = useCallback(
    (tab: AdminWorkspaceSectionTab, section: string, itemId?: string) => {
      navigateFromNotification(
        resolveAdminWorkspaceSectionRoute({
          tab,
          section,
          itemId,
          gardenAddress: selectedGardenAddress,
        })
      );
    },
    [navigateFromNotification, selectedGardenAddress]
  );

  const derived = useGardenDerivedState({
    garden: workspace.garden ?? {
      id: selectedGarden?.id ?? "",
      domainMask: undefined,
      name: selectedGarden?.name ?? "",
      chainId: selectedGarden?.chainId ?? 0,
    },
    works: workspace.works,
    assessments: workspace.assessments,
    hypercerts: workspace.hypercerts,
    allocations: workspace.allocations,
    gardenVaults: workspace.gardenVaults,
    vaultNetDeposited: workspace.vaultNetDeposited,
    roleMembers: workspace.roleMembers,
    selectedRange: "30d",
    activityFilter: "all",
    memberSearch: "",
    section: undefined,
    formatMessage,
    openSection,
  });

  const items = useMemo<NotificationPanelItem[]>(() => {
    if (!workspace.garden) return [];

    const alertItems = derived.overviewAlerts.map((alert) => ({
      id: `alert-${alert.key}`,
      title: alert.label,
      description: selectedGarden?.name,
      tone: alert.severity,
      onSelect: alert.onAction,
    }));

    const activityItems = derived.activityEvents.slice(0, 5).map((event) => {
      const href = event.href;
      return {
        id: event.id,
        title: event.title,
        description: event.description,
        meta: formatRelativeTime(event.timestamp),
        tone: "info" as const,
        onSelect: href ? () => navigateFromNotification(href) : undefined,
      };
    });

    return [...alertItems, ...activityItems].slice(0, 8);
  }, [
    derived.activityEvents,
    derived.overviewAlerts,
    navigateFromNotification,
    selectedGarden,
    workspace.garden,
  ]);

  return (
    <NotificationPanel
      items={items}
      isLoading={
        workspace.fetching ||
        workspace.fetchingAssessments ||
        workspace.worksLoading ||
        workspace.hypercertsLoading ||
        workspace.allocationsLoading ||
        workspace.vaultsLoading
      }
    />
  );
}

/** Bridge: reads FAB config from FabContext and passes to NavigationBar */
const FabAwareNavigationBar = memo(function FabAwareNavigationBar(props: {
  slots: ToolbarSlot[];
  activePath: string;
  onNavigate: (path: string) => void;
}) {
  const fabConfig = useFabConfigValue();
  useCanvasChromeProbe("FabAwareNavigationBar", {
    activePath: props.activePath,
    hasFab: Boolean(fabConfig),
    slotIds: props.slots.map((slot) => slot.id),
  });

  return <ProfiledNavigationBar {...props} fab={fabConfig} />;
});
FabAwareNavigationBar.displayName = "FabAwareNavigationBar";

/**
 * Bridge: reads left-inspector config from LeftSheetContext and renders it as a
 * centered AdminDialog — the left/bottom canvas sheets are retired, AdminDialog
 * is the canonical admin overlay (bottom-sheet presentation on mobile is built
 * in). Persistent across route transitions — views declare content via
 * useLeftSheetConfig(). Closing runs `config.onClose`; route-backed configs
 * navigate to their `closeTo`, so deep-link + back-nav are preserved.
 */
function CanvasLeftSheet({ tone }: { tone: "hub" | "garden" | "community" | "actions" }) {
  const config = useLeftSheetConfigValue();
  const isOpen = config !== null;

  return (
    <AdminDialog
      open={isOpen}
      onOpenChange={(next) => {
        if (!next) config?.onClose?.();
      }}
      title={config?.title ?? ""}
      tone={tone}
      size={config?.width === "wide" ? "xl" : "lg"}
      preventClose={config?.preventClose}
    >
      {config?.content}
    </AdminDialog>
  );
}
