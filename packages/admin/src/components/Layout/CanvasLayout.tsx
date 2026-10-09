import { FabProvider } from "@green-goods/shared/components/Canvas/FabContext";
import { GardenChip } from "@green-goods/shared/components/Canvas/GardenChip";
import { RefreshActionProvider } from "@green-goods/shared/components/Canvas/RefreshActionContext";
import { useCanvasShellController } from "@green-goods/shared/hooks/admin-ui/layout/useCanvasShellController";
import { useWalletNetworkAlignment } from "@green-goods/shared/hooks/blockchain/useWalletNetworkAlignment";
import { memo, type ReactNode, useCallback, useMemo, useState } from "react";
import { useIntl } from "react-intl";
import { AdminSideSheet } from "@/components/AdminSideSheet";
import { AdminLoadingScreen } from "@/components/AdminLoadingScreen";
import { AppBar, MainSheet } from "@/components/Shell";
import { releaseStuckDialogArtifacts } from "./dialogCloseSafetyNet";
import { LeftSheetProvider } from "./leftSheetChannel";
import { AccountProfilePanelContainer } from "./AccountProfilePanel";
import { AccountSettingsPanel } from "./AccountSettingsPanel";
import { AdminNotificationPanel } from "./AdminNotificationPanel";
import { FabAwareNavigationBar, ProfiledNavigationBar } from "./canvasChromeProbe";
import { CommandPalette } from "./CommandPalette";
import { LeftInspectorDialog } from "./LeftInspectorDialog";
import { PageTransition } from "./PageTransition";
import { SeedlingIllustration } from "./SeedlingIllustration";

const StableAppBar = memo(AppBar);
StableAppBar.displayName = "StableAppBar";

/** Access-state chrome keeps identity actions independent of garden permissions. */
export function AdminAccessHomeShell({
  children,
  showProfile = false,
}: {
  children: ReactNode;
  showProfile?: boolean;
}) {
  const intl = useIntl();
  const [profileOpen, setProfileOpen] = useState(false);

  return (
    <div
      data-tone="home"
      className="admin-m3 h-full min-h-0 workspace-canvas workspace-canvas-grid"
    >
      <div className="canvas-area-top">
        <AppBar
          gardenChip={
            <span className="inline-flex items-center gap-1.5 body-sm font-semibold text-text-strong">
              <SeedlingIllustration className="h-5 w-5" />
              {intl.formatMessage({ id: "app.admin.brand", defaultMessage: "Green Goods" })}
            </span>
          }
          onOpenProfile={showProfile ? () => setProfileOpen(true) : undefined}
        />
      </div>
      <MainSheet>{children}</MainSheet>
      <div className="canvas-area-bottom" />
      {showProfile && (
        <AdminSideSheet
          open={profileOpen}
          onOpenChange={setProfileOpen}
          title={intl.formatMessage({ id: "cockpit.profile.title", defaultMessage: "Profile" })}
          tone="hub"
        >
          <AccountProfilePanelContainer />
        </AdminSideSheet>
      )}
    </div>
  );
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
export function CanvasLayout() {
  const intl = useIntl();
  const renderAccountProfile = useCallback(() => <AccountProfilePanelContainer />, []);
  const renderAccountSettings = useCallback(() => <AccountSettingsPanel />, []);
  const renderNotifications = useCallback(
    (closeSheet: () => void) => <AdminNotificationPanel onCloseSheet={closeSheet} />,
    []
  );
  const controller = useCanvasShellController({
    releaseDialogArtifacts: releaseStuckDialogArtifacts,
    renderAccountProfile,
    renderAccountSettings,
    renderNotifications,
  });
  useWalletNetworkAlignment();
  const {
    activePath,
    activeSheet,
    closeSheet,
    isDesktop,
    leftDialogTone,
    navigate: handleNavigate,
    openNotifications,
    openProfile,
    openSearch: handleOpenSearch,
    openSettings,
    profileImageSrc,
    rightSheetDescriptor,
    searchOpen,
    setSearchOpen,
    slots,
    usesFloatingFabNavigation,
    visibleSlotCount,
    workspaceId,
  } = controller;

  const gardenChipNode = useMemo(
    () => (
      <GardenChip
        gardens={controller.gardens}
        selectedGarden={controller.selectedGarden}
        onSelectGarden={controller.selectGarden}
        onCreateGarden={controller.createGarden}
        showCreateGardenAction={false}
      />
    ),
    [
      controller.createGarden,
      controller.gardens,
      controller.selectGarden,
      controller.selectedGarden,
    ]
  );

  // Shared spinner — covers every authenticated in-app route while auth and
  // eligible-garden state resolve. Toolbar permissions are fail-open while they
  // load, so they must not block the shell from painting.
  if (controller.isLoading) {
    return (
      <AdminLoadingScreen
        label={intl.formatMessage({
          id: "app.admin.loading.opening",
          defaultMessage: "Opening your workspace…",
        })}
        locale={intl.locale}
      />
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
              className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-toast focus:rounded-lg focus:bg-[rgb(var(--tone-action,var(--primary-action)))] focus:px-4 focus:py-2 focus:body-sm focus:font-medium focus:text-[rgb(var(--tone-on-action,var(--primary-action-foreground)))]"
            >
              {intl.formatMessage({
                id: "app.admin.layout.skipToContent",
                defaultMessage: "Skip to Content",
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
                desktop, full-width bottom sheet on mobile (where only the
                notification bell can open it — Profile/Settings live in the
                Profile tab there). The same orchestrator contentId drives
                open/close. Tone is the neutral steward "hub" accent: this is
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
