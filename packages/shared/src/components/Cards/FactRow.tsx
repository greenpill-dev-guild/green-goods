/**
 * FactList and FactRow — the facts about one thing, the same on the installed app and the
 * cockpit (DL-109): a label beside its value, in divided rows. A review before a send, a
 * record's details and a settings list all draw them.
 *
 * A list's labels share one column, as wide as its longest label up to 40%, in the quieter
 * ink, so the values line up and read first (Interface Principle 11); a value wraps rather
 * than being cut. Each surface sets the
 * density through its type roles: the label on `type-label-sm` and the value on `type-body`
 * (14px and 16px in the app, 12px and 14px in the cockpit), so the components take no
 * density prop.
 *
 * A row's one action, when it has one, takes the right slot: a setting's control, a
 * review's Edit, a link out. A row with no value is a setting: its label names the control
 * in the right slot and reads as a field title, never quieter than the fields beside it
 * (Rule 15). Styles live in shared `theme.css` as the `.gg-fact-*` rules.
 *
 * @module components/Cards/FactRow
 */
import * as React from "react";
import { cn } from "../../utils/styles/cn";

export interface FactListProps extends React.HTMLAttributes<HTMLDListElement> {
  /**
   * `card`: the list is a card of its own, on the card surface, with its rules running to
   * the card's edges. `inset`: the rows sit in a frame that already exists (a card, a dialog
   * section, a status box) and take no card of their own.
   */
  frame?: "card" | "inset";
}

/** The rows of one thing's facts, as a description list. */
export const FactList = React.forwardRef<HTMLDListElement, FactListProps>(function FactList(
  { frame = "card", className, ...rest },
  ref
) {
  return (
    <dl
      data-component="FactList"
      {...rest}
      ref={ref}
      data-frame={frame}
      className={cn("gg-fact-list", frame === "card" && "gg-card", className)}
    />
  );
});

FactList.displayName = "FactList";

export interface FactRowProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "children" | "title"> {
  /** What the value is. */
  label: React.ReactNode;
  /** The value. A row without one is a setting: its label names the control in `action`. */
  value?: React.ReactNode;
  /** The full value on hover, where the value shows a short form (a name for an address). */
  valueTitle?: string;
  /** A quiet line under the label: a setting's hint or its state. */
  description?: React.ReactNode;
  /** A 16px glyph before the label, where a screen marks each fact (the app's promise pages). */
  icon?: React.ReactNode;
  /** The row's one action, in the right slot: a setting's control, an Edit, a link out. */
  action?: React.ReactNode;
  /** The label's id, so a control in `action` can name itself with `aria-labelledby`. */
  labelId?: string;
}

/** One fact: a label beside its value. Rows sit in a `FactList`. */
export const FactRow = React.forwardRef<HTMLDivElement, FactRowProps>(function FactRow(
  { label, value, valueTitle, description, icon, action, labelId, className, ...rest },
  ref
) {
  const setting = value === undefined || value === null;
  return (
    <div
      data-component="FactRow"
      {...rest}
      ref={ref}
      data-kind={setting ? "setting" : "fact"}
      data-has-action={action ? "true" : undefined}
      className={cn("gg-fact-row", className)}
    >
      <dt className="gg-fact-term" data-has-icon={icon ? "true" : undefined}>
        <span
          id={labelId}
          className={cn("gg-fact-label", setting ? "gg-field-label" : "type-label-sm")}
        >
          {icon ? (
            <span aria-hidden="true" className="gg-fact-icon">
              {icon}
            </span>
          ) : null}
          {label}
        </span>
        {description ? <span className="gg-fact-description type-meta">{description}</span> : null}
      </dt>
      {setting ? null : (
        <dd className="gg-fact-value type-body font-medium" title={valueTitle}>
          {value}
        </dd>
      )}
      {action ? <dd className="gg-fact-action">{action}</dd> : null}
    </div>
  );
});

FactRow.displayName = "FactRow";
