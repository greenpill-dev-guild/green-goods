import * as Popover from "@radix-ui/react-popover";
import { RiAddLine, RiArrowDownSLine, RiSeedlingLine } from "@remixicon/react";
import { useState } from "react";
import { useIntl } from "react-intl";
import { cn } from "../../utils/styles/cn";

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

export interface GardenChipProps {
  gardens: Array<{ id: string; name: string }>;
  selectedGarden: { id: string; name: string } | null;
  onSelectGarden: (garden: { id: string; name: string } | null) => void;
  onCreateGarden?: () => void;
}

// ----------------------------------------------------------------------------
// GardenChip
// ----------------------------------------------------------------------------

/**
 * Compact pill/chip showing the active garden name.
 *
 * - 1 garden: Static label (no dropdown, no "All Gardens")
 * - 2+ gardens: Click to open a Radix Popover dropdown with
 *   "All Gardens" at top, garden list, divider, "Create Garden" at bottom
 *
 * Decision D47: single-garden users never see a switcher.
 * Decision D50: dropdown contains only gardens + All Gardens + Create Garden.
 */
export function GardenChip({
  gardens,
  selectedGarden,
  onSelectGarden,
  onCreateGarden,
}: GardenChipProps) {
  const { formatMessage } = useIntl();
  const [open, setOpen] = useState(false);

  const displayName =
    selectedGarden?.name ?? formatMessage({ id: "cockpit.gardenChip.allGardens" });

  const hasMultiple = gardens.length >= 2;

  // Static chip when only 1 garden — handoff `.rv-pill`: flat surface-raised
  // background + 1px outline, no elevation shadow. `--surface-raised` and
  // `--outline` are complete CSS colors so admin can scope them per theme.
  if (!hasMultiple) {
    return (
      <span
        className={cn(
          "inline-flex max-w-sm items-center gap-1.5 rounded-full",
          "px-3 py-1.5",
          "text-label-lg font-medium text-text-strong"
        )}
        style={{
          background: "var(--surface-raised, rgb(var(--bg-white-0)))",
          border: "1px solid var(--outline, rgb(var(--neutral-800) / 0.10))",
        }}
        data-component="GardenChip"
        data-slot="root"
        data-state={selectedGarden ? "selected" : "empty"}
      >
        {selectedGarden ? (
          <span className="relative flex h-4 w-4 shrink-0 items-center justify-center">
            <RiSeedlingLine
              className="h-4 w-4"
              // Handoff DESIGN_NOTES § Tone system: garden-pill leaf tints to
              // the active view's tone. Falls back to brand green if the
              // ancestor doesn't set [data-tone].
              style={{ color: "rgb(var(--tone-action, var(--green-800)))" }}
            />
            <span
              className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full ring-2 ring-bg-white"
              style={{ background: "rgb(var(--tone-action, var(--green-800)))" }}
            />
          </span>
        ) : (
          <RiSeedlingLine className="h-4 w-4 shrink-0 text-text-sub" />
        )}
        <span className="truncate" title={displayName}>
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
            "inline-flex max-w-sm cursor-pointer items-center gap-1.5 rounded-full",
            "px-3 py-1.5",
            "text-label-lg font-medium text-text-strong",
            "transition-colors duration-[var(--spring-effects-fast-duration)] ease-[var(--spring-effects-fast-easing)]",
            "motion-reduce:transition-none",
            "hover:bg-bg-weak",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--tone-action,var(--green-800)))]"
          )}
          style={{
            background: "var(--surface-raised, rgb(var(--bg-white-0)))",
            border: "1px solid var(--outline, rgb(var(--neutral-800) / 0.10))",
          }}
          data-component="GardenChip"
          data-slot="trigger"
          data-selection-state={selectedGarden ? "selected" : "all-gardens"}
        >
          {selectedGarden ? (
            <span className="relative flex h-4 w-4 shrink-0 items-center justify-center">
              <RiSeedlingLine
                className="h-4 w-4"
                style={{ color: "rgb(var(--tone-action, var(--green-800)))" }}
              />
              <span
                className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full ring-2 ring-bg-white"
                style={{ background: "rgb(var(--tone-action, var(--green-800)))" }}
              />
            </span>
          ) : (
            <RiSeedlingLine className="h-4 w-4 shrink-0 text-text-sub" />
          )}
          <span className="truncate" title={displayName}>
            {displayName}
          </span>
          {/* Caret signals the chip is a garden switcher (QA: the pill didn't
              read as interactive without an explicit dropdown affordance).
              Inline metrics/color keep this shared-JSX icon off Tailwind
              utilities that admin's content scan may not reach. */}
          <RiArrowDownSLine
            aria-hidden="true"
            style={{
              height: "1rem",
              width: "1rem",
              flexShrink: 0,
              color: "rgb(var(--text-sub-600))",
            }}
          />
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={8}
          className={cn(
            "z-overlay w-56 rounded-xl glass-floating p-1 shadow-[var(--edge-rest),_var(--elevation-4)]",
            "animate-in fade-in-0 zoom-in-95",
            "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
            "motion-reduce:animate-none"
          )}
          data-component="GardenChip"
          data-slot="menu"
        >
          {/* All Gardens option */}
          <GardenDropdownItem
            label={formatMessage({ id: "cockpit.gardenChip.allGardens" })}
            isSelected={selectedGarden === null}
            onClick={() => {
              onSelectGarden(null);
              setOpen(false);
            }}
          />

          {/* Garden list */}
          {gardens.map((garden) => (
            <GardenDropdownItem
              key={garden.id}
              label={garden.name}
              isSelected={selectedGarden?.id === garden.id}
              onClick={() => {
                onSelectGarden(garden);
                setOpen(false);
              }}
            />
          ))}

          {/* Divider + Create Garden */}
          {onCreateGarden && (
            <>
              <div className="mx-2 my-1 border-t border-stroke-soft" />
              <button
                type="button"
                onClick={() => {
                  onCreateGarden();
                  setOpen(false);
                }}
                className={cn(
                  "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-body-md",
                  "text-primary-base hover:bg-bg-weak",
                  "transition-colors duration-[var(--spring-effects-fast-duration)] ease-[var(--spring-effects-fast-easing)]",
                  "motion-reduce:transition-none",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-base"
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
      <span className="truncate" title={label}>
        {label}
      </span>
    </button>
  );
}
