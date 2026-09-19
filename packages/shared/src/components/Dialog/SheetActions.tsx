/**
 * SheetActions — the one action bar every sheet and dialog pins under its
 * body (DL-016).
 *
 * Consumers describe their actions and the bar renders the buttons, so no
 * sheet hand-rolls its own action block again. Below 640px the actions stack
 * full width with the primary on top; `layout="steps"` keeps Back / Continue
 * in one row. From 640px the same bar is one right-aligned row with the
 * primary rightmost and a tertiary text action at the start.
 *
 * Layout lives in shared `utilities.css` as `[data-component="SheetActions"]`
 * attribute rules: Tailwind does not scan `packages/shared/src/` from the app
 * builds, so utilities authored here would not generate.
 *
 * The DOM keeps the stacked reading order (primary, secondary, tertiary), so
 * keyboard and screen-reader order match the phone layout. `steps` renders
 * Back before Continue, matching its row.
 *
 * A loading action stays focusable, the way the client Button handles
 * in-flight state: it is `aria-disabled` and `aria-busy` and ignores
 * activation, including a form submit, instead of dropping focus through
 * native `disabled`.
 *
 * @module components/Dialog/SheetActions
 */
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Button } from "../Button";

type NativeButtonProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "children" | "className" | "style"
>;

export interface SheetAction extends NativeButtonProps {
  label: ReactNode;
  /** Leading icon. The loading spinner replaces it while `loading`. */
  icon?: ReactNode;
  /** In-flight state: shows the spinner, sets `aria-busy`, and ignores activation. */
  loading?: boolean;
  /**
   * `danger` fills a primary with the error color and tints a secondary or
   * tertiary with it; `warning` fills a primary with the warning color.
   */
  tone?: "default" | "danger" | "warning";
  testId?: string;
}

export interface SheetActionsProps {
  /** The filled action. */
  primary?: SheetAction;
  /** The outlined action, Cancel included. */
  secondary?: SheetAction;
  /** A rare third choice, rendered as a text button. */
  tertiary?: SheetAction;
  /** `steps` keeps Back (secondary) and Continue (primary) in one row at every width. */
  layout?: "stack" | "steps";
  /**
   * Pads the device's bottom safe area. PwaSheet already pads its surface, so
   * only bars outside it (AppSheet, a tab's own step bar) need this.
   */
  safeArea?: boolean;
}

type ActionRole = "primary" | "secondary" | "tertiary";

/** Warning only colors a filled primary; the other roles fall back to their default tone. */
const toneFor = (role: ActionRole, tone: SheetAction["tone"] = "default") =>
  role === "primary" || tone === "danger" ? tone : "default";

function renderAction(role: ActionRole, action: SheetAction | undefined) {
  if (!action) return null;
  const {
    label,
    icon,
    loading = false,
    tone = "default",
    testId,
    type,
    disabled,
    onClick,
    ...buttonProps
  } = action;
  const inert = loading || Boolean(disabled);
  return (
    <Button
      {...buttonProps}
      key={role}
      type={type ?? "button"}
      emphasis={role}
      tone={toneFor(role, tone)}
      size="md"
      loading={loading}
      disabled={disabled}
      aria-disabled={inert || undefined}
      leadingIcon={icon}
      data-action={role}
      data-testid={testId}
      onClick={(event) => {
        if (inert) {
          event.preventDefault();
          return;
        }
        onClick?.(event);
      }}
    >
      {label}
    </Button>
  );
}

export function SheetActions({
  primary,
  secondary,
  tertiary,
  layout = "stack",
  safeArea = false,
}: SheetActionsProps) {
  if (!primary && !secondary && !tertiary) return null;

  const actions =
    layout === "steps"
      ? [renderAction("secondary", secondary), renderAction("primary", primary)]
      : [
          renderAction("primary", primary),
          renderAction("secondary", secondary),
          renderAction("tertiary", tertiary),
        ];

  return (
    <div
      data-component="SheetActions"
      data-layout={layout}
      data-safe-area={safeArea ? "" : undefined}
    >
      {actions}
    </div>
  );
}
