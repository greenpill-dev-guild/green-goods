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
 * Renders the desktop view-action row — the stable-trio grammar: a
 * workspace's actions render in declaration order on every tab, and only the
 * active tab's action carries the filled (`primary`) variant. No overflow
 * menu and no reordering, so button positions never shift between tabs.
 *
 * Pair with `useViewActions` so the same `ViewAction[]` drives both this
 * component (desktop) and the FAB speed-dial (tablet/mobile).
 */
export function AdminViewActions({ items }: AdminViewActionsProps) {
  if (items.length === 0) return null;

  return (
    <div
      className="flex flex-shrink-0 flex-wrap items-center justify-end gap-2"
      data-component="AdminViewActions"
    >
      {items.map((action) => (
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
