import * as React from "react";
import { cn } from "../../utils/styles/cn";

type ControlSurface = "default" | "admin";
type ControlSize = "sm" | "md";

function ariaInvalid(value: React.AriaAttributes["aria-invalid"]): boolean {
  return value === true || value === "true" || value === "grammar" || value === "spelling";
}

type BaseControlProps = {
  surface?: ControlSurface;
  controlSize?: ControlSize;
  invalid?: boolean;
};

export interface TextInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size">,
    BaseControlProps {}

export const TextInput = React.forwardRef<HTMLInputElement, TextInputProps>(
  ({ className, controlSize = "md", invalid, surface = "default", ...props }, ref) => {
    const isInvalid = invalid ?? ariaInvalid(props["aria-invalid"]);

    return (
      <input
        ref={ref}
        data-component="TextInput"
        data-surface={surface}
        data-size={controlSize}
        data-invalid={isInvalid || undefined}
        className={cn("gg-control", className)}
        {...props}
      />
    );
  }
);

TextInput.displayName = "TextInput";

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement>,
    BaseControlProps {}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, controlSize = "md", invalid, surface = "default", ...props }, ref) => {
    const isInvalid = invalid ?? ariaInvalid(props["aria-invalid"]);

    return (
      <textarea
        ref={ref}
        data-component="Textarea"
        data-surface={surface}
        data-size={controlSize}
        data-invalid={isInvalid || undefined}
        className={cn("gg-control gg-control-textarea", className)}
        {...props}
      />
    );
  }
);

Textarea.displayName = "Textarea";

export interface NativeSelectProps
  extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "size">,
    BaseControlProps {}

export const NativeSelect = React.forwardRef<HTMLSelectElement, NativeSelectProps>(
  ({ className, controlSize = "md", invalid, surface = "default", ...props }, ref) => {
    const isInvalid = invalid ?? ariaInvalid(props["aria-invalid"]);

    return (
      <select
        ref={ref}
        data-component="NativeSelect"
        data-surface={surface}
        data-size={controlSize}
        data-invalid={isInvalid || undefined}
        className={cn("gg-control gg-control-select", className)}
        {...props}
      />
    );
  }
);

NativeSelect.displayName = "NativeSelect";

export interface SwitchProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onChange" | "value"> {
  checked: boolean;
  onCheckedChange?: (checked: boolean) => void;
  surface?: ControlSurface;
}

export const Switch = React.forwardRef<HTMLButtonElement, SwitchProps>(
  (
    { checked, className, disabled, onCheckedChange, onClick, surface = "default", ...props },
    ref
  ) => (
    <button
      ref={ref}
      type="button"
      role="switch"
      aria-checked={checked}
      data-component="Switch"
      data-surface={surface}
      data-state={checked ? "checked" : "unchecked"}
      disabled={disabled}
      className={cn("gg-switch", className)}
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented || disabled) return;
        onCheckedChange?.(!checked);
      }}
      {...props}
    >
      <span className="gg-switch-thumb" aria-hidden="true" />
    </button>
  )
);

Switch.displayName = "Switch";
