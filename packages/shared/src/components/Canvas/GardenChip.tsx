import { RiArrowDownSLine, RiSeedlingLine } from "@remixicon/react";
import { type CSSProperties, lazy, Suspense, useState } from "react";
import { useIntl } from "react-intl";
import { cn } from "../../utils/styles/cn";
import { GardenBannerFallback } from "../Display/GardenBannerFallback";
import { ImageWithFallback } from "../Display/ImageWithFallback";

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

/** A garden the chip names. With `bannerImage`, its avatar is the garden's banner (DL-124). */
export interface GardenChipGarden {
  id: string;
  name: string;
  /**
   * The garden's banner, drawn as the avatar; an empty string draws the garden's fallback
   * tile. Left out, the avatar is the seedling tile.
   */
  bannerImage?: string;
}

export interface GardenChipProps {
  gardens: GardenChipGarden[];
  selectedGarden: GardenChipGarden | null;
  onSelectGarden: (garden: { id: string; name: string } | null) => void;
  onCreateGarden?: () => void;
  showCreateGardenAction?: boolean;
  /**
   * Opens the caller's own switcher instead of the chip's menu, with one garden too: the
   * installed app's half sheet (DL-124, DL-125). The cockpit leaves it out and keeps its menu.
   */
  onOpen?: () => void;
  /** The label while no garden is chosen; the cockpit's "Select Garden" when left out. */
  emptyLabel?: string;
}

// ----------------------------------------------------------------------------
// GardenChip
// ----------------------------------------------------------------------------

// The cockpit's menu arrives with the chip's first press. The installed app opens its own
// switcher (`onOpen`) and never asks for it, so the popover and its positioning stay out of the
// app's startup bundle.
const GardenChipMenu = lazy(() =>
  import("./GardenChipMenu").then(({ GardenChipMenu }) => ({ default: GardenChipMenu }))
);

/**
 * Compact pill/chip showing the active garden name, with the garden's banner as its
 * avatar when the caller passes one (DL-124).
 *
 * - With `onOpen` (the installed app): a button that opens the caller's switcher,
 *   whatever the number of gardens
 * - 1 garden: Static label (no dropdown)
 * - 2+ gardens: Click to open a Radix Popover dropdown with
 *   garden list, divider, "Create Garden" at bottom
 *
 * Decision D47: single-garden users never see the cockpit's switcher.
 * Decision D50: dropdown contains only gardens + Create Garden.
 *
 * Its size, hit area, outline and focus ring read the `--gg-garden-chip-*`
 * tokens. The cockpit renders their fallbacks, a 36px pill; the installed app's
 * scope sets the app's density in shared `theme.css`.
 */
export function GardenChip({
  gardens,
  selectedGarden,
  onSelectGarden,
  onCreateGarden,
  showCreateGardenAction = true,
  onOpen,
  emptyLabel,
}: GardenChipProps) {
  const { formatMessage } = useIntl();
  // The menu is asked for with the first press and keeps its open state here from then on.
  const [menu, setMenu] = useState({ requested: false, open: false });

  const displayName =
    selectedGarden?.name ??
    emptyLabel ??
    formatMessage({ id: "cockpit.gardenChip.selectGarden", defaultMessage: "Select Garden" });

  const hasMultiple = gardens.length >= 2;
  // A capsule on the raised surface with a 1px edge and no shadow: 36px with
  // 8px and 14px insets and the hairline stroke in the cockpit, the fallbacks
  // below, and the app's density where its scope sets the tokens. Bounded by the
  // slot the app bar gives it, so a long name truncates before the bar's actions
  // rather than running under them. `--surface-raised` is a complete CSS color
  // so admin can scope it per theme.
  const chipStyle: CSSProperties = {
    height: "var(--gg-garden-chip-height, 36px)",
    padding: "0 var(--gg-garden-chip-inline-end, 14px) 0 var(--gg-garden-chip-inline-start, 8px)",
    background: "var(--surface-raised, rgb(var(--bg-white-0)))",
    border: "1px solid rgb(var(--gg-garden-chip-edge, var(--stroke-sub-300)))",
    maxWidth: "100%",
  };
  const menuSizingStyle: CSSProperties = {
    width: "max-content",
    maxWidth: "calc(100vw - 2rem)",
    overflow: "hidden",
  };
  const showCreateAction = Boolean(onCreateGarden && showCreateGardenAction);

  // Leading avatar, 22px on both surfaces: the garden's banner in a circle, its
  // name's fallback tile when it has none (DL-124), or, for a caller that passes
  // no banner, a round mint tile with the seedling glyph (Cockpit M3 1a switcher
  // anatomy), with a 14px glyph in the cockpit.
  const avatarSize = "var(--gg-garden-chip-avatar, 22px)";
  const leadingAvatar =
    selectedGarden?.bannerImage !== undefined ? (
      <span
        className="relative shrink-0 overflow-hidden rounded-full bg-bg-weak"
        style={{ width: avatarSize, height: avatarSize }}
        aria-hidden="true"
        data-slot="avatar"
      >
        <ImageWithFallback
          src={selectedGarden.bannerImage}
          alt=""
          loading="eager"
          className="absolute inset-0 h-full w-full object-cover"
          backgroundFallback={<GardenBannerFallback name={selectedGarden.name} />}
        />
      </span>
    ) : (
      <span
        className="flex shrink-0 items-center justify-center rounded-full"
        style={{
          width: avatarSize,
          height: avatarSize,
          background: "rgb(var(--green-100))",
          color: "rgb(var(--green-900))",
        }}
        aria-hidden="true"
        data-slot="avatar"
      >
        <RiSeedlingLine
          style={{
            width: "var(--gg-garden-chip-glyph, 0.875rem)",
            height: "var(--gg-garden-chip-glyph, 0.875rem)",
          }}
        />
      </span>
    );

  // Static chip when only 1 garden and no switcher of the caller's to open.
  if (!hasMultiple && !onOpen) {
    return (
      <span
        className={cn(
          "inline-flex max-w-sm items-center gap-2 rounded-full",
          "type-label text-text-strong"
        )}
        style={chipStyle}
        data-component="GardenChip"
        data-slot="root"
        data-state={selectedGarden ? "selected" : "empty"}
      >
        {selectedGarden ? (
          leadingAvatar
        ) : (
          <RiSeedlingLine className="h-4 w-4 shrink-0 text-text-sub" />
        )}
        <span className="min-w-0 truncate" title={displayName}>
          {displayName}
        </span>
      </span>
    );
  }

  // The interactive chip. `gg-garden-chip` carries the hit area where the
  // surface sets one (the app's 48px, theme.css).
  const triggerClassName = cn(
    "gg-garden-chip relative inline-flex cursor-pointer items-center gap-2 rounded-full",
    "type-label text-text-strong",
    "transition-colors duration-[var(--spring-effects-fast-duration)] ease-[var(--spring-effects-fast-easing)]",
    "motion-reduce:transition-none",
    "hover:bg-bg-weak",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--gg-garden-chip-focus-ring,var(--tone-focus-ring,var(--tone-action,var(--green-800)))))]"
  );
  const triggerContent = (
    <>
      {selectedGarden ? (
        leadingAvatar
      ) : (
        <RiSeedlingLine className="h-4 w-4 shrink-0 text-text-sub" />
      )}
      <span className="min-w-0 truncate" title={displayName}>
        {displayName}
      </span>
      {/* Caret signals the chip is a garden switcher (QA: the pill didn't
          read as interactive without an explicit dropdown affordance).
          12px in the cockpit. */}
      <RiArrowDownSLine
        aria-hidden="true"
        style={{
          height: "var(--gg-garden-chip-caret, 0.75rem)",
          width: "var(--gg-garden-chip-caret, 0.75rem)",
          flexShrink: 0,
          color: "rgb(var(--text-soft-400))",
        }}
      />
    </>
  );

  // The caller's switcher: the app's half sheet opens from the chip, one garden or several.
  if (onOpen) {
    return (
      <button
        type="button"
        onClick={onOpen}
        aria-haspopup="dialog"
        className={triggerClassName}
        style={chipStyle}
        data-component="GardenChip"
        data-slot="trigger"
        data-selection-state={selectedGarden ? "selected" : "empty"}
      >
        {triggerContent}
      </button>
    );
  }

  // Multi-garden: the cockpit's chip and its menu. Until the menu's code has arrived, the chip
  // stands in with the same markup, and the press that asked for the menu opens it as it mounts.
  const trigger = {
    className: triggerClassName,
    style: chipStyle,
    content: triggerContent,
    selectionState: (selectedGarden ? "selected" : "empty") as "selected" | "empty",
  };
  const standInTrigger = (
    <button
      type="button"
      onClick={() => setMenu((current) => ({ requested: true, open: !current.open }))}
      aria-haspopup="dialog"
      aria-expanded={menu.open}
      className={trigger.className}
      style={trigger.style}
      data-component="GardenChip"
      data-slot="trigger"
      data-selection-state={trigger.selectionState}
    >
      {triggerContent}
    </button>
  );
  if (!menu.requested) return standInTrigger;

  return (
    <Suspense fallback={standInTrigger}>
      <GardenChipMenu
        gardens={gardens}
        selectedGarden={selectedGarden}
        onSelectGarden={onSelectGarden}
        onCreateGarden={showCreateAction ? onCreateGarden : undefined}
        open={menu.open}
        onOpenChange={(open) => setMenu({ requested: true, open })}
        trigger={trigger}
        menuStyle={menuSizingStyle}
      />
    </Suspense>
  );
}
