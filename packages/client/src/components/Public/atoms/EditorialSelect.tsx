import { cn } from "@green-goods/shared";
import * as SelectPrimitive from "@radix-ui/react-select";

export interface EditorialSelectOption {
  value: string;
  label: string;
}

export interface EditorialSelectProps {
  value: string;
  onValueChange: (value: string) => void;
  options: readonly EditorialSelectOption[];
  ariaLabel: string;
  className?: string;
}

/**
 * EditorialSelect — custom dropdown matching the Warm Earth × Vellum dialect.
 *
 * Uses `@radix-ui/react-select` for full keyboard nav, focus management, and
 * portal positioning, but with editorial styling instead of the admin form
 * chrome (`gg-control`) used by the shared `Select` primitive.
 *
 * Trigger: hairline-underlined Fraunces label + small caret. No background,
 * no rounded chrome.
 *
 * Content: linen popover with hairline border, Fraunces options, soft hover
 * inversion. Active item shows a `✓` glyph instead of the heavier checkmark
 * icon used in form contexts.
 *
 * Pair with a native `<select>` behind a `md:hidden` / `hidden md:inline-flex`
 * pair so mobile users get the OS picker (better tap targets) and desktop
 * users get the styled control.
 */
export function EditorialSelect({
  value,
  onValueChange,
  options,
  ariaLabel,
  className,
}: EditorialSelectProps) {
  return (
    <SelectPrimitive.Root value={value} onValueChange={onValueChange}>
      <SelectPrimitive.Trigger
        aria-label={ariaLabel}
        className={cn(
          "inline-flex cursor-pointer items-center gap-2 border-b border-stroke-soft-200 pb-1 font-serif text-sm text-text-strong-950 transition-colors duration-[var(--spring-effects-duration)] ease-[var(--spring-effects-easing)]",
          "hover:border-text-strong-950 focus:outline-none focus-visible:border-primary-action",
          className
        )}
      >
        <SelectPrimitive.Value />
        <SelectPrimitive.Icon asChild>
          <span aria-hidden="true" className="text-xs leading-none text-text-soft-400">
            ▾
          </span>
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          position="popper"
          sideOffset={6}
          collisionPadding={16}
          className={cn(
            // Cap by both Radix's available-height var (so we never spill past
            // the viewport edge after collision-flipping) and a hard 18rem
            // ceiling (so a 50-Garden list never produces a giant popover).
            // Whichever is smaller wins via min().
            "z-overlay min-w-[--radix-select-trigger-width] overflow-hidden",
            "max-h-[min(var(--radix-select-content-available-height),18rem)]",
            "border border-stroke-soft-200 bg-bg-white-0 shadow-[var(--shadow-editorial-card)]",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
          )}
        >
          <SelectPrimitive.Viewport className="max-h-[inherit] overflow-y-auto p-1">
            {options.map((option) => (
              <SelectPrimitive.Item
                key={option.value}
                value={option.value}
                className={cn(
                  "relative flex cursor-pointer select-none items-center px-3 py-2 pr-8 font-serif text-sm text-text-strong-950 outline-none",
                  "data-[highlighted]:bg-bg-weak-50 data-[highlighted]:text-primary-action",
                  "data-[state=checked]:font-medium",
                  "data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
                )}
              >
                <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
                <span
                  aria-hidden="true"
                  className="absolute right-3 inline-flex h-4 w-4 items-center justify-center text-xs text-primary-action"
                >
                  <SelectPrimitive.ItemIndicator>✓</SelectPrimitive.ItemIndicator>
                </span>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}
