import * as React from "react";
import type { ButtonRootProps } from "./Base";
import { Root as ButtonRoot, Icon as ButtonIcon } from "./Base";

export interface ButtonProps extends ButtonRootProps {
  /**
   * Primary content of the button.
   * If no children are provided, the label will be rendered.
   */
  children?: React.ReactNode;
  label?: React.ReactNode;
  /**
   * An optional icon displayed at the start.
   */
  startIcon?: React.ReactElement;
  /**
   * An optional icon displayed at the end.
   */
  endIcon?: React.ReactElement;
}

/**
 * A minimal Button component that leverages the base (Root and Icon) components.
 *
 * You can control appearance via the variant, mode, and size props (as defined in your base).
 */
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ label, children, startIcon, endIcon, ...props }, ref) => {
    // Use children if provided; otherwise use label.
    const content = children || label;

    return (
      <ButtonRoot ref={ref} {...props}>
        {startIcon && <ButtonIcon>{startIcon}</ButtonIcon>}
        {content}
        {endIcon && <ButtonIcon>{endIcon}</ButtonIcon>}
      </ButtonRoot>
    );
  }
);
Button.displayName = "Button";
