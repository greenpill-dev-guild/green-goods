import * as Popover from "@radix-ui/react-popover";
import { RiAddLine } from "@remixicon/react";
import type { CSSProperties, ReactNode } from "react";
import { useIntl } from "react-intl";
import { compareAddresses } from "../../utils/blockchain/address";
import { cn } from "../../utils/styles/cn";
import type { GardenChipGarden } from "./GardenChip";

export interface GardenChipMenuProps {
  gardens: GardenChipGarden[];
  selectedGarden: GardenChipGarden | null;
  onSelectGarden: (garden: { id: string; name: string } | null) => void;
  /** Present only when the menu ends with Create Garden. */
  onCreateGarden?: () => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The chip's trigger as `GardenChip` draws it, so the stand-in and this read the same. */
  trigger: {
    className: string;
    style: CSSProperties;
    content: ReactNode;
    selectionState: "selected" | "empty";
  };
  menuStyle: CSSProperties;
}

/**
 * The cockpit's garden menu (decisions D47 and D50): the chip as a Radix Popover trigger, the
 * garden list, a divider and Create Garden. `GardenChip` loads it with the chip's first press,
 * so the popover and its positioning stay out of the installed app's startup bundle; the app
 * opens its own switcher instead.
 */
export function GardenChipMenu({
  gardens,
  selectedGarden,
  onSelectGarden,
  onCreateGarden,
  open,
  onOpenChange,
  trigger,
  menuStyle,
}: GardenChipMenuProps) {
  const { formatMessage } = useIntl();

  return (
    <Popover.Root open={open} onOpenChange={onOpenChange}>
      <Popover.Trigger asChild>
        <button
          type="button"
          className={trigger.className}
          style={trigger.style}
          data-component="GardenChip"
          data-slot="trigger"
          data-selection-state={trigger.selectionState}
        >
          {trigger.content}
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
          style={menuStyle}
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
                onOpenChange(false);
              }}
            />
          ))}

          {/* Divider + Create Garden. The divider is the raised surface's hairline, so it
              still reads on the cockpit's dark card. */}
          {onCreateGarden && (
            <>
              <div className="mx-2 my-1 border-t border-[color:var(--hairline,rgb(var(--stroke-soft-200)))]" />
              <button
                type="button"
                onClick={() => {
                  onCreateGarden();
                  onOpenChange(false);
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
