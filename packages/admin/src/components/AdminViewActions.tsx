import {
  Button,
  type ButtonEmphasis,
  type ButtonTone,
} from "@green-goods/shared/components/Button";
import type { ViewAction } from "@green-goods/shared/components/Canvas/viewActions.types";
import { useIntl } from "react-intl";
import { AdminTooltip } from "./AdminTooltip";

interface AdminViewActionsProps {
  items: ViewAction[];
}

/** A view action's variant on the shared button (DL-115). */
const VIEW_ACTION_BUTTON: Record<
  NonNullable<ViewAction["variant"]>,
  { emphasis: ButtonEmphasis; tone?: ButtonTone }
> = {
  primary: { emphasis: "primary" },
  secondary: { emphasis: "secondary" },
  ghost: { emphasis: "tertiary" },
  danger: { emphasis: "primary", tone: "danger" },
};

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
  const { formatMessage } = useIntl();
  const { emphasis, tone } = VIEW_ACTION_BUTTON[action.variant ?? "secondary"];
  const Icon = action.icon;
  const reason =
    action.disabled && action.disabledReasonId
      ? formatMessage({ id: action.disabledReasonId, defaultMessage: action.disabledReason })
      : undefined;
  // A natively disabled button takes neither hover nor focus, so its reason
  // would reach no one. With a reason, the action stays focusable and inert.
  const button = (
    <Button
      type="button"
      emphasis={emphasis}
      tone={tone}
      size="sm"
      onClick={action.disabled ? undefined : action.onClick}
      disabled={action.disabled && !reason}
      aria-disabled={reason ? true : undefined}
      leadingIcon={<Icon className="h-[18px] w-[18px]" aria-hidden="true" />}
      data-action-id={action.id}
      data-action-variant={action.variant ?? "secondary"}
    >
      {formatMessage({ id: action.labelId, defaultMessage: action.shortLabel ?? action.label })}
    </Button>
  );
  return reason ? (
    <AdminTooltip content={reason} placement="bottom">
      {button}
    </AdminTooltip>
  ) : (
    button
  );
}
