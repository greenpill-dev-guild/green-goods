import type { SyntheticEvent } from "react";
import { type ButtonRootProps, Root } from "./Base";

export type ButtonProps = {
  label: string;
  leadingIcon?: React.ReactNode;
  trailingIcon?: React.ReactNode;
  /**
   * In-flight state: swaps the leading icon for a spinner, sets aria-busy, and
   * guards activation via aria-disabled instead of native disabled — native
   * disabled drops keyboard focus mid-ceremony, and `.gg-button[aria-disabled]`
   * already carries the dimmed/inert visual in theme.css.
   */
  isLoading?: boolean;
  onClick?: (e: SyntheticEvent<HTMLButtonElement>) => void;
} & ButtonRootProps;

export const Button = ({
  label,
  leadingIcon,
  trailingIcon,
  isLoading = false,
  disabled,
  onClick,
  ...props
}: ButtonProps) => {
  return (
    <Root
      {...props}
      disabled={isLoading ? undefined : disabled}
      aria-disabled={isLoading || disabled || undefined}
      aria-busy={isLoading || undefined}
      onClick={isLoading || disabled ? undefined : onClick}
    >
      {isLoading ? (
        <span
          aria-hidden="true"
          className="h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      ) : (
        leadingIcon
      )}
      <span className="min-w-0 truncate">{label}</span>
      {trailingIcon}
    </Root>
  );
};
