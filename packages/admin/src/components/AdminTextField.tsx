import { RiArrowDownSLine } from "@remixicon/react";
import { cn } from "@green-goods/shared/utils/styles/cn";
import * as React from "react";
import { type ComponentType, useCallback, useId, useRef, useState } from "react";

// ============================================================================
// Types
// ============================================================================

type AdminTextFieldControl = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

interface AdminTextFieldCommonProps {
  label: string;
  value?: string;
  defaultValue?: string;
  error?: string;
  helperText?: string;
  required?: boolean;
  disabled?: boolean;
  leadingIcon?: ComponentType<{ className?: string }>;
  trailingIcon?: ComponentType<{ className?: string }>;
  variant?: "filled" | "outlined";
  name?: string;
  id?: string;
  placeholder?: string;
  className?: string;
}

export interface AdminTextFieldProps extends AdminTextFieldCommonProps {
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
  type?: string;
  inputProps?: React.ComponentPropsWithoutRef<"input">;
}

export interface AdminTextAreaProps extends AdminTextFieldCommonProps {
  onChange?: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onBlur?: (e: React.FocusEvent<HTMLTextAreaElement>) => void;
  /** Visible text rows before scrolling; the field is vertically resizable. */
  rows?: number;
  textareaProps?: React.ComponentPropsWithoutRef<"textarea"> & {
    [key: `data-${string}`]: string | undefined;
  };
}

export interface AdminSelectProps extends AdminTextFieldCommonProps {
  onChange?: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  onBlur?: (e: React.FocusEvent<HTMLSelectElement>) => void;
  /** The `<option>` elements. An empty-value option acts as the placeholder row. */
  children: React.ReactNode;
  selectProps?: React.ComponentPropsWithoutRef<"select"> & {
    [key: `data-${string}`]: string | undefined;
  };
}

// Internal shape the base renders from. The public wrappers narrow the
// handler/ref types back to their concrete control element.
interface AdminTextFieldBaseProps extends AdminTextFieldCommonProps {
  multiline?: boolean;
  select?: boolean;
  rows?: number;
  type?: string;
  onChange?: (e: React.ChangeEvent<AdminTextFieldControl>) => void;
  onBlur?: (e: React.FocusEvent<AdminTextFieldControl>) => void;
  controlProps?: Record<string, unknown>;
}

// ============================================================================
// Base
// ============================================================================

/**
 * Shared M3 text-field anatomy behind {@link AdminTextField},
 * {@link AdminTextArea}, and {@link AdminSelect}, on the 44dp compact cockpit
 * metric (DL-011):
 * - Floating label that animates between resting (body-md) and floating (body-sm)
 * - Active indicator line (filled) or outline ring (outlined) reflecting focus/error state
 * - Leading and trailing icon slots (20dp, on-surface-variant)
 * - Supporting text / error message below with aria-describedby linkage
 * - forwardRef compatible — wraps the native control for react-hook-form register()
 *
 * Floating label is triggered by: focus OR value is non-empty OR defaultValue exists
 */
const AdminTextFieldBase = React.forwardRef<AdminTextFieldControl, AdminTextFieldBaseProps>(
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
      multiline = false,
      select = false,
      rows = 3,
      type = "text",
      name,
      id: idProp,
      placeholder,
      className,
      controlProps,
    },
    ref
  ) => {
    const autoId = useId();
    const inputId = idProp ?? autoId;
    const supportingId = `${inputId}-supporting`;

    const [focused, setFocused] = useState(false);
    const [uncontrolledHasValue, setUncontrolledHasValue] = useState(Boolean(defaultValue));

    // Internal ref to read uncontrolled control value for isFloating detection
    const internalRef = useRef<AdminTextFieldControl | null>(null);

    // Merge the forwarded ref and our internal ref via callback ref. React Hook
    // Form restores uncontrolled values in its ref callback, so read the DOM
    // value after forwarding and update the label state before the next paint.
    const mergeRef = useCallback(
      (node: AdminTextFieldControl | null) => {
        internalRef.current = node;
        if (typeof ref === "function") {
          ref(node);
        } else if (ref) {
          (ref as React.MutableRefObject<AdminTextFieldControl | null>).current = node;
        }

        if (node && value === undefined) {
          const nextHasValue = node.value.length > 0;
          setUncontrolledHasValue((current) => (current === nextHasValue ? current : nextHasValue));
        }
      },
      [ref, value]
    );

    // Determine if the label should be in floating position
    const hasValue = value !== undefined ? value.length > 0 : uncontrolledHasValue;

    // A native <select> always displays its selected option's text (the
    // empty-value option acts as the placeholder row), so a resting centered
    // label would overlap it — the select label floats permanently, matching
    // the M3 exposed-dropdown treatment.
    const isFloating = select || focused || hasValue || Boolean(defaultValue);

    const hasError = Boolean(error);
    const supportingText = error ?? helperText;

    // -------------------------------------------------------------------------
    // Shared handlers
    // -------------------------------------------------------------------------

    const handleFocus = () => setFocused(true);

    const handleBlur = (e: React.FocusEvent<AdminTextFieldControl>) => {
      setFocused(false);
      onBlur?.(e);
    };

    const handleChange = (e: React.ChangeEvent<AdminTextFieldControl>) => {
      setUncontrolledHasValue(e.currentTarget.value.length > 0);
      onChange?.(e);
    };

    // -------------------------------------------------------------------------
    // Control element (input or textarea), shared by both variants
    // -------------------------------------------------------------------------

    const controlClasses = cn(
      // Layout — sits above the active indicator
      "peer w-full bg-transparent",
      // Typography — 14px, the cockpit workhorse size (DL-011 compact metric).
      // Color uses the [color:…] form so tailwind-merge can't classify it as a
      // font-size and drop text-body-md (the AdminSortSelect trap).
      "text-body-md [color:rgb(var(--m3-on-surface))]",
      // Remove browser defaults
      "outline-none border-none focus:outline-none focus:border-none",
      // Caret color
      hasError
        ? "caret-[rgb(var(--m3-error))]"
        : "caret-[rgb(var(--tone-on-surface-accent,var(--m3-primary)))]",
      // Placeholder — only visible when focused and empty
      "placeholder-[rgb(var(--m3-on-surface-variant)/0.6)]",
      !focused && "placeholder-transparent",
      // Disabled text
      disabled && "[color:rgb(var(--m3-on-surface)/0.38)] cursor-not-allowed",
      // Push the control below the floating label space
      "pb-1.5 pt-5",
      multiline && "resize-y",
      // Selects drop the native chrome; the chevron renders in the trailing
      // icon slot and clicks fall through it to the control.
      select && "appearance-none cursor-pointer disabled:cursor-not-allowed",
      LeadingIcon && "pl-9",
      TrailingIcon && "pr-9"
    );

    const sharedControlProps = {
      id: inputId,
      name,
      value,
      defaultValue,
      disabled,
      required,
      // `placeholder` is not a select attribute — the empty-value option row
      // plays that role there.
      placeholder: select ? undefined : placeholder,
      "aria-required": required,
      // Merged, not clobbered: a caller may mark the field against a
      // group-level error (AllocationEditor's sum) through controlProps,
      // and both describedby ids stay attached.
      "aria-invalid":
        hasError || controlProps?.["aria-invalid"] === true
          ? true
          : ((controlProps?.["aria-invalid"] as boolean | undefined) ?? undefined),
      "aria-describedby":
        [supportingText ? supportingId : null, controlProps?.["aria-describedby"] as string]
          .filter(Boolean)
          .join(" ") || undefined,
      onChange: handleChange,
      onFocus: handleFocus,
      onBlur: handleBlur,
      className: controlClasses,
    };

    const control = select ? (
      <select {...controlProps} {...sharedControlProps} ref={mergeRef} />
    ) : multiline ? (
      <textarea {...controlProps} {...sharedControlProps} ref={mergeRef} rows={rows} />
    ) : (
      <input {...controlProps} {...sharedControlProps} ref={mergeRef} type={type} />
    );

    const iconClasses = (position: "left" | "right") =>
      cn(
        position === "left" ? "absolute left-3 bottom-3" : "absolute right-3 bottom-3",
        // Decorative only — clicks fall through (a select's chevron must not
        // swallow the tap that opens it).
        "pointer-events-none h-5 w-5 shrink-0",
        hasError ? "text-[rgb(var(--m3-error))]" : "text-[rgb(var(--m3-on-surface-variant))]",
        disabled && "text-[rgb(var(--m3-on-surface)/0.38)]"
      );

    const floatingLabel = (floatedClasses: string[]) => (
      <label
        htmlFor={inputId}
        className={cn(
          "pointer-events-none absolute select-none",
          // Horizontal: respect leading icon
          LeadingIcon ? "left-12" : "left-4",
          // Vertical animation via transform
          "origin-top-left transition-all",
          "duration-[var(--spring-spatial-fast-duration)] ease-[var(--spring-spatial-fast-easing)]",
          isFloating
            ? floatedClasses
            : [
                // Resting: vertically centered, body-md (compact metric)
                "top-1/2 -translate-y-1/2 text-body-md",
                hasError
                  ? "text-[rgb(var(--m3-error))]"
                  : "text-[rgb(var(--m3-on-surface-variant))]",
              ],
          disabled && "text-[rgb(var(--m3-on-surface)/0.38)]"
        )}
      >
        {label}
        {/* Visual-only marker: aria-required already announces the state, and
            hiding it keeps the accessible name equal to the label text. */}
        {required ? <span aria-hidden="true">{" *"}</span> : null}
      </label>
    );

    const supporting = supportingText ? (
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
    ) : null;

    // -------------------------------------------------------------------------
    // Filled variant
    // -------------------------------------------------------------------------

    if (variant === "filled") {
      return (
        <div
          data-component={select ? "AdminSelect" : "AdminTextField"}
          data-variant="filled"
          className={cn("flex flex-col", className)}
        >
          {/* Container */}
          <div
            className={cn(
              // Shape: small-top only (top corners rounded, bottom flat). 8px
              // (--m3-shape-sm, the chip/sm tier) is a deliberate step up from the
              // 4px M3 outlined-field xs, which read as too square. NOTE this does
              // not match the sibling cards (chooser 16px, review 20px, AdminCard
              // 12px) — it's the field's own tier, applied across admin fields.
              "rounded-t-[var(--m3-shape-sm)] rounded-b-none",
              // Height
              "min-h-11",
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
            {LeadingIcon ? (
              <span aria-hidden="true" className={iconClasses("left")}>
                <LeadingIcon className="h-full w-full" />
              </span>
            ) : null}

            {floatingLabel([
              // Floating: top-2, body-sm
              "top-2 text-body-sm",
              hasError
                ? "text-[rgb(var(--m3-error))]"
                : focused
                  ? "text-[rgb(var(--tone-on-surface-accent,var(--m3-primary)))]"
                  : "text-[rgb(var(--m3-on-surface-variant))]",
            ])}

            {control}

            {TrailingIcon ? (
              <span aria-hidden="true" className={iconClasses("right")}>
                <TrailingIcon className="h-full w-full" />
              </span>
            ) : null}
          </div>

          {/* Active indicator — a horizontal line below the container */}
          <div
            aria-hidden="true"
            className={cn(
              "w-full transition-all duration-[var(--spring-spatial-fast-duration)]",
              hasError
                ? "h-0.5 bg-[rgb(var(--m3-error))]"
                : focused
                  ? "h-0.5 bg-[rgb(var(--tone-focus-ring,var(--m3-primary)))]"
                  : "h-px bg-[rgb(var(--m3-on-surface-variant))]",
              disabled && "bg-[rgb(var(--m3-on-surface)/0.38)] h-px"
            )}
          />

          {supporting}
        </div>
      );
    }

    // -------------------------------------------------------------------------
    // Outlined variant
    // -------------------------------------------------------------------------

    return (
      <div
        data-component={select ? "AdminSelect" : "AdminTextField"}
        data-variant="outlined"
        className={cn("flex flex-col pt-2", className)}
      >
        {/* Container with outline ring */}
        <div
          className={cn(
            // Shape: all corners small (8px, --m3-shape-sm, the chip/sm tier) — a
            // deliberate step up from the 4px M3 xs, which read as too square.
            // (Field's own tier; not matched to the sibling cards at 12-20px.)
            "rounded-[var(--m3-shape-sm)]",
            // Height
            "min-h-11",
            // Background
            "bg-transparent",
            // Layout
            "relative flex flex-col justify-end",
            // Horizontal padding
            LeadingIcon ? "pl-3 pr-4" : "px-4",
            // Outline ring
            hasError
              ? "ring-2 ring-inset ring-[rgb(var(--m3-error))]"
              : focused
                ? "ring-2 ring-inset ring-[rgb(var(--tone-focus-ring,var(--m3-primary)))]"
                : "ring-1 ring-inset ring-[rgb(var(--m3-outline))]",
            disabled && "ring-1 ring-inset ring-[rgb(var(--m3-on-surface)/0.38)]"
          )}
        >
          {LeadingIcon ? (
            <span aria-hidden="true" className={iconClasses("left")}>
              <LeadingIcon className="h-full w-full" />
            </span>
          ) : null}

          {floatingLabel([
            // Floating: sits on the top outline edge
            "top-0 -translate-y-1/2 text-body-sm",
            // Small background notch to visually break the outline
            "bg-[rgb(var(--m3-surface-container-lowest))] px-1",
            hasError
              ? "text-[rgb(var(--m3-error))]"
              : focused
                ? "text-[rgb(var(--tone-on-surface-accent,var(--m3-primary)))]"
                : "text-[rgb(var(--m3-on-surface-variant))]",
          ])}

          {control}

          {TrailingIcon ? (
            <span aria-hidden="true" className={iconClasses("right")}>
              <TrailingIcon className="h-full w-full" />
            </span>
          ) : null}
        </div>

        {supporting}
      </div>
    );
  }
);

AdminTextFieldBase.displayName = "AdminTextFieldBase";

// ============================================================================
// Public components
// ============================================================================

/**
 * AdminTextField — M3 single-line text field (see {@link AdminTextFieldBase}
 * for the shared anatomy).
 */
export const AdminTextField = React.forwardRef<HTMLInputElement, AdminTextFieldProps>(
  ({ inputProps, ...props }, ref) => (
    <AdminTextFieldBase
      {...(props as AdminTextFieldBaseProps)}
      controlProps={inputProps as Record<string, unknown>}
      // Safe narrowing: with multiline unset the base always renders an <input>.
      ref={ref as React.Ref<AdminTextFieldControl>}
    />
  )
);

AdminTextField.displayName = "AdminTextField";

/**
 * AdminTextArea — the multiline M3 text field. Same anatomy, floating label,
 * indicator/ring, and supporting-text behavior as {@link AdminTextField}; the
 * control is a vertically resizable <textarea> (default 3 rows). Added for the
 * reason-required flows so no surface hand-rolls a label + textarea again.
 */
export const AdminTextArea = React.forwardRef<HTMLTextAreaElement, AdminTextAreaProps>(
  ({ textareaProps, rows, ...props }, ref) => (
    <AdminTextFieldBase
      {...(props as AdminTextFieldBaseProps)}
      multiline
      rows={rows}
      controlProps={textareaProps as Record<string, unknown>}
      // Safe narrowing: with multiline set the base always renders a <textarea>.
      ref={ref as React.Ref<AdminTextFieldControl>}
    />
  )
);

AdminTextArea.displayName = "AdminTextArea";

/**
 * AdminSelect — the M3 form select. Same anatomy, indicator/ring, and
 * supporting-text behavior as {@link AdminTextField}, wrapping a native
 * `<select>`: the label floats permanently (a select always shows its
 * selected option's text), the trailing slot carries a chevron by default,
 * and an empty-value `<option>` plays the placeholder role. Added 2026-08-29
 * so form flows stop hand-rolling `SELECT_CLASS` selects (the toolbar
 * `AdminSortSelect` stays a separate, toolbar-only control).
 */
export const AdminSelect = React.forwardRef<HTMLSelectElement, AdminSelectProps>(
  ({ selectProps, children, trailingIcon, ...props }, ref) => (
    <AdminTextFieldBase
      {...(props as AdminTextFieldBaseProps)}
      select
      trailingIcon={trailingIcon ?? RiArrowDownSLine}
      controlProps={{ ...selectProps, children } as Record<string, unknown>}
      // Safe narrowing: with select set the base always renders a <select>.
      ref={ref as React.Ref<AdminTextFieldControl>}
    />
  )
);

AdminSelect.displayName = "AdminSelect";
