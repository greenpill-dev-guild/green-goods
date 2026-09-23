import type * as React from "react";
import type { ComponentType } from "react";

/** Props of the M3 field family in `AdminTextField.tsx`, kept apart from its anatomy. */

export type AdminTextFieldControl = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

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
  /**
   * Count the text toward the control's own `maxLength`, shown as M3's
   * "324 / 420" at the end of the supporting row. Without a `maxLength` there
   * is nothing to count toward, and no counter shows.
   */
  showCount?: boolean;
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

export interface AdminSelectProps extends Omit<AdminTextFieldCommonProps, "showCount"> {
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
export interface AdminTextFieldBaseProps extends AdminTextFieldCommonProps {
  multiline?: boolean;
  select?: boolean;
  rows?: number;
  type?: string;
  onChange?: (e: React.ChangeEvent<AdminTextFieldControl>) => void;
  onBlur?: (e: React.FocusEvent<AdminTextFieldControl>) => void;
  controlProps?: Record<string, unknown>;
}
