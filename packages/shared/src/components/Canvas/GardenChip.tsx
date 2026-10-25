import * as Popover from "@radix-ui/react-popover";
import { RiAddLine, RiArrowDownSLine, RiSeedlingLine } from "@remixicon/react";
import { useState, type CSSProperties } from "react";
import { useIntl } from "react-intl";
import { compareAddresses } from "../../utils/blockchain/address";
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
  const [open, setOpen] = useState(false);

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

  // Multi-garden: interactive chip with popover
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          className={triggerClassName}
          style={chipStyle}
          data-component="GardenChip"
          data-slot="trigger"
          data-selection-state={selectedGarden ? "selected" : "empty"}
        >
          {triggerContent}
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        {/* Solid, like every menu (DL-108): the chip's own raised surface, white in light
            and the cockpit's card in dark. */}
        <Popover.Content
          align="start"
          sideOffset={8}
          className={cn(
            "z-overlay rounded-xl bg-[var(--surface-raised,rgb(var(--bg-white-0)))] p-1 shadow-[var(--edge-rest),_var(--m3-elevation-2)]",
            "animate-in fade-in-0 zoom-in-95",
            "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
            "motion-reduce:animate-none"
          )}
          style={menuSizingStyle}
          data-component="GardenChip"
          data-slot="menu"
        >
          {/* Garden list */}
          {gardens.map((garden) => (
            <GardenDropdownItem
              key={garden.id}
              label={garden.name}
              isSelected={compareAddresses(selectedGarden?.id, garden.id)}
              onClick={() => {
                onSelectGarden(garden);
                setOpen(false);
              }}
            />
          ))}

          {/* Divider + Create Garden. The divider is the raised surface's hairline, so it
              still reads on the cockpit's dark card. */}
          {showCreateAction && (
            <>
              <div className="mx-2 my-1 border-t border-[color:var(--hairline,rgb(var(--stroke-soft-200)))]" />
              <button
                type="button"
                onClick={() => {
                  onCreateGarden?.();
                  setOpen(false);
                }}
                className={cn(
                  // Menu row on cockpit roles (tone-aware with shared fallbacks
                  // — this popover only ever renders inside the admin shell):
                  // accent from the workspace, ink hover layer, the canonical
                  // focus-ring role. Previously client-green + raw primary ring.
                  "flex w-full items-center gap-2 rounded-lg px-3 py-2 type-label",
                  "[color:rgb(var(--tone-on-surface-accent,var(--primary-base)))]",
                  "hover:bg-[rgb(var(--m3-on-surface,var(--text-strong-950))/0.08)]",
                  "transition-colors duration-[var(--spring-effects-fast-duration)] ease-[var(--spring-effects-fast-easing)]",
                  "motion-reduce:transition-none",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--tone-focus-ring,var(--primary-base)))]"
                )}
                data-component="GardenChip"
                data-slot="create-action"
              >
                <RiAddLine className="h-4 w-4" />
                {formatMessage({ id: "cockpit.gardenChip.createGarden" })}
              </button>
            </>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

// ----------------------------------------------------------------------------
// Dropdown item sub-component
// ----------------------------------------------------------------------------

interface GardenDropdownItemProps {
  label: string;
  isSelected: boolean;
  onClick: () => void;
}

function GardenDropdownItem({ label, isSelected, onClick }: GardenDropdownItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center rounded-lg px-3 py-2 type-body",
        "transition-colors duration-[var(--spring-effects-fast-duration)] ease-[var(--spring-effects-fast-easing)]",
        "motion-reduce:transition-none",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-base",
        isSelected
          ? "bg-primary-alpha-10 font-medium text-primary-dark"
          : "text-text-main hover:bg-bg-weak"
      )}
      data-component="GardenChip"
      data-slot="option"
      data-state={isSelected ? "selected" : "unselected"}
    >
      <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap" title={label}>
        {label}
      </span>
    </button>
  );
}
