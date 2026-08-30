import * as Popover from "@radix-ui/react-popover";
import { RiAddLine, RiArrowDownSLine, RiSeedlingLine } from "@remixicon/react";
import { useState, type CSSProperties } from "react";
import { useIntl } from "react-intl";
import { compareAddresses } from "../../utils/blockchain/address";
import { cn } from "../../utils/styles/cn";

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

export interface GardenChipProps {
  gardens: Array<{ id: string; name: string }>;
  selectedGarden: { id: string; name: string } | null;
  onSelectGarden: (garden: { id: string; name: string } | null) => void;
  onCreateGarden?: () => void;
  showCreateGardenAction?: boolean;
}

// ----------------------------------------------------------------------------
// GardenChip
// ----------------------------------------------------------------------------

/**
 * Compact pill/chip showing the active garden name.
 *
 * - 1 garden: Static label (no dropdown)
 * - 2+ gardens: Click to open a Radix Popover dropdown with
 *   garden list, divider, "Create Garden" at bottom
 *
 * Decision D47: single-garden users never see a switcher.
 * Decision D50: dropdown contains only gardens + Create Garden.
 */
export function GardenChip({
  gardens,
  selectedGarden,
  onSelectGarden,
  onCreateGarden,
  showCreateGardenAction = true,
}: GardenChipProps) {
  const { formatMessage } = useIntl();
  const [open, setOpen] = useState(false);

  const displayName =
    selectedGarden?.name ??
    formatMessage({ id: "cockpit.gardenChip.selectGarden", defaultMessage: "Select Garden" });

  const hasMultiple = gardens.length >= 2;
  const chipTriggerStyle: CSSProperties = {
    maxWidth: "calc(100vw - 2rem)",
  };
  const menuSizingStyle: CSSProperties = {
    width: "max-content",
    maxWidth: "calc(100vw - 2rem)",
    overflow: "hidden",
  };
  const showCreateAction = Boolean(onCreateGarden && showCreateGardenAction);

  // Leading avatar — 22px round mint tile with the seedling glyph (Cockpit M3
  // 1a switcher anatomy). Inline styles keep this shared JSX off Tailwind
  // utilities that admin's content scan may not reach.
  const leadingAvatar = (
    <span
      className="flex shrink-0 items-center justify-center rounded-full"
      style={{
        width: "22px",
        height: "22px",
        background: "rgb(var(--green-100))",
        color: "rgb(var(--green-900))",
      }}
      aria-hidden="true"
      data-slot="avatar"
    >
      <RiSeedlingLine style={{ width: "0.875rem", height: "0.875rem" }} />
    </span>
  );

  // Static chip when only 1 garden — 36px pill, raised surface, hairline
  // border, no elevation shadow. `--surface-raised` is a complete CSS color so
  // admin can scope it per theme; the border rides the semantic stroke token.
  if (!hasMultiple) {
    return (
      <span
        className={cn(
          "inline-flex max-w-sm items-center gap-2 rounded-full",
          "text-label-lg font-medium text-text-strong"
        )}
        style={{
          height: "36px",
          padding: "0 14px 0 8px",
          background: "var(--surface-raised, rgb(var(--bg-white-0)))",
          border: "1px solid rgb(var(--stroke-sub-300))",
          ...chipTriggerStyle,
        }}
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

  // Multi-garden: interactive chip with popover
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex cursor-pointer items-center gap-2 rounded-full",
            "text-label-lg font-medium text-text-strong",
            "transition-colors duration-[var(--spring-effects-fast-duration)] ease-[var(--spring-effects-fast-easing)]",
            "motion-reduce:transition-none",
            "hover:bg-bg-weak",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--tone-focus-ring,var(--tone-action,var(--green-800))))]"
          )}
          style={{
            height: "36px",
            padding: "0 14px 0 8px",
            background: "var(--surface-raised, rgb(var(--bg-white-0)))",
            border: "1px solid rgb(var(--stroke-sub-300))",
            ...chipTriggerStyle,
          }}
          data-component="GardenChip"
          data-slot="trigger"
          data-selection-state={selectedGarden ? "selected" : "empty"}
        >
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
              Inline metrics/color keep this shared-JSX icon off Tailwind
              utilities that admin's content scan may not reach. */}
          <RiArrowDownSLine
            aria-hidden="true"
            style={{
              height: "0.75rem",
              width: "0.75rem",
              flexShrink: 0,
              color: "rgb(var(--text-soft-400))",
            }}
          />
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={8}
          className={cn(
            "z-overlay rounded-xl glass-floating p-1 shadow-[var(--edge-rest),_var(--m3-elevation-2)]",
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

          {/* Divider + Create Garden */}
          {showCreateAction && (
            <>
              <div className="mx-2 my-1 border-t border-stroke-soft" />
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
                  "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-body-md font-medium",
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
        "flex w-full items-center rounded-lg px-3 py-2 text-body-md",
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
