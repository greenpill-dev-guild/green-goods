// AlignUI Button v0.0.0

import { type PolymorphicComponentProps, recursiveCloneChildren } from "@green-goods/shared";
import { Slot } from "@radix-ui/react-slot";
import * as React from "react";
import { tv, type VariantProps } from "tailwind-variants";

const BUTTON_ROOT_NAME = "ButtonRoot";
const BUTTON_ICON_NAME = "ButtonIcon";

export const buttonVariants = tv({
  slots: {
    root: "gg-button group relative overflow-hidden",
    icon: "gg-button-icon",
  },
  variants: {
    variant: {
      primary: { root: "gg-button-primary" },
      neutral: { root: "gg-button-neutral" },
      error: { root: "gg-button-error" },
    },
    mode: {
      filled: { root: "gg-button-filled" },
      stroke: { root: "gg-button-stroke" },
      lighter: { root: "gg-button-lighter" },
      ghost: { root: "gg-button-ghost" },
    },
    shape: {
      regular: { root: "gg-button-shape-regular" },
      pilled: { root: "gg-button-shape-pilled" },
    },
    size: {
      medium: {
        root: "gg-button-size-md",
      },
      small: {
        root: "gg-button-size-sm",
      },
      xsmall: {
        root: "gg-button-size-xs",
      },
      xxsmall: {
        root: "gg-button-size-2xs",
      },
    },
  },
  defaultVariants: {
    variant: "primary",
    mode: "filled",
    size: "medium",
    shape: "regular",
  },
});

type ButtonSharedProps = VariantProps<typeof buttonVariants>;

export type ButtonRootProps = VariantProps<typeof buttonVariants> &
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    asChild?: boolean;
  };

const ButtonRoot = React.forwardRef<HTMLButtonElement, ButtonRootProps>(
  ({ children, variant, mode, size, asChild, className, shape, ...rest }, forwardedRef) => {
    const uniqueId = React.useId();
    const Component = asChild ? Slot : "button";
    const { root } = buttonVariants({ variant, mode, size, shape });

    const sharedProps: ButtonSharedProps = {
      variant,
      mode,
      size,
      shape,
    };

    const extendedChildren = recursiveCloneChildren(
      children as React.ReactElement[],
      sharedProps,
      [BUTTON_ICON_NAME],
      uniqueId,
      asChild
    );

    return (
      <Component ref={forwardedRef} className={root({ class: className })} {...rest}>
        {extendedChildren}
      </Component>
    );
  }
);
ButtonRoot.displayName = BUTTON_ROOT_NAME;

function ButtonIcon<T extends React.ElementType>({
  variant,
  mode,
  size,
  as,
  className,
  ...rest
}: PolymorphicComponentProps<T, ButtonSharedProps>) {
  const Component = as || "div";
  const { icon } = buttonVariants({ mode, variant, size });

  return <Component className={icon({ class: className })} {...rest} />;
}
ButtonIcon.displayName = BUTTON_ICON_NAME;

export { ButtonRoot as Root, ButtonIcon as Icon };
