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
 * A `note` is one short line about the actions (what a send will ask, why one
 * is held) or a send's progress: above them below 640px, in `steps` too, and at
 * the start of the row from 640px. A
 * sheet whose actions are ways on with no main one, such as an inspector's
 * edits, passes several `secondary` actions, kept in reading order.
 *
 * Layout lives in shared `utilities.css` as `[data-component="SheetActions"]`
 * attribute rules, beside the rules for the surfaces that host the bar:
 * DialogShell and ConfirmDialog set its padding from their own selectors, and
 * child selectors size the buttons inside it.
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
  /** The outlined action, Cancel included; several where none is the main one. */
  secondary?: SheetAction | readonly SheetAction[];
  /** A rare third choice, rendered as a text button. */
  tertiary?: SheetAction;
  /**
   * One short line about the actions, beside them from 640px and above them
   * below it. Pass null while a note that comes and goes has nothing to say.
   */
  note?: ReactNode;
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

function renderAction(role: ActionRole, action: SheetAction | undefined, key: string = role) {
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
      data-piece-control
      {...buttonProps}
      // A slot whose action changes kind is a new button, never the pressed one
      // re-typed: a press that swaps Try Again for a form's submit must not
      // submit that form as it lands.
      key={`${key}:${type ?? "button"}:${buttonProps.form ?? ""}`}
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

/** Whether the bar has anything to draw; a host shows its footer only then. */
export function hasSheetActions(props: SheetActionsProps | undefined): props is SheetActionsProps {
  if (!props) return false;
  const { primary, secondary, tertiary, note } = props;
  const outlined = secondary !== undefined && ("label" in secondary || secondary.length > 0);
  return Boolean(primary || outlined || tertiary || note);
}

export function SheetActions({
  primary,
  secondary,
  tertiary,
  note,
  layout = "stack",
  safeArea = false,
}: SheetActionsProps) {
  if (!hasSheetActions({ primary, secondary, tertiary, note })) return null;
  const secondaries: readonly SheetAction[] =
    secondary === undefined ? [] : "label" in secondary ? [secondary] : secondary;

  const outlined = secondaries.map((action, index) =>
    renderAction("secondary", action, `secondary-${index}`)
  );
  const actions =
    layout === "steps"
      ? [...outlined, renderAction("primary", primary)]
      : [renderAction("primary", primary), ...outlined, renderAction("tertiary", tertiary)];

  return (
    <div
      data-component="SheetActions"
      data-layout={layout}
      data-safe-area={safeArea ? "" : undefined}
      data-note={note !== undefined ? "" : undefined}
    >
      {note !== undefined ? (
        // A div, since a note may be a progress bar as well as a line of text. It
        // is the bar's one live region: the line changes as a send moves, or as a
        // choice above it does, so a note brings no live region of its own. It
        // takes no role, so an empty one never reads as a status on the page. A
        // caller whose note comes and goes passes null while it has none, which
        // keeps the region mounted (and hidden) so the line is announced when it
        // appears.
        <div data-slot="note" aria-live="polite" className="type-meta text-text-soft">
          {note}
        </div>
      ) : null}
      {actions}
    </div>
  );
}
