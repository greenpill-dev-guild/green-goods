// Command: compact, solid action disclosure following GardenChipMenu's popover pattern.
import * as Popover from "@radix-ui/react-popover";
import { RiMore2Fill } from "@remixicon/react";
import { useRef, useState } from "react";
import { IconButton } from "./IconButton";

export interface ActionMenuProps {
  label: string;
  actions: { label: string; onSelect: () => void; danger?: boolean; disabled?: boolean }[];
}

/** A labeled compact disclosure; native buttons keep normal Tab/Enter behavior. */
export function ActionMenu({ label, actions }: ActionMenuProps) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const selected = useRef(false);
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <IconButton
          data-piece-control
          ref={trigger}
          onPointerDown={(event) => event.currentTarget.focus({ preventScroll: true })}
          aria-label={label}
          emphasis="secondary"
          size="compact"
          icon={<RiMore2Fill aria-hidden="true" />}
        />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          onCloseAutoFocus={(event) => {
            if (selected.current) event.preventDefault();
            selected.current = false;
          }}
          align="end"
          sideOffset={8}
          aria-label={label}
          className="z-overlay rounded-xl bg-bg-white-0 p-1 shadow-lg"
        >
          {actions.map((action) => (
            <button
              key={action.label}
              type="button"
              disabled={action.disabled}
              className={`flex min-h-12 w-full items-center rounded-lg px-4 type-label hover:bg-bg-weak focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-base ${action.danger ? "text-error-base" : "text-text-main"}`}
              onClick={() => {
                // The menu item is transient. DialogShell must capture the persistent
                // trigger before it opens, including taps that Safari does not focus.
                trigger.current?.focus({ preventScroll: true });
                selected.current = true;
                setOpen(false);
                action.onSelect();
              }}
            >
              {action.label}
            </button>
          ))}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
