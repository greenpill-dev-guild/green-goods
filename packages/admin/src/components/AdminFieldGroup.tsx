import { cn } from "@green-goods/shared/utils/styles/cn";
import { useId } from "react";

export interface AdminFieldGroupProps {
  /** Group label — rendered as the fieldset legend (sentence case; DL-012 scope). */
  label: string;
  /** Supporting copy, on the message line under the content; an error replaces it. */
  hint?: string;
  /** Error message — recolors the legend and takes the message line, matching the field family. */
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
 * Group-shaped member of the admin field family (DL-011): the family's label,
 * content and message anatomy for controls that are not a single text
 * control — checkbox grids, selectable-card sets, repeating-row editors,
 * upload wells. The label is the shared field title above the content and
 * the hint or error sits on the shared message line under it, reserved like
 * a field's (`gg-field-message`), so a group never reads different from the
 * AdminTextField beside it and an error never moves the form.
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
  const messageId = `${groupId}-message`;
  const Root = as;
  const message = error ?? hint;
  // Margins, not a flex gap: a fieldset's legend is not one of its flex items.
  const labelClasses = cn("gg-field-label mb-1", error && "[color:rgb(var(--m3-error))]");

  const labelNode = (
    <>
      {label}
      {required ? <span aria-hidden="true">{"\u00a0*"}</span> : null}
    </>
  );

  return (
    <Root
      id={groupId}
      data-component="AdminFieldGroup"
      className={className}
      {...(as === "div" ? { role: "group", "aria-labelledby": labelId } : {})}
      aria-describedby={message ? messageId : undefined}
    >
      {as === "fieldset" ? (
        <legend className={labelClasses}>{labelNode}</legend>
      ) : (
        <p id={labelId} className={labelClasses}>
          {labelNode}
        </p>
      )}
      <div className={contentClassName}>{children}</div>
      <p
        id={messageId}
        role={error ? "alert" : undefined}
        className={cn(
          "gg-field-help gg-field-message mt-1",
          error ? "[color:rgb(var(--m3-error))]" : "text-text-sub"
        )}
      >
        {message}
      </p>
    </Root>
  );
}
