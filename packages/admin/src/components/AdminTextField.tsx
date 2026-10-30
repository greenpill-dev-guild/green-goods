import {
  NativeSelect,
  Textarea,
  TextInput,
} from "@green-goods/shared/components/Form/ControlPrimitives";
import { cn } from "@green-goods/shared/utils/styles/cn";
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
 * The field anatomy behind {@link AdminTextField}, {@link AdminTextArea}, and
 * {@link AdminSelect}: the shared field (DL-116), the installed app's label and
 * message layout (F3) around Shared's own control:
 * - The label above the control, the shared field title (`gg-field-label`)
 * - The shared control (`TextInput`, `Textarea`, `NativeSelect`) on the admin
 *   surface: the cockpit's 8px corner on the responsive field tier, 44px /
 *   16px text below 640px (the installed app's touch fields) and 40px / 14px
 *   text from 640px (DL-030, DL-031), the control-grade outline at rest, one
 *   2px focus ring in the workspace tone (DL-098), and the error colour on error
 * - Leading and trailing icon slots (20px, on-surface-variant)
 * - Supporting text / error message below with aria-describedby linkage, on
 *   the shared message line (`gg-field-message`), which reserves the
 *   cockpit's message lines whether or not it shows one, so a message that
 *   fits never moves the form (DL-064) and a longer one grows the line
 * - Opt-in character counter at the end of that row, toward the control's maxLength,
 *   with an error past it
 * - forwardRef compatible — wraps the native control for react-hook-form register()
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

    // An uncontrolled field (register(), defaultValue) tracks its own length
    // for the counter.
    const [uncontrolledLength, setUncontrolledLength] = useState(() =>
      countedLength(defaultValue ?? "", countBytes)
    );
    // Text the steward did not type (loaded, or a controlled value the caller
    // replaced) is described when the control takes focus, never announced.
    const [typedText, setTypedText] = useState<string | null>(null);
    const edited = typedText !== null && (value === undefined || value === typedText);

    // Internal ref to read the uncontrolled control's value for the counter
    const internalRef = useRef<AdminTextFieldControl | null>(null);

    // Merge the forwarded ref and our internal ref via callback ref. React Hook
    // Form restores uncontrolled values in its ref callback, so read the DOM
    // value after forwarding and update the count before the next paint.
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

    // What the control holds: the counter shows its length.
    const length = value !== undefined ? countedLength(value, countBytes) : uncontrolledLength;

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

    const handleBlur = (e: React.FocusEvent<AdminTextFieldControl>) => {
      onBlur?.(e);
    };

    const handleChange = (e: React.ChangeEvent<AdminTextFieldControl>) => {
      setUncontrolledLength(countedLength(e.currentTarget.value, countBytes));
      setTypedText(e.currentTarget.value);
      onChange?.(e);
    };

    // -------------------------------------------------------------------------
    // Control element (input, textarea or select)
    // -------------------------------------------------------------------------

    // The shared control draws the box, the text and every state; the field
    // only makes room for its icons. A select's chevron is the control's own.
    const controlClasses = cn(
      select && "cursor-pointer",
      LeadingIcon && "pl-9",
      TrailingIcon && "pr-9",
      // A caller's class styles the value alone (an address in mono), never the label.
      controlProps?.className as string | undefined
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
      onBlur: handleBlur,
      className: controlClasses,
    };

    // Shared's controls on the admin surface (DL-031): they read the invalid
    // state from aria-invalid, so a group-level error a caller passes in
    // colours the box too.
    const control = select ? (
      <NativeSelect
        {...(controlProps as React.ComponentPropsWithoutRef<typeof NativeSelect>)}
        {...sharedControlProps}
        surface="admin"
        ref={mergeRef as React.Ref<HTMLSelectElement>}
      />
    ) : multiline ? (
      <Textarea
        {...(controlProps as React.ComponentPropsWithoutRef<typeof Textarea>)}
        {...sharedControlProps}
        surface="admin"
        ref={mergeRef as React.Ref<HTMLTextAreaElement>}
        rows={rows}
      />
    ) : (
      <TextInput
        {...(controlProps as React.ComponentPropsWithoutRef<typeof TextInput>)}
        {...sharedControlProps}
        surface="admin"
        ref={mergeRef as React.Ref<HTMLInputElement>}
        type={type}
      />
    );

    const iconClasses = (position: "left" | "right") =>
      cn(
        // Centred on the first text line: (44 - 20) / 2 and (40 - 20) / 2.
        "absolute top-3 sm:top-2.5",
        position === "left" ? "left-3" : "right-3",
        // Decorative only — clicks fall through (a select's chevron must not
        // swallow the tap that opens it).
        "pointer-events-none h-5 w-5 shrink-0",
        hasError ? "text-[rgb(var(--m3-error))]" : "text-[rgb(var(--m3-on-surface-variant))]",
        disabled && "text-[rgb(var(--m3-on-surface)/0.38)]"
      );

    return (
      <div
        data-component={select ? "AdminSelect" : "AdminTextField"}
        className={cn("flex flex-col gap-1", className)}
      >
        <label
          htmlFor={inputId}
          className={cn(
            "gg-field-label",
            hasError && "[color:rgb(var(--m3-error))]",
            disabled && "[color:rgb(var(--m3-on-surface)/0.38)]"
          )}
        >
          {label}
          {/* Visual-only marker: aria-required already announces the state, and
              hiding it keeps the accessible name equal to the label text. */}
          {required ? <span aria-hidden="true">{"\u00a0*"}</span> : null}
        </label>

        {/* The control and the icons laid over its inline padding */}
        <div data-region="field-container" className="relative">
          {LeadingIcon ? (
            <span aria-hidden="true" className={iconClasses("left")}>
              <LeadingIcon className="h-full w-full" />
            </span>
          ) : null}

          {control}

          {TrailingIcon ? (
            <span aria-hidden="true" className={iconClasses("right")}>
              <TrailingIcon className="h-full w-full" />
            </span>
          ) : null}
        </div>

        {/* Supporting text at the start of the line, the counter at its end. */}
        <div data-region="supporting-line" className="gg-field-help gg-field-message flex gap-4">
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
      </div>
    );
  }
);

AdminTextFieldBase.displayName = "AdminTextFieldBase";

// ============================================================================
// Public components
// ============================================================================

/**
 * AdminTextField — the single-line text field (see {@link AdminTextFieldBase}
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
 * AdminTextArea — the multiline text field. Same anatomy, label, and
 * supporting-text behavior as {@link AdminTextField}; the control is Shared's
 * vertically resizable `Textarea` (default 3 rows). Added for the
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
 * AdminSelect — the form select. Same anatomy, label, and supporting-text
 * behavior as {@link AdminTextField}, wrapping Shared's `NativeSelect`, which
 * draws its own chevron; an empty-value `<option>` plays the placeholder role. Added 2026-08-29 so
 * form flows stop hand-rolling `SELECT_CLASS` selects (the toolbar
 * `AdminSortSelect` stays a separate, toolbar-only control).
 */
export const AdminSelect = React.forwardRef<HTMLSelectElement, AdminSelectProps>(
  ({ selectProps, children, ...props }, ref) => (
    <AdminTextFieldBase
      {...(props as AdminTextFieldBaseProps)}
      select
      controlProps={{ ...selectProps, children } as Record<string, unknown>}
      // Safe narrowing: with select set the base always renders a <select>.
      ref={ref as React.Ref<AdminTextFieldControl>}
    />
  )
);

AdminSelect.displayName = "AdminSelect";
