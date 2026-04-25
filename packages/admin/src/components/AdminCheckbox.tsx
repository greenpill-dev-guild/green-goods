import * as React from "react";
import { cn } from "@green-goods/shared";

// ============================================================================
// Types
// ============================================================================

export interface AdminCheckboxProps {
  checked?: boolean;
  defaultChecked?: boolean;
  indeterminate?: boolean;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  label?: string;
  description?: string;
  error?: boolean;
  disabled?: boolean;
  name?: string;
  id?: string;
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

/**
 * AdminCheckbox — M3 Checkbox
 *
 * Implements Material Design 3 checkbox anatomy:
 * - Container: 18dp (h-[18px] w-[18px]), 2dp radius (rounded-[2px])
 * - Touch target: 40dp circle around checkbox (h-10 w-10 centered)
 * - Unselected: transparent fill, 2dp border on-surface-variant
 * - Selected: primary fill, white SVG checkmark via background-image
 * - Indeterminate: primary fill with horizontal dash
 * - Error unselected: error color border
 * - Error selected: error color fill
 * - Disabled unselected: on-surface/38 border
 * - Disabled selected: on-surface/38 fill
 *
 * forwardRef compatible — wraps native <input type="checkbox"> for react-hook-form register().
 */
export const AdminCheckbox = React.forwardRef<HTMLInputElement, AdminCheckboxProps>(
  (
    {
      checked,
      defaultChecked,
      indeterminate = false,
      onChange,
      label,
      description,
      error = false,
      disabled = false,
      name,
      id: idProp,
      className,
    },
    ref
  ) => {
    const autoId = React.useId();
    const inputId = idProp ?? autoId;
    const descriptionId = description ? `${inputId}-description` : undefined;
    const inputRef = React.useRef<HTMLInputElement | null>(null);

    React.useEffect(() => {
      if (inputRef.current) {
        inputRef.current.indeterminate = indeterminate;
      }
    }, [indeterminate]);

    const setInputRef = (node: HTMLInputElement | null) => {
      inputRef.current = node;
      if (typeof ref === "function") {
        ref(node);
      } else if (ref) {
        (ref as React.MutableRefObject<HTMLInputElement | null>).current = node;
      }
    };

    return (
      <label
        data-component="AdminCheckbox"
        htmlFor={inputId}
        className={cn(
          "inline-flex items-start gap-3",
          disabled ? "cursor-not-allowed opacity-[0.38]" : "cursor-pointer",
          className
        )}
      >
        {/* Touch target wrapper (40dp circle) */}
        <span
          className={cn(
            // Centered 40dp touch target
            "relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
            // State layer (hover ring) — skip when disabled
            !disabled && [
              "transition-colors duration-[var(--spring-fast-duration)]",
              error
                ? "hover:bg-[rgb(var(--m3-error)/0.08)]"
                : "hover:bg-[rgb(var(--m3-on-surface)/0.08)]",
            ]
          )}
        >
          {/* Native checkbox — appearance-none, styled via CSS */}
          <input
            ref={setInputRef}
            type="checkbox"
            id={inputId}
            name={name}
            checked={checked}
            defaultChecked={defaultChecked}
            disabled={disabled}
            onChange={onChange}
            aria-checked={indeterminate ? "mixed" : undefined}
            aria-describedby={descriptionId}
            aria-invalid={error || undefined}
            className={cn(
              // Remove native appearance
              "appearance-none",
              // Size: 18dp container, 2dp radius
              "h-[18px] w-[18px] shrink-0 rounded-[2px]",
              // Cursor
              "cursor-pointer disabled:cursor-not-allowed",
              // Transition
              "transition-colors duration-[var(--spring-fast-duration)] ease-[var(--spring-fast-easing)]",
              // Unselected states
              "border-2",
              error
                ? "border-[rgb(var(--m3-error))] checked:border-0 checked:bg-[rgb(var(--m3-error))]"
                : "border-[rgb(var(--m3-on-surface-variant))] checked:border-0 checked:bg-[rgb(var(--m3-primary))]",
              // Disabled unselected / selected
              "disabled:border-[rgb(var(--m3-on-surface)/0.38)] disabled:checked:border-0 disabled:checked:bg-[rgb(var(--m3-on-surface)/0.38)]",
              indeterminate &&
                (error
                  ? "border-0 bg-[rgb(var(--m3-error))]"
                  : "border-0 bg-[rgb(var(--m3-primary))]"),
              indeterminate && disabled && "bg-[rgb(var(--m3-on-surface)/0.38)]",
              // Checkmark via SVG background-image (white stroke on colored fill)
              "checked:bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22white%22%20stroke-width%3D%223%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22M20%206L9%2017l-5-5%22%2F%3E%3C%2Fsvg%3E')] checked:bg-center checked:bg-no-repeat checked:bg-[length:14px]"
            )}
          />
          {indeterminate ? (
            <span
              aria-hidden="true"
              className={cn(
                "pointer-events-none absolute h-0.5 w-2.5 rounded-[var(--m3-shape-full)]",
                disabled ? "bg-[rgb(var(--m3-surface))]" : "bg-[rgb(var(--m3-on-primary))]"
              )}
            />
          ) : null}
        </span>

        {/* Label + description — only rendered when label text is provided */}
        {label ? (
          <span className="flex flex-col pt-2.5">
            <span className="text-body-lg text-[rgb(var(--m3-on-surface))]">{label}</span>
            {description ? (
              <span
                id={descriptionId}
                className="mt-0.5 text-body-sm text-[rgb(var(--m3-on-surface-variant))]"
              >
                {description}
              </span>
            ) : null}
          </span>
        ) : null}
      </label>
    );
  }
);

AdminCheckbox.displayName = "AdminCheckbox";
