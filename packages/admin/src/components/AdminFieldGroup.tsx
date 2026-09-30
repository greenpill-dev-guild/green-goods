import { cn } from "@green-goods/shared/utils/styles/cn";
import { useId } from "react";

export interface AdminFieldGroupProps {
  /** Group label — rendered as the fieldset legend (sentence case; DL-012 scope). */
  label: string;
  /** Supporting copy under the label. */
  hint?: string;
  /** Error message — recolors the legend and renders an alert row, matching the field family. */
  error?: string;
  required?: boolean;
  /**
   * Grouping element. Fieldset+legend is the accessible default for control
   * groups (checkbox grids, shot lists); "div" labels composite widgets that
   * manage their own semantics (file upload).
   */
  as?: "fieldset" | "div";
  id?: string;
  className?: string;
  /** Class for the content slot wrapper (grid/stack layout lives here, not on the fieldset). */
  contentClassName?: string;
  children: React.ReactNode;
}

/**
 * Group-shaped member of the admin field family (DL-011): label + hint +
 * content + error anatomy for controls that are not a single text control —
 * checkbox grids, selectable-card sets, repeating-row editors, upload wells.
 * Shares the family's type roles and `--m3-error` state so a group never
 * reads different from the AdminTextField beside it.
 */
export function AdminFieldGroup({
  label,
  hint,
  error,
  required,
  as = "fieldset",
  id,
  className,
  contentClassName,
  children,
}: AdminFieldGroupProps) {
  const autoId = useId();
  const groupId = id ?? autoId;
  const labelId = `${groupId}-label`;
  const errorId = `${groupId}-error`;
  const Root = as;
  const labelClasses = cn(
    "label-md font-medium",
    error ? "[color:rgb(var(--m3-error))]" : "text-text-strong"
  );

  const labelNode = (
    <>
      {label}
      {required ? <span aria-hidden="true">{" *"}</span> : null}
    </>
  );

  return (
    <Root
      id={groupId}
      data-component="AdminFieldGroup"
      className={cn("space-y-2", className)}
      {...(as === "div" ? { role: "group", "aria-labelledby": labelId } : {})}
      aria-describedby={error ? errorId : undefined}
    >
      {as === "fieldset" ? (
        <legend className={labelClasses}>{labelNode}</legend>
      ) : (
        <p id={labelId} className={labelClasses}>
          {labelNode}
        </p>
      )}
      {hint ? <p className="body-sm text-text-sub">{hint}</p> : null}
      <div className={contentClassName}>{children}</div>
      {error ? (
        <p id={errorId} role="alert" className="body-sm [color:rgb(var(--m3-error))]">
          {error}
        </p>
      ) : null}
    </Root>
  );
}
