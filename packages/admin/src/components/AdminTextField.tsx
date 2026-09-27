import { cn } from "@green-goods/shared/utils/styles/cn";
import { RiArrowDownSLine } from "@remixicon/react";
import * as React from "react";
import { useCallback, useId, useRef, useState } from "react";
import { useIntl } from "react-intl";
import type {
  AdminSelectProps,
  AdminTextAreaProps,
  AdminTextFieldBaseProps,
  AdminTextFieldControl,
  AdminTextFieldProps,
} from "./AdminTextField.types";
import { CharacterCounter, countedLength, overLimitMessage } from "./CharacterCounter";

// ============================================================================
// Base
// ============================================================================

/**
 * Shared M3 text-field anatomy behind {@link AdminTextField},
 * {@link AdminTextArea}, and {@link AdminSelect}, on the responsive field tier
 * (DL-011, DL-030): 44dp / 16px text below 640px (the installed app's touch
 * fields), 40dp / 14px text from 640px, balanced with the 32 / 40dp buttons:
 * - Floating label that animates between resting (body-md) and floating (body-sm)
 * - Active indicator line (filled) or outline ring (outlined) reflecting focus/error state
 * - Leading and trailing icon slots (20dp, on-surface-variant)
 * - Supporting text / error message below with aria-describedby linkage
 * - Opt-in character counter at the end of that row, toward the control's maxLength,
 *   with an error past it
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
      showCount = false,
      countBytes = false,
    },
    ref
  ) => {
    const { formatMessage } = useIntl();
    const autoId = useId();
    const inputId = idProp ?? autoId;
    const supportingId = `${inputId}-supporting`;
    // The counter reads its limit off the control, so the two cannot drift.
    const maxLength = controlProps?.maxLength;
    const counter =
      showCount && typeof maxLength === "number"
        ? { id: `${inputId}-count`, max: maxLength }
        : null;

    const [focused, setFocused] = useState(false);
    // An uncontrolled field (register(), defaultValue) tracks its own length:
    // it floats the label and feeds the counter.
    const [uncontrolledLength, setUncontrolledLength] = useState(() =>
      countedLength(defaultValue ?? "", countBytes)
    );
    // Text the steward did not type (loaded, or a controlled value the caller
    // replaced) is described when the control takes focus, never announced.
    const [typedText, setTypedText] = useState<string | null>(null);
    const edited = typedText !== null && (value === undefined || value === typedText);

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

        if (node && value === undefined)
          setUncontrolledLength(countedLength(node.value, countBytes));
      },
      [ref, value, countBytes]
    );

    // What the control holds: the counter shows its length, any text floats the label.
    const length = value !== undefined ? countedLength(value, countBytes) : uncontrolledLength;
    // Raw text floats the label: a trimmed byte count can read 0 over spaces.
    const hasValue = (value !== undefined ? value.length : uncontrolledLength) > 0;

    // A native <select> always shows its selected option's text, and date/time
    // inputs paint intrinsic format text (mm/dd/yyyy) — a resting centered
    // label would overlap both, so those labels float permanently (M3 exposed).
    const intrinsicText = /^(date|time|datetime-local|month|week)$/.test(type);
    const isFloating = select || intrinsicText || focused || hasValue || Boolean(defaultValue);

    // Past the limit: text written before it, loaded in, or bytes, which
    // `maxLength` cannot stop. A caller's own error still comes first.
    const limitError =
      counter && length > counter.max
        ? overLimitMessage(formatMessage, counter.max, countBytes)
        : undefined;
    const shownError = error ?? limitError;
    const hasError = Boolean(shownError);
    const supportingText = shownError ?? helperText;

    // -------------------------------------------------------------------------
    // Shared handlers
    // -------------------------------------------------------------------------

    const handleFocus = () => setFocused(true);

    const handleBlur = (e: React.FocusEvent<AdminTextFieldControl>) => {
      setFocused(false);
      onBlur?.(e);
    };

    const handleChange = (e: React.ChangeEvent<AdminTextFieldControl>) => {
      setUncontrolledLength(countedLength(e.currentTarget.value, countBytes));
      setTypedText(e.currentTarget.value);
      onChange?.(e);
    };

    // -------------------------------------------------------------------------
    // Control element (input or textarea), shared by both variants
    // -------------------------------------------------------------------------

    const controlClasses = cn(
      // Layout — sits above the active indicator
      "peer w-full bg-transparent",
      // 16px on touch widths (no iOS zoom, PWA parity), 14px from 640px (DL-030).
      "text-body-lg leading-5 sm:text-body-md [color:rgb(var(--m3-on-surface))]",
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
      // Below the floating label: 20 + 20 + 4 = 44 on touch widths, 16 + 20 + 4 = 40 from 640px.
      "pb-1 pt-5 sm:pt-4",
      multiline && "resize-y",
      // Selects drop the native chrome; the chevron renders in the trailing
      // icon slot and clicks fall through it to the control. Option-row colours
      // belong to `[data-theme="dark"] select option` in theme.css, not here.
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
        [
          supportingText ? supportingId : null,
          counter?.id,
          controlProps?.["aria-describedby"] as string,
        ]
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
        "absolute bottom-3 sm:bottom-2.5",
        position === "left" ? "left-3" : "right-3",
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
                // Resting: vertically centered, the control's own size
                "top-1/2 -translate-y-1/2 text-body-lg leading-5 sm:text-body-md",
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

    // Supporting text at the start of the row, the counter at its end (M3).
    const supporting =
      supportingText || counter ? (
        <div className="mt-1 flex gap-4 px-4 text-body-sm">
          {supportingText ? (
            <p
              id={supportingId}
              role={error || (limitError && edited) ? "alert" : undefined}
              className={cn(
                hasError
                  ? "text-[rgb(var(--m3-error))]"
                  : "text-[rgb(var(--m3-on-surface-variant))]",
                disabled && "text-[rgb(var(--m3-on-surface)/0.38)]"
              )}
            >
              {supportingText}
            </p>
          ) : null}
          {counter ? (
            <CharacterCounter
              id={counter.id}
              count={length}
              max={counter.max}
              error={hasError}
              disabled={disabled}
              edited={edited}
              bytes={countBytes}
            />
          ) : null}
        </div>
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
              // (--m3-shape-sm, the chip/sm tier) is a deliberate step up from the 4px
              // M3 xs, which read as too square; the field's own tier across admin fields.
              "rounded-t-[var(--m3-shape-sm)] rounded-b-none",
              // Height: 44 on touch widths, 40 from 640px (DL-030)
              "min-h-11 sm:min-h-10",
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
              // Floating: a 12px label in a 16px slot (2–18px on touch widths, 0–16px from 640px).
              "top-0.5 text-body-sm leading-4 sm:top-0",
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
            // Height: 44 on touch widths, 40 from 640px (DL-030)
            "min-h-11 sm:min-h-10",
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
            "top-0 -translate-y-1/2 text-body-sm leading-4",
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
