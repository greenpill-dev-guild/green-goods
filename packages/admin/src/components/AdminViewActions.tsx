import type { ViewAction } from "@green-goods/shared";
import { AdminButton } from "./AdminButton";

interface AdminViewActionsProps {
  items: ViewAction[];
}

const VARIANT_TO_ADMIN_BUTTON = {
  primary: "filled",
  secondary: "outlined",
  ghost: "text",
  danger: "danger",
} as const;

/**
 * Renders the desktop view-action row. Each view declares ONE fixed primary
 * action: it renders filled and rightmost (affirmative action on the right),
 * with the remaining actions in declaration order to its left. The primary no
 * longer follows the active tab, so its position is stable across tabs.
 *
 * Pair with `useViewActions` so the same `ViewAction[]` drives both this
 * component (desktop) and the FAB speed-dial (tablet/mobile).
 */
export function AdminViewActions({ items }: AdminViewActionsProps) {
  if (items.length === 0) return null;

  // Primary rightmost: non-primary actions keep declaration order; the single
  // primary sorts last. Array.sort is stable, so siblings never shuffle.
  const ordered = [...items].sort(
    (a, b) => Number(Boolean(a.primary)) - Number(Boolean(b.primary))
  );

  return (
    <div
      className="flex flex-shrink-0 flex-wrap items-center justify-end gap-2"
      data-component="AdminViewActions"
    >
      {ordered.map((action) => (
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
