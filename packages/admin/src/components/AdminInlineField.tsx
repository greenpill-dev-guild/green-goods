import { cn } from "@green-goods/shared/utils/styles/cn";
import * as React from "react";
import { useId } from "react";

export interface AdminInlineFieldProps {
  /** Visible field label, rendered above the input (the shared field title). */
  label: string;
  value: string;
  onChange: (value: string) => void;
  /** Fired on Enter while the input is focused. */
  onSubmit?: () => void;
  placeholder?: string;
  error?: string;
  hint?: string;
  disabled?: boolean;
  required?: boolean;
  id?: string;
  name?: string;
  type?: string;
  inputMode?: React.ComponentPropsWithoutRef<"input">["inputMode"];
  /** The trailing submit control — typically a shared `<Button size="sm">` (32dp). */
  action: React.ReactNode;
  className?: string;
  inputProps?: React.ComponentPropsWithoutRef<"input">;
}

/**
 * AdminInlineField — compact single-value entry paired with an inline action.
 *
 * A 32dp field (DL-011 compact metric) for "enter one short value and submit"
 * rows (register a hypercert / action id, add a strategy address). It takes
 * the {@link AdminTextField} anatomy on a smaller box: the label above, then
 * the input on the same 32dp axis as its paired `Button size="sm"`,
 * reading as one group, then the message line.
 *
 * Label and supporting text are the family's: the shared field title and
 * message line (`gg-field-label`, `gg-field-message`), the same error color
 * (`--m3-error`) and `role="alert"`, so an inline field's error never looks
 * like a different design system. The message line reserves the cockpit's
 * message lines, so a validation message never nudges the button row.
 */
export function AdminInlineField({
  label,
  value,
  onChange,
  onSubmit,
  placeholder,
  error,
  hint,
  disabled,
  required,
  id: idProp,
  name,
  type = "text",
  inputMode,
  action,
  className,
  inputProps,
}: AdminInlineFieldProps) {
  const autoId = useId();
  const inputId = idProp ?? autoId;
  const hasError = Boolean(error);
  const supportingText = error ?? hint;

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <label
        htmlFor={inputId}
        className={cn(
          "gg-field-label",
          hasError && "[color:rgb(var(--m3-error))]",
          disabled && "[color:rgb(var(--m3-on-surface)/0.38)]"
        )}
      >
        {label}
        {/* Visual-only marker — aria-required announces the state. */}
        {required ? <span aria-hidden="true">{"\u00a0*"}</span> : null}
      </label>
      <div className="flex items-center gap-2" data-component="AdminInlineField">
        <input
          {...inputProps}
          id={inputId}
          name={name}
          type={type}
          inputMode={inputMode}
          value={value}
          disabled={disabled}
          required={required}
          placeholder={placeholder}
          aria-invalid={hasError}
          aria-required={required}
          aria-describedby={supportingText ? `${inputId}-helper-text` : undefined}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && onSubmit && !disabled) {
              e.preventDefault();
              onSubmit();
            }
            inputProps?.onKeyDown?.(e);
          }}
          className={cn(
            // 32dp compact box, matching the 32px button so the row aligns
            // (DL-011 compact metric).
            "h-8 min-w-0 flex-1 rounded-[var(--m3-shape-sm)] bg-transparent px-3",
            "type-body [color:rgb(var(--m3-on-surface))] outline-none",
            "ring-1 ring-inset transition-[box-shadow] duration-[var(--spring-spatial-fast-duration)] ease-[var(--spring-spatial-fast-easing)]",
            "placeholder-[rgb(var(--m3-on-surface-variant)/0.6)]",
            hasError
              ? "ring-[rgb(var(--m3-error))] focus:ring-2 focus:ring-[rgb(var(--m3-error))]"
              : "ring-[rgb(var(--m3-outline))] focus:ring-2 focus:ring-[rgb(var(--tone-focus-ring,var(--m3-primary)))]",
            disabled && "cursor-not-allowed [color:rgb(var(--m3-on-surface)/0.38)]"
          )}
        />
        {action}
      </div>
      {/* The family's message line: reserved, m3 roles, alert on error. */}
      <p
        id={`${inputId}-helper-text`}
        role={hasError ? "alert" : undefined}
        className={cn(
          "gg-field-help gg-field-message",
          hasError ? "[color:rgb(var(--m3-error))]" : "[color:rgb(var(--m3-on-surface-variant))]",
          disabled && "[color:rgb(var(--m3-on-surface)/0.38)]"
        )}
      >
        {supportingText}
      </p>
    </div>
  );
}

AdminInlineField.displayName = "AdminInlineField";
