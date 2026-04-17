import * as Popover from "@radix-ui/react-popover";
import { RiAddLine, RiCheckLine, RiSeedlingLine } from "@remixicon/react";
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

  // Static chip when only 1 garden
  if (!hasMultiple) {
    return (
      <span
        className={cn(
          "inline-flex max-w-sm items-center gap-1.5 rounded-full",
          "px-3 py-1.5",
          "glass-raised",
          "shadow-[var(--edge-rest),_var(--elevation-1)]",
          "text-label-lg font-medium text-text-main"
        )}
      >
        {selectedGarden ? (
          <span className="relative flex h-4 w-4 shrink-0 items-center justify-center">
            <RiSeedlingLine className="h-4 w-4 text-success-base" />
            <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-success-base ring-2 ring-bg-white" />
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
            "glass-raised",
            "shadow-[var(--edge-rest),_var(--elevation-1)]",
            "text-label-lg font-medium text-text-main",
            "transition-all duration-[var(--spring-micro-duration,150ms)]",
            "motion-reduce:transition-none",
            "hover:bg-bg-weak hover:shadow-[var(--edge-hover),_var(--elevation-3)]",
            "focus-visible:outline-none focus-visible:shadow-[var(--edge-focus),_var(--elevation-1)]"
          )}
        >
          {selectedGarden ? (
            <span className="relative flex h-4 w-4 shrink-0 items-center justify-center">
              <RiSeedlingLine className="h-4 w-4 text-success-base" />
              <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-success-base ring-2 ring-bg-white" />
            </span>
          ) : (
            <RiSeedlingLine className="h-4 w-4 shrink-0 text-text-sub" />
          )}
          <span className="truncate" title={displayName}>
            {displayName}
          </span>
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
                  "transition-colors duration-[var(--spring-micro-duration,150ms)]",
                  "motion-reduce:transition-none",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-base"
                )}
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
        "transition-colors duration-[var(--spring-micro-duration,150ms)]",
        "motion-reduce:transition-none",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-base",
        isSelected
          ? "bg-primary-alpha-10 font-medium text-primary-dark"
          : "text-text-main hover:bg-bg-weak"
      )}
    >
      <span className="truncate" title={label}>
        {label}
      </span>
    </button>
  );
}
