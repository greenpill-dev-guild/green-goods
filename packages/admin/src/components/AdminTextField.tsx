import { cn } from "@green-goods/shared";
import * as React from "react";
import { type ComponentType, useId, useRef, useState } from "react";

// ============================================================================
// Types
// ============================================================================

export interface AdminTextFieldProps {
  label: string;
  value?: string;
  defaultValue?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
  error?: string;
  helperText?: string;
  required?: boolean;
  disabled?: boolean;
  leadingIcon?: ComponentType<{ className?: string }>;
  trailingIcon?: ComponentType<{ className?: string }>;
  variant?: "filled" | "outlined";
  type?: string;
  name?: string;
  id?: string;
  placeholder?: string;
  className?: string;
  inputProps?: React.ComponentPropsWithoutRef<"input">;
}

// ============================================================================
// Component
// ============================================================================

/**
 * AdminTextField — M3 Text Field
 *
 * Implements Material Design 3 filled and outlined text field anatomy:
 * - Floating label that animates between resting (body-lg) and floating (body-sm)
 * - Active indicator line (filled) or outline ring (outlined) reflecting focus/error state
 * - Leading and trailing icon slots (24dp, on-surface-variant)
 * - Supporting text / error message below with aria-describedby linkage
 * - forwardRef compatible — wraps native <input> for react-hook-form register()
 *
 * Floating label is triggered by: focus OR value is non-empty OR defaultValue exists
 */
export const AdminTextField = React.forwardRef<HTMLInputElement, AdminTextFieldProps>(
  (
    {
      label,
      value,
      defaultValue,
      onChange,
      onBlur,
      error,
      helperText,
      required,
      disabled,
      leadingIcon: LeadingIcon,
      trailingIcon: TrailingIcon,
      variant = "filled",
      type = "text",
      name,
      id: idProp,
      placeholder,
      className,
      inputProps,
    },
    ref
  ) => {
    const autoId = useId();
    const inputId = idProp ?? autoId;
    const supportingId = `${inputId}-supporting`;

    const [focused, setFocused] = useState(false);

    // Internal ref to read uncontrolled input value for isFloating detection
    const internalRef = useRef<HTMLInputElement | null>(null);

    // Merge the forwarded ref and our internal ref via callback ref
    const mergeRef = (node: HTMLInputElement | null) => {
      internalRef.current = node;
      if (typeof ref === "function") {
        ref(node);
      } else if (ref) {
        (ref as React.MutableRefObject<HTMLInputElement | null>).current = node;
      }
    };

    // Determine if the label should be in floating position
    const hasValue =
      value !== undefined ? value.length > 0 : (internalRef.current?.value?.length ?? 0) > 0;

    const isFloating = focused || hasValue || Boolean(defaultValue);

    const hasError = Boolean(error);
    const supportingText = error ?? helperText;

    // -------------------------------------------------------------------------
    // Shared handlers
    // -------------------------------------------------------------------------

    const handleFocus = () => setFocused(true);

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      setFocused(false);
      onBlur?.(e);
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange?.(e);
      // Force re-evaluation of isFloating for uncontrolled usage
      // The ref update is synchronous so we just trigger a re-render via setState
      setFocused((prev) => prev);
    };

    // -------------------------------------------------------------------------
    // Shared input classes
    // -------------------------------------------------------------------------

    const inputBaseClasses = cn(
      // Layout — sits above the active indicator
      "peer w-full bg-transparent",
      // Typography
      "text-body-lg text-[rgb(var(--m3-on-surface))]",
      // Remove browser defaults
      "outline-none border-none focus:outline-none focus:border-none",
      // Caret color
      hasError ? "caret-[rgb(var(--m3-error))]" : "caret-[rgb(var(--m3-primary))]",
      // Placeholder — only visible when focused and empty
      "placeholder-[rgb(var(--m3-on-surface-variant)/0.6)]",
      !focused && "placeholder-transparent",
      // Disabled text
      disabled && "text-[rgb(var(--m3-on-surface)/0.38)] cursor-not-allowed"
    );

    // -------------------------------------------------------------------------
    // Filled variant
    // -------------------------------------------------------------------------

    if (variant === "filled") {
      return (
        <div
          data-component="AdminTextField"
          data-variant="filled"
          className={cn("flex flex-col", className)}
        >
          {/* Container */}
          <div
            className={cn(
              // Shape: extra-small-top only (top corners rounded, bottom flat)
              "rounded-t-[var(--m3-shape-xs)] rounded-b-none",
              // Height
              "min-h-14",
              // Background
              disabled
                ? "bg-[rgb(var(--m3-on-surface)/0.04)]"
                : "bg-[rgb(var(--m3-surface-container-highest))]",
              // State layer on container
              !disabled && "m3-state-layer [--state-layer-color:var(--m3-on-surface)]",
              // Layout: column so label sits above input
              "relative flex flex-col justify-end",
              // Horizontal padding accounts for optional icons
              LeadingIcon ? "pl-3 pr-4" : "px-4"
            )}
          >
            {/* Leading icon */}
            {LeadingIcon ? (
              <span
                aria-hidden="true"
                className={cn(
                  "absolute left-3 bottom-4",
                  "h-6 w-6 shrink-0",
                  hasError
                    ? "text-[rgb(var(--m3-error))]"
                    : "text-[rgb(var(--m3-on-surface-variant))]",
                  disabled && "text-[rgb(var(--m3-on-surface)/0.38)]"
                )}
              >
                <LeadingIcon className="h-full w-full" />
              </span>
            ) : null}

            {/* Floating label */}
            <label
              htmlFor={inputId}
              className={cn(
                "pointer-events-none absolute select-none",
                // Horizontal: respect leading icon
                LeadingIcon ? "left-12" : "left-4",
                // Vertical animation via transform
                "origin-top-left transition-all",
                "duration-[var(--spring-fast-duration)] ease-[var(--spring-fast-easing)]",
                // Resting state
                isFloating
                  ? [
                      // Floating: top-2, body-sm
                      "top-2 text-body-sm",
                      hasError
                        ? "text-[rgb(var(--m3-error))]"
                        : focused
                          ? "text-[rgb(var(--m3-primary))]"
                          : "text-[rgb(var(--m3-on-surface-variant))]",
                    ]
                  : [
                      // Resting: vertically centered, body-lg
                      "top-1/2 -translate-y-1/2 text-body-lg",
                      hasError
                        ? "text-[rgb(var(--m3-error))]"
                        : "text-[rgb(var(--m3-on-surface-variant))]",
                    ],
                disabled && "text-[rgb(var(--m3-on-surface)/0.38)]"
              )}
            >
              {label}
              {required ? "\u00A0*" : null}
            </label>

            {/* Input — padded top so it sits below the floating label */}
            <input
              {...inputProps}
              ref={mergeRef}
              id={inputId}
              name={name}
              type={type}
              value={value}
              defaultValue={defaultValue}
              disabled={disabled}
              required={required}
              placeholder={placeholder}
              aria-required={required}
              aria-invalid={hasError}
              aria-describedby={supportingText ? supportingId : undefined}
              onChange={handleChange}
              onFocus={handleFocus}
              onBlur={handleBlur}
              className={cn(
                inputBaseClasses,
                // Push input below the floating label space
                "pb-2 pt-6",
                // Indent for leading icon
                LeadingIcon && "pl-9",
                // Indent for trailing icon
                TrailingIcon && "pr-9"
              )}
            />

            {/* Trailing icon */}
            {TrailingIcon ? (
              <span
                aria-hidden="true"
                className={cn(
                  "absolute right-3 bottom-4",
                  "h-6 w-6 shrink-0",
                  hasError
                    ? "text-[rgb(var(--m3-error))]"
                    : "text-[rgb(var(--m3-on-surface-variant))]",
                  disabled && "text-[rgb(var(--m3-on-surface)/0.38)]"
                )}
              >
                <TrailingIcon className="h-full w-full" />
              </span>
            ) : null}
          </div>

          {/* Active indicator — a horizontal line below the container */}
          <div
            aria-hidden="true"
            className={cn(
              "w-full transition-all duration-[var(--spring-fast-duration)]",
              hasError
                ? "h-0.5 bg-[rgb(var(--m3-error))]"
                : focused
                  ? "h-0.5 bg-[rgb(var(--m3-primary))]"
                  : "h-px bg-[rgb(var(--m3-on-surface-variant))]",
              disabled && "bg-[rgb(var(--m3-on-surface)/0.38)] h-px"
            )}
          />

          {/* Supporting text */}
          {supportingText ? (
            <p
              id={supportingId}
              role={hasError ? "alert" : undefined}
              className={cn(
                "mt-1 px-4 text-body-sm",
                hasError
                  ? "text-[rgb(var(--m3-error))]"
                  : "text-[rgb(var(--m3-on-surface-variant))]",
                disabled && "text-[rgb(var(--m3-on-surface)/0.38)]"
              )}
            >
              {supportingText}
            </p>
          ) : null}
        </div>
      );
    }

    // -------------------------------------------------------------------------
    // Outlined variant
    // -------------------------------------------------------------------------

    return (
      <div
        data-component="AdminTextField"
        data-variant="outlined"
        className={cn("flex flex-col", className)}
      >
        {/* Container with outline ring */}
        <div
          className={cn(
            // Shape: all corners extra-small
            "rounded-[var(--m3-shape-xs)]",
            // Height
            "min-h-14",
            // Background
            "bg-transparent",
            // Layout
            "relative flex flex-col justify-end",
            // Horizontal padding
            LeadingIcon ? "pl-3 pr-4" : "px-4",
            // Outline ring
            hasError
              ? focused
                ? "ring-2 ring-inset ring-[rgb(var(--m3-error))]"
                : "ring-2 ring-inset ring-[rgb(var(--m3-error))]"
              : focused
                ? "ring-2 ring-inset ring-[rgb(var(--m3-primary))]"
                : "ring-1 ring-inset ring-[rgb(var(--m3-outline))]",
            disabled && "ring-1 ring-inset ring-[rgb(var(--m3-on-surface)/0.38)]"
          )}
        >
          {/* Leading icon */}
          {LeadingIcon ? (
            <span
              aria-hidden="true"
              className={cn(
                "absolute left-3 bottom-4",
                "h-6 w-6 shrink-0",
                hasError
                  ? "text-[rgb(var(--m3-error))]"
                  : "text-[rgb(var(--m3-on-surface-variant))]",
                disabled && "text-[rgb(var(--m3-on-surface)/0.38)]"
              )}
            >
              <LeadingIcon className="h-full w-full" />
            </span>
          ) : null}

          {/* Floating label */}
          <label
            htmlFor={inputId}
            className={cn(
              "pointer-events-none absolute select-none",
              LeadingIcon ? "left-12" : "left-4",
              "origin-top-left transition-all",
              "duration-[var(--spring-fast-duration)] ease-[var(--spring-fast-easing)]",
              isFloating
                ? [
                    // Floating: sits on the top outline edge
                    "top-0 -translate-y-1/2 text-body-sm",
                    // Small background notch to visually break the outline
                    "bg-[rgb(var(--m3-surface-container-lowest))] px-1",
                    hasError
                      ? "text-[rgb(var(--m3-error))]"
                      : focused
                        ? "text-[rgb(var(--m3-primary))]"
                        : "text-[rgb(var(--m3-on-surface-variant))]",
                  ]
                : [
                    "top-1/2 -translate-y-1/2 text-body-lg",
                    hasError
                      ? "text-[rgb(var(--m3-error))]"
                      : "text-[rgb(var(--m3-on-surface-variant))]",
                  ],
              disabled && "text-[rgb(var(--m3-on-surface)/0.38)]"
            )}
          >
            {label}
            {required ? "\u00A0*" : null}
          </label>

          {/* Input */}
          <input
            {...inputProps}
            ref={mergeRef}
            id={inputId}
            name={name}
            type={type}
            value={value}
            defaultValue={defaultValue}
            disabled={disabled}
            required={required}
            placeholder={placeholder}
            aria-required={required}
            aria-invalid={hasError}
            aria-describedby={supportingText ? supportingId : undefined}
            onChange={handleChange}
            onFocus={handleFocus}
            onBlur={handleBlur}
            className={cn(
              inputBaseClasses,
              "pb-2 pt-6",
              LeadingIcon && "pl-9",
              TrailingIcon && "pr-9"
            )}
          />

          {/* Trailing icon */}
          {TrailingIcon ? (
            <span
              aria-hidden="true"
              className={cn(
                "absolute right-3 bottom-4",
                "h-6 w-6 shrink-0",
                hasError
                  ? "text-[rgb(var(--m3-error))]"
                  : "text-[rgb(var(--m3-on-surface-variant))]",
                disabled && "text-[rgb(var(--m3-on-surface)/0.38)]"
              )}
            >
              <TrailingIcon className="h-full w-full" />
            </span>
          ) : null}
        </div>

        {/* Supporting text */}
        {supportingText ? (
          <p
            id={supportingId}
            role={hasError ? "alert" : undefined}
            className={cn(
              "mt-1 px-4 text-body-sm",
              hasError ? "text-[rgb(var(--m3-error))]" : "text-[rgb(var(--m3-on-surface-variant))]",
              disabled && "text-[rgb(var(--m3-on-surface)/0.38)]"
            )}
          >
            {supportingText}
          </p>
        ) : null}
      </div>
    );
  }
);

AdminTextField.displayName = "AdminTextField";
