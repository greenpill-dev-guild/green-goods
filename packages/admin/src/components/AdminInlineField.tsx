import { cn, FormField } from "@green-goods/shared";
import * as React from "react";
import { useId } from "react";

export interface AdminInlineFieldProps {
  /** Visible field label, rendered above the input (M3 label, not a floating label). */
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
  /** The trailing submit control — typically an `<AdminButton size="md">` (40dp). */
  action: React.ReactNode;
  className?: string;
  inputProps?: React.ComponentPropsWithoutRef<"input">;
}

/**
 * AdminInlineField — compact single-value entry paired with an inline action.
 *
 * A 40dp field for "enter one short value and submit" rows (register a
 * hypercert / action id, add a strategy address). It is deliberately NOT the
 * 56dp floating-label {@link AdminTextField}: the external label (M3 label via
 * the shared {@link FormField}) keeps the control compact so the input aligns on
 * the same 40dp axis as its paired `AdminButton`, reading as one group. Error
 * text sits below both controls in FormField's reserved slot, so a validation
 * message never nudges the button.
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

  return (
    <FormField
      label={label}
      htmlFor={inputId}
      required={required}
      error={error}
      hint={hint}
      className={className}
    >
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
          aria-describedby={error || hint ? `${inputId}-helper-text` : undefined}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && onSubmit && !disabled) {
              e.preventDefault();
              onSubmit();
            }
            inputProps?.onKeyDown?.(e);
          }}
          className={cn(
            // 40dp compact box, matching AdminButton md so the row aligns.
            "h-10 min-w-0 flex-1 rounded-[var(--m3-shape-sm)] bg-transparent px-3",
            "text-body-md text-[rgb(var(--m3-on-surface))] outline-none",
            "ring-1 ring-inset transition-[box-shadow] duration-[var(--spring-spatial-fast-duration)] ease-[var(--spring-spatial-fast-easing)]",
            "placeholder-[rgb(var(--m3-on-surface-variant)/0.6)]",
            hasError
              ? "ring-[rgb(var(--m3-error))] focus:ring-2 focus:ring-[rgb(var(--m3-error))]"
              : "ring-[rgb(var(--m3-outline))] focus:ring-2 focus:ring-[rgb(var(--tone-on-surface-accent,var(--m3-primary)))]",
            disabled && "cursor-not-allowed text-[rgb(var(--m3-on-surface)/0.38)]"
          )}
        />
        {action}
      </div>
    </FormField>
  );
}

AdminInlineField.displayName = "AdminInlineField";
