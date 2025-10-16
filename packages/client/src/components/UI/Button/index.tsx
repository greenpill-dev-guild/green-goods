import type { SyntheticEvent } from "react";
import { type ButtonRootProps, Root } from "./Base";

export type ButtonProps = {
  label: string;
  leadingIcon?: React.ReactNode;
  trailingIcon?: React.ReactNode;
  onClick?: (e: SyntheticEvent<HTMLButtonElement>) => void;
} & ButtonRootProps;

/** Primary UI component for user interaction */
export const Button = ({ label, leadingIcon, trailingIcon, ...props }: ButtonProps) => {
  return (
    <Root {...props}>
      {leadingIcon}
      {label}
      {trailingIcon}
    </Root>
  );
};
