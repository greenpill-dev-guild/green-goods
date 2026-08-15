import {
  FabProvider,
  RefreshActionProvider,
  GardenChip,
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
  useGardenUrlSync,
  adminRoutes,
  getAdminWorkspaceForPath,
  getAdminWorkspaceRoot,
  useDocumentEvent,
  useMediaQuery,
  useSheetOrchestrator,
  compareAddresses,
  type AccountSheetTab,
  type AdminRightSheetContentId,
  type OpenAccountSheetEventDetail,
  type ToolbarSlot,
} from "@green-goods/shared";
import { useCanvasChromeProbe } from "@green-goods/shared/hooks/admin-ui/useCanvasChromeProbe";
import { useResolvedProfileAvatar } from "@green-goods/shared/profile-avatar";
import { RiUserLine } from "@remixicon/react";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useIntl } from "react-intl";
import { AdminSideSheet } from "@/components/AdminSideSheet";
import { AppBar, MainSheet } from "@/components/Shell";
import { useLocation, useNavigate } from "react-router-dom";
import { releaseStuckDialogArtifacts } from "./dialogCloseSafetyNet";
import { LeftSheetProvider } from "./leftSheetChannel";
import { AccountProfilePanel } from "./AccountProfilePanel";
import { AccountSettingsPanel } from "./AccountSettingsPanel";
import { AdminNotificationPanel } from "./AdminNotificationPanel";
import { FabAwareNavigationBar, ProfiledNavigationBar } from "./canvasChromeProbe";
import { CommandPalette } from "./CommandPalette";
import { LeftInspectorDialog } from "./LeftInspectorDialog";
import { PageTransition } from "./PageTransition";

const StableAppBar = memo(AppBar);
StableAppBar.displayName = "StableAppBar";

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
  const { avatarUri: profileImageSrc } = useResolvedProfileAvatar();

  const [searchOpen, setSearchOpen] = useState(false);
  const isDesktop = useMediaQuery("(min-width: 600px)");
  const usesFloatingFabNavigation = useMediaQuery("(max-width: 1023px)");
  const permissions = useEffectiveToolbarPermissions();
  const { showWork, showGarden, showCommunity, showActions } = permissions;
  const { setGarden } = useGardenUrlSync();

  // Sheet orchestrator — manages pane-scoped sheets
  const orchestrator = useSheetOrchestrator();
  const { activeContentId, activeSheet, closeSheet, openSheet } = orchestrator;
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

  // Safety net for the "page frozen until refresh" lockup (see
  // dialogCloseSafetyNet.ts): runs after each navigation — an action dialog
  // that closes by navigating away can unmount mid-close and leave Radix's
  // body pointer-events lock stuck. No-op while any dialog is open.
  useEffect(() => {
    if (typeof document === "undefined") return;
    releaseStuckDialogArtifacts(document);
  }, [location.pathname]);

  // …and when the tab becomes visible again: hidden tabs freeze CSS
  // animations, so a close that happened in the background never fired
  // animationend — its exit node and the body lock are still here.
  useDocumentEvent("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      releaseStuckDialogArtifacts(document);
    }
  });

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
        showCreateGardenAction={false}
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
                profileImageSrc={profileImageSrc ?? undefined}
              />
            </div>

            {/* ── Body 2: MainSheet — Content Zone (Z2) ── */}
            <MainSheet>
              <main
                id="main-content"
                data-region="main-scroll-area"
                tabIndex={-1}
                className="main-scroll-area mx-auto h-full w-full overflow-y-auto pt-2 sm:pt-3"
                style={{
                  // Handoff sheet-system.css: floating NavigationBar at bottom: 20px
                  // with 56px height ⇒ ~100px clearance to keep last content row visible.
                  maxWidth: "var(--admin-main-max-width, 1400px)",
                  paddingInline: "var(--admin-main-inline-gutter, 1.25rem)",
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

            {/* Account / notification inspector — the three global AppBar
                surfaces (Profile, Settings, Notifications) render as an
                AdminSideSheet: right-docked within the canvas chrome bounds on
                desktop, compact inset bottom sheet on mobile (where only the
                notification bell can open it — Profile/Settings live in the
                Profile tab there). The same orchestrator contentId drives
                open/close. Tone is the neutral operator "hub" accent: this is
                global account chrome, not workspace content, so it should not
                inherit the active garden's tint, and the sheet portals out of
                CanvasLayout's [data-tone] scope. */}
            <AdminSideSheet
              open={activeSheet === "right" && rightSheetDescriptor !== null}
              onOpenChange={(next) => {
                if (!next) closeSheet();
              }}
              title={rightSheetDescriptor?.title ?? ""}
              tone="hub"
            >
              {rightSheetDescriptor?.content}
            </AdminSideSheet>

            {/* Persistent left-inspector dialog — content declared by views via
                useLeftSheetConfig. Renders directly as an AdminDialog (the
                left/bottom canvas sheets are retired), reading the descriptor's
                own size + workspace tone. */}
            <LeftInspectorDialog fallbackTone={leftDialogTone} />

            <CommandPalette open={searchOpen} onOpenChange={setSearchOpen} />
          </div>
        </LeftSheetProvider>
      </RefreshActionProvider>
    </FabProvider>
  );
}
