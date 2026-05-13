import { type ViewAction, cn } from "@green-goods/shared";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { RiMoreLine } from "@remixicon/react";
import { AdminButton } from "./AdminButton";

interface AdminViewActionsProps {
  items: ViewAction[];
  /**
   * Maximum buttons rendered inline before the rest fold into an overflow menu.
   * Defaults to 3 (matches the design reference: ghost + secondary + primary).
   */
  maxInline?: number;
}

const VARIANT_TO_ADMIN_BUTTON = {
  primary: "filled",
  secondary: "outlined",
  ghost: "text",
  danger: "danger",
} as const;

/**
 * Renders the desktop view-action row. Maps `ViewAction` variants to
 * `AdminButton` variants, keeps the primary action rightmost, and folds
 * any actions beyond `maxInline` into an overflow kebab.
 *
 * Pair with `useViewActions` so the same `ViewAction[]` drives both this
 * component (desktop) and the FAB speed-dial (tablet/mobile).
 */
export function AdminViewActions({ items, maxInline = 3 }: AdminViewActionsProps) {
  if (items.length === 0) return null;

  // The hook hands us actions in left-to-right order with the primary last.
  // When overflow is needed, keep the primary inline (rightmost) and push
  // the lowest-priority secondaries into the overflow menu.
  const inlineCount = Math.min(items.length, maxInline);
  const inline = items.length <= maxInline ? items : items.slice(items.length - inlineCount);
  const overflow = items.length <= maxInline ? [] : items.slice(0, items.length - inlineCount);

  return (
    <div
      className="flex flex-shrink-0 flex-wrap items-center justify-end gap-2"
      data-component="AdminViewActions"
    >
      {overflow.length > 0 ? <OverflowMenu items={overflow} /> : null}
      {inline.map((action) => (
        <AdminViewActionButton key={action.id} action={action} />
      ))}
    </div>
  );
}

function AdminViewActionButton({ action }: { action: ViewAction }) {
  const adminVariant = VARIANT_TO_ADMIN_BUTTON[action.variant ?? "secondary"];
  const Icon = action.icon;
  return (
    <AdminButton
      type="button"
      variant={adminVariant}
      size="md"
      onClick={action.onClick}
      disabled={action.disabled}
      leadingIcon={<Icon />}
      data-action-id={action.id}
      data-action-variant={action.variant ?? "secondary"}
    >
      {action.shortLabel ?? action.label}
    </AdminButton>
  );
}

function OverflowMenu({ items }: { items: ViewAction[] }) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
            "border border-[rgb(var(--m3-outline))] text-[rgb(var(--m3-on-surface))]",
            "hover:bg-[rgb(var(--m3-on-surface)/0.06)] active:bg-[rgb(var(--m3-on-surface)/0.10)]",
            "transition-colors duration-[var(--spring-spatial-fast-duration)] ease-[var(--spring-spatial-fast-easing)]",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--m3-primary))]"
          )}
          aria-label="More actions"
          title="More actions"
          data-component="AdminViewActions"
          data-slot="overflow-trigger"
        >
          <RiMoreLine className="h-5 w-5" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          side="bottom"
          align="end"
          sideOffset={6}
          className={cn(
            "z-overlay min-w-[200px] rounded-2xl bg-bg-white p-1.5 shadow-lg",
            "border border-stroke-soft",
            "animate-in fade-in-0 zoom-in-95"
          )}
        >
          {items.map((action) => {
            const Icon = action.icon;
            const isDanger = action.variant === "danger";
            return (
              <DropdownMenu.Item
                key={action.id}
                onSelect={action.onClick}
                disabled={action.disabled}
                data-action-id={action.id}
                className={cn(
                  "flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-sm outline-none",
                  isDanger
                    ? "text-error-base hover:bg-error-lighter focus:bg-error-lighter"
                    : "text-text-sub hover:bg-bg-weak focus:bg-bg-weak",
                  "data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {action.label}
              </DropdownMenu.Item>
            );
          })}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
