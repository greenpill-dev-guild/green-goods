import { useRefreshActionValue } from "@green-goods/shared/components/Canvas/RefreshActionContext";
import type { WalletNetworkNoticeState } from "@green-goods/shared/hooks/blockchain/useWalletNetworkNotice";
import { useMediaQuery } from "@green-goods/shared/hooks/ui/useMediaQuery";
import { cn } from "@green-goods/shared/utils/styles/cn";
import {
  RiArrowLeftLine,
  RiLoader4Line,
  RiNotification3Line,
  RiRefreshLine,
  RiSearchLine,
  RiSettings3Line,
  RiUserLine,
  RiWallet3Line,
} from "@remixicon/react";
import type React from "react";
import { useIntl } from "react-intl";

// ----------------------------------------------------------------------------
// Admin fork of the shared Canvas AppBar (Cockpit M3, finished — 1a).
//
// Forked so the bar's styling lives in admin's own JSX, ending the remote
// overrides in admin-m3-overrides.css. Behavior (slots, refresh registration,
// sheet context) is unchanged; the props stay shared-typed via the GardenChip
// node the layout passes in.
//
// Anatomy (1a Hub mockup): 56px bar, transparent over the canvas wash.
// Right side is a row of 40px round icon buttons — hover is the neutral
// rgba-ink state layer (rgb(var(--m3-on-surface)) at 8%), never a hue shift —
// followed by the 28px profile avatar circle on surface-container-highest.
// ----------------------------------------------------------------------------

const ICON_BTN = cn(
  // 40px circle with the 44px finger box (DL-030).
  "group/icon relative flex h-10 w-10 items-center justify-center rounded-full admin-hit-target-lg",
  "text-[rgb(var(--m3-on-surface-variant))]",
  "hover:bg-[rgb(var(--m3-on-surface)/0.08)]",
  "active:bg-[rgb(var(--m3-on-surface)/0.12)]",
  "transition-colors duration-[var(--spring-effects-fast-duration)] ease-[var(--spring-effects-fast-easing)]",
  "motion-reduce:transition-none",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--tone-focus-ring,var(--tone-primary,var(--primary-base))))]"
);

// ----------------------------------------------------------------------------
// TopBarIconButton — internal icon button with CSS tooltip
// ----------------------------------------------------------------------------

function TopBarIconButton({
  slot,
  tooltip,
  onClick,
  children,
  className,
}: {
  slot: string;
  tooltip: string;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={tooltip}
      className={cn(ICON_BTN, className)}
      data-component="AppBar"
      data-slot={slot}
    >
      {children}
      <span
        className={cn(
          "pointer-events-none absolute -bottom-9 left-1/2 -translate-x-1/2 whitespace-nowrap",
          "rounded-[var(--m3-shape-xs)] bg-[rgb(var(--m3-inverse-surface)/0.9)] px-2.5 py-1 text-label-md font-medium text-[rgb(var(--m3-inverse-on-surface))]",
          "opacity-0 transition-opacity group-hover/icon:opacity-100",
          "motion-reduce:transition-none"
        )}
        role="tooltip"
        data-slot="tooltip"
      >
        {tooltip}
      </span>
    </button>
  );
}

// ----------------------------------------------------------------------------
// WalletNetworkButton — the wallet's network, when it is not the app's
// ----------------------------------------------------------------------------

const NETWORK_BTN = cn(
  // The icon buttons' 40px circle on a phone. From 600px it is a 36px pill on
  // the garden chip's metric, with the label showing.
  "group/icon relative flex h-10 w-10 shrink-0 items-center justify-center gap-2 rounded-full",
  "min-[600px]:h-9 min-[600px]:w-auto min-[600px]:px-3.5",
  "border border-warning-light bg-warning-lighter text-label-lg font-medium text-warning-dark",
  // Hover and press are the neutral ink state layer over the warning fill,
  // never a hue shift. The hit-target class releases the layer's clip, which
  // the tooltip below the button needs.
  "m3-state-layer admin-hit-target-lg",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--tone-focus-ring,var(--tone-primary,var(--primary-base))))]",
  "aria-busy:cursor-progress"
);

/**
 * Shown only while the steward's wallet is on another network. It names the
 * switch and asks the wallet for it. Wallet acts switch the network themselves;
 * this exists so a browser wallet's prompt never arrives unannounced
 * (PRD-1067). It lives in the bar, where it is always in view and where coming
 * and going moves nothing on the page.
 */
function WalletNetworkButton({ notice }: { notice: WalletNetworkNoticeState }) {
  const Icon = notice.isSwitching ? RiLoader4Line : RiWallet3Line;
  return (
    <button
      type="button"
      onClick={() => {
        if (!notice.isSwitching) void notice.switchNetwork();
      }}
      aria-label={`${notice.message}. ${notice.switchLabel}`}
      aria-busy={notice.isSwitching || undefined}
      className={NETWORK_BTN}
      data-component="AppBar"
      data-slot="wallet-network-button"
    >
      <Icon
        className={cn(
          "h-5 w-5 shrink-0 min-[600px]:h-4 min-[600px]:w-4",
          notice.isSwitching && "animate-spin motion-reduce:animate-none"
        )}
        aria-hidden="true"
      />
      <span className="hidden whitespace-nowrap min-[600px]:inline">{notice.switchLabel}</span>
      <span
        className={cn(
          "pointer-events-none absolute -bottom-9 left-1/2 -translate-x-1/2 whitespace-nowrap",
          "rounded-[var(--m3-shape-xs)] bg-[rgb(var(--m3-inverse-surface)/0.9)] px-2.5 py-1 text-label-md font-medium text-[rgb(var(--m3-inverse-on-surface))]",
          "opacity-0 transition-opacity group-hover/icon:opacity-100",
          "motion-reduce:transition-none"
        )}
        role="tooltip"
        data-slot="tooltip"
      >
        {notice.message}
      </span>
    </button>
  );
}

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

export interface AppBarProps {
  gardenChip: React.ReactNode;
  /** When a side sheet is open, show item name with back arrow */
  sheetContext?: { label: string; onBack: () => void };
  onOpenSearch?: () => void;
  onOpenSettings?: () => void;
  /** Opens the notifications side sheet (bottom-sheet presentation on mobile). */
  onOpenNotifications?: () => void;
  onOpenProfile?: () => void;
  /** Optional resolved profile image for the existing profile control. */
  profileImageSrc?: string;
  /** The wallet's other network and its switch, while there is one to show. */
  walletNetwork?: WalletNetworkNoticeState | null;
}

// ----------------------------------------------------------------------------
// AppBar
// ----------------------------------------------------------------------------

/**
 * Sticky top bar for the admin canvas layout (M3 AppBar, admin fork).
 *
 * - Left side: GardenChip (or sheetContext back-arrow + label when a sheet is open)
 * - Right side: Search, Notifications, Settings, Profile — all with identical styling,
 *   led by the wallet network button while the wallet is on another network
 * - Transparent root so the canvas wash reads continuously behind it
 * - h-14 (56px)
 *
 * On mobile the search icon is hidden and CanvasLayout omits the settings and
 * profile callbacks (those surfaces live in the Profile tab); refresh + the
 * notification bell remain, and the bell opens the sheet's bottom-sheet
 * presentation.
 */
export function AppBar({
  gardenChip,
  sheetContext,
  onOpenSearch,
  onOpenSettings,
  onOpenNotifications,
  onOpenProfile,
  profileImageSrc,
  walletNetwork,
}: AppBarProps) {
  const { formatMessage } = useIntl();
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const refreshAction = useRefreshActionValue();
  const showRefresh = !isDesktop && Boolean(refreshAction?.onRefresh);

  return (
    <header
      className="sticky top-0 z-sticky w-full bg-transparent"
      data-component="AppBar"
      data-slot="root"
      data-state={sheetContext ? "sheet-context" : "default"}
    >
      <div
        className="mx-auto flex h-14 w-full items-center justify-between gap-2"
        style={{
          maxWidth: "var(--admin-main-max-width, 1400px)",
          paddingInline: "var(--admin-main-inline-gutter, 20px)",
        }}
        data-slot="row"
      >
        {/* Left side */}
        {/* The chip truncates inside this slot instead of running under the
            actions on a phone (D16). */}
        <div
          className="flex min-w-0 flex-1 items-center gap-2"
          data-slot="leading"
          data-state={sheetContext ? "sheet-context" : "garden-context"}
        >
          {sheetContext ? (
            <>
              <button
                type="button"
                onClick={sheetContext.onBack}
                aria-label={formatMessage({ id: "cockpit.topBar.back", defaultMessage: "Back" })}
                className={ICON_BTN}
                data-component="AppBar"
                data-slot="back-button"
              >
                <RiArrowLeftLine className="h-5 w-5" />
              </button>
              <span className="truncate text-title-md text-text-strong" data-slot="sheet-label">
                {sheetContext.label}
              </span>
            </>
          ) : (
            gardenChip
          )}
        </div>

        {/* Right side — all icons share ICON_BTN styling via TopBarIconButton */}
        <div className="flex shrink-0 items-center gap-1" data-slot="actions">
          {/* First in the cluster, so the icons after it keep their places when
            it comes and goes. */}
          {walletNetwork ? <WalletNetworkButton notice={walletNetwork} /> : null}

          {/* Refresh — mobile/tablet only, registered via useRefreshAction by the
            active view. Desktop uses inline header actions instead. */}
          {showRefresh && refreshAction ? (
            <TopBarIconButton
              slot="refresh-button"
              tooltip={formatMessage({
                id: "cockpit.topBar.refresh",
                defaultMessage: "Refresh",
              })}
              onClick={refreshAction.onRefresh}
            >
              <RiRefreshLine
                className={cn("h-5 w-5", refreshAction.isFetching && "animate-spin")}
              />
            </TopBarIconButton>
          ) : null}

          {/* Search — hidden on mobile */}
          {onOpenSearch && (
            <TopBarIconButton
              slot="search-button"
              tooltip={formatMessage({
                id: "cockpit.topBar.openSearch",
                defaultMessage: "Open Search",
              })}
              onClick={onOpenSearch}
              className="hidden min-[600px]:flex"
            >
              <RiSearchLine className="h-5 w-5" />
            </TopBarIconButton>
          )}

          {/* Notification bell — opens the notifications side sheet (bottom
            sheet on mobile). Rendered on every viewport. */}
          {onOpenNotifications && (
            <TopBarIconButton
              slot="notifications-button"
              tooltip={formatMessage({
                id: "cockpit.topBar.notifications",
                defaultMessage: "Notifications",
              })}
              onClick={onOpenNotifications}
            >
              <RiNotification3Line className="h-5 w-5" />
            </TopBarIconButton>
          )}

          {/* Settings */}
          {onOpenSettings && (
            <TopBarIconButton
              slot="settings-button"
              tooltip={formatMessage({
                id: "cockpit.topBar.openSettings",
                defaultMessage: "Open Settings",
              })}
              onClick={onOpenSettings}
            >
              <RiSettings3Line className="h-5 w-5" />
            </TopBarIconButton>
          )}

          {/* Profile — 28px avatar circle on surface-container-highest */}
          {onOpenProfile && (
            <TopBarIconButton
              slot="profile-button"
              tooltip={formatMessage({
                id: "cockpit.topBar.openProfile",
                defaultMessage: "Profile",
              })}
              onClick={onOpenProfile}
            >
              {profileImageSrc ? (
                <img
                  src={profileImageSrc}
                  alt=""
                  className="h-7 w-7 rounded-full object-cover"
                  data-slot="profile-image"
                />
              ) : (
                <span
                  className="flex h-7 w-7 items-center justify-center rounded-full bg-[rgb(var(--m3-surface-container-highest))] text-[rgb(var(--m3-on-surface))]"
                  data-slot="profile-fallback"
                >
                  <RiUserLine className="h-4 w-4" />
                </span>
              )}
            </TopBarIconButton>
          )}
        </div>
      </div>
    </header>
  );
}
