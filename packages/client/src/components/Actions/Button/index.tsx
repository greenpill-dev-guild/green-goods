/**
 * Client Button — a temporary adapter over the shared Button.
 *
 * Call sites keep their `label` / `variant` / `mode` / `size` props while they
 * move to `@green-goods/shared/components/Button`. The adapter maps them onto the
 * shared emphasis API, so every client Button already follows DL-021 (shape
 * from emphasis) and DL-023 (the 48 / 44 / 40 / 32 scale). `shape` is ignored.
 */
import {
  type ButtonEmphasis,
  type ButtonSize,
  type ButtonTone,
  Button as SharedButton,
} from "@green-goods/shared/components/Button";
import type { ButtonHTMLAttributes, ReactNode, SyntheticEvent } from "react";

type ClientVariant = "primary" | "neutral" | "error";
type ClientMode = "filled" | "stroke" | "lighter" | "ghost";
type ClientSize = "medium" | "small" | "xsmall" | "xxsmall" | "compact";

export type ButtonRootProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ClientVariant;
  mode?: ClientMode;
  size?: ClientSize;
  /** @deprecated Shape follows emphasis (DL-021). Ignored. */
  shape?: "regular" | "pilled";
  asChild?: boolean;
};

export type ButtonProps = {
  label: string;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
  /**
   * In-flight state: swaps the leading icon for a spinner, sets aria-busy, and
   * guards activation via aria-disabled instead of native disabled, so keyboard
   * focus survives the ceremony.
   */
  isLoading?: boolean;
  onClick?: (e: SyntheticEvent<HTMLButtonElement>) => void;
} & ButtonRootProps;

function emphasisFor(variant: ClientVariant, mode: ClientMode): ButtonEmphasis {
  if (mode === "ghost") return "tertiary";
  // A dark neutral fill reads as a second action next to the green primary.
  if (mode === "filled" && variant !== "neutral") return "primary";
  return "secondary";
}

const toneFor = (variant: ClientVariant): ButtonTone =>
  variant === "error" ? "danger" : "default";

function sizeFor(size: ClientSize): ButtonSize {
  if (size === "medium") return "md";
  if (size === "small") return "sm";
  return "compact";
}

export const Button = ({
  label,
  leadingIcon,
  trailingIcon,
  isLoading = false,
  disabled,
  onClick,
  variant = "primary",
  mode = "filled",
  size = "medium",
  shape: _shape,
  ...props
}: ButtonProps) => (
  <SharedButton
    {...props}
    emphasis={emphasisFor(variant, mode)}
    tone={toneFor(variant)}
    size={sizeFor(size)}
    loading={isLoading}
    disabled={isLoading ? undefined : disabled}
    aria-disabled={isLoading || disabled || undefined}
    onClick={isLoading || disabled ? undefined : onClick}
    leadingIcon={leadingIcon}
    trailingIcon={trailingIcon}
  >
    {label ? <span className="min-w-0 truncate">{label}</span> : null}
  </SharedButton>
);
