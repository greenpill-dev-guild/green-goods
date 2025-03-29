// AlignUI Button v0.0.0

import * as React from "react";

import { Slot } from "@radix-ui/react-slot";
import type { PolymorphicComponentProps } from "../../../utils/polymorphic";
import { recursiveCloneChildren } from "../../../utils/recursive-clone-children";
import { tv, type VariantProps } from "tailwind-variants";

const BUTTON_ROOT_NAME = "ButtonRoot";
const BUTTON_ICON_NAME = "ButtonIcon";

export const buttonVariants = tv({
  slots: {
    root: [
      // base
      "group relative inline-flex items-center justify-center whitespace-nowrap outline-none",
      "transition duration-200 ease-out",
      // focus
      "focus:outline-none",
      // disabled
      "disabled:pointer-events-none disabled:bg-weak-50 disabled:text-disabled-300 disabled:outline-transparent",
      "active:scale-95",
      "user-select-none",
    ],
    icon: [
      // base
      "flex size-5 shrink-0 items-center justify-center",
    ],
  },
  variants: {
    variant: {
      primary: {},
      neutral: {},
      error: {},
    },
    mode: {
      filled: {
        root: "disabled:text-disabled-300 disabled:bg-bg-weak-50 disabled:text-text-disabled-300",
      },
      stroke: {
        root: [
          "outline outline-inset", // disabled
          "disabled:pointer-events-none  disabled:text-disabled-300 disabled:bg-bg-weak-50 disabled:text-text-disabled-300",
        ],
      },
      lighter: {
        root: "outline outline-inset disabled:text-disabled-300 disabled:bg-bg-weak-50 disabled:text-text-disabled-300",
      },
      ghost: {
        root: "outline outline-inset disabled:text-disabled-300 disabled:bg-bg-weak-50 disabled:text-text-disabled-300",
      },
    },
    shape: {
      regular: { root: "rounded-lg" },
      pilled: { root: "rounded-full" },
    },
    size: {
      medium: {
        root: "h-10 gap-3 px-3.5 text-label-sm",
        icon: "-mx-1",
      },
      small: {
        root: "h-9 gap-3 px-3 text-label-sm",
        icon: "-mx-1",
      },
      xsmall: {
        root: "h-8 gap-2.5 px-2.5 text-label-xs",
        icon: "-mx-1",
      },
      xxsmall: {
        root: "h-7 gap-2.5 px-2 text-label-xs",
        icon: "-mx-1",
      },
    },
  },
  compoundVariants: [
    //#region variant=primary
    {
      variant: "primary",
      mode: "filled",
      class: {
        root: [
          // base
          "bg-primary-base text-static-white",
          // hover
          "hover:bg-primary-darker",
          // focus
          "focus-visible:shadow-button-primary-focus",
        ],
      },
    },
    {
      variant: "primary",
      mode: "stroke",
      class: {
        root: [
          // base
          "text-primary-base outline-primary-base bg-bg-white-0",
          // hover
          "hover:bg-primary-alpha-10 hover:outline-transparent",
          // focus
          "focus-visible:shadow-button-primary-focus",
        ],
      },
    },
    {
      variant: "primary",
      mode: "lighter",
      class: {
        root: [
          // base
          "bg-primary-alpha-10 text-primary-base outline-transparent",
          // hover
          "hover:outline-primary-base hover:bg-bg-white-0",
          // focus
          "focus-visible:outline-primary-base focus-visible:bg-bg-white-0 focus-visible:shadow-button-primary-focus",
        ],
      },
    },
    {
      variant: "primary",
      mode: "ghost",
      class: {
        root: [
          // base
          "text-primary-base bg-transparent outline-transparent",
          // hover
          "hover:bg-primary-alpha-10",
          // focus
          "focus-visible:outline-primary-base focus-visible:bg-bg-white-0 focus-visible:shadow-button-primary-focus",
        ],
      },
    },
    //#endregion

    //#region variant=neutral
    {
      variant: "neutral",
      mode: "filled",
      class: {
        root: [
          // base
          "bg-bg-strong-950 text-text-white-0",
          // hover
          "hover:bg-bg-surface-800",
          // focus
          "focus-visible:shadow-button-important-focus",
        ],
      },
    },
    {
      variant: "neutral",
      mode: "stroke",
      class: {
        root: [
          // base
          "bg-bg-white-0 text-text-sub-600 shadow-regular-sm outline-stroke-soft-200",
          // hover
          "hover:bg-bg-weak-50 hover:text-text-strong-950 hover:shadow-none hover:outline-transparent",
          // focus
          "focus-visible:text-text-strong-950 focus-visible:shadow-button-important-focus focus-visible:outline-stroke-strong-950",
        ],
      },
    },
    {
      variant: "neutral",
      mode: "lighter",
      class: {
        root: [
          // base
          "bg-bg-weak-50 text-text-sub-600 outline-transparent",
          // hover
          "hover:bg-bg-white-0 hover:text-text-strong-950 hover:shadow-regular-xs hover:outline-stroke-soft-200",
          // focus
          "focus-visible:bg-bg-white-0 focus-visible:text-text-strong-950 focus-visible:shadow-button-important-focus focus-visible:outline-stroke-strong-950",
        ],
      },
    },
    {
      variant: "neutral",
      mode: "ghost",
      class: {
        root: [
          // base
          "bg-transparent text-text-sub-600 outline-transparent",
          // hover
          "hover:bg-bg-weak-50 hover:text-text-strong-950",
          // focus
          "focus-visible:bg-bg-white-0 focus-visible:text-text-strong-950 focus-visible:shadow-button-important-focus focus-visible:outline-stroke-strong-950",
        ],
      },
    },
    //#endregion

    //#region variant=error
    {
      variant: "error",
      mode: "filled",
      class: {
        root: [
          // base
          "bg-error-base text-static-white",
          // hover
          "hover:bg-red-700",
          // focus
          "focus-visible:shadow-button-error-focus",
        ],
      },
    },
    {
      variant: "error",
      mode: "stroke",
      class: {
        root: [
          // base
          "text-error-base outline-error-base bg-bg-white-0",
          // hover
          "hover:bg-red-alpha-10 hover:outline-transparent",
          // focus
          "focus-visible:shadow-button-error-focus",
        ],
      },
    },
    {
      variant: "error",
      mode: "lighter",
      class: {
        root: [
          // base
          "text-error-base bg-red-alpha-10 outline-transparent",
          // hover
          "hover:outline-error-base hover:bg-bg-white-0",
          // focus
          "focus-visible:outline-error-base focus-visible:bg-bg-white-0 focus-visible:shadow-button-error-focus",
        ],
      },
    },
    {
      variant: "error",
      mode: "ghost",
      class: {
        root: [
          // base
          "text-error-base bg-transparent outline-transparent",
          // hover
          "hover:bg-red-alpha-10",
          // focus
          "focus-visible:outline-error-base focus-visible:bg-bg-white-0 focus-visible:shadow-button-error-focus",
        ],
      },
    },
    //#endregion
  ],
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
  (
    { children, variant, mode, size, asChild, className, shape, ...rest },
    forwardedRef
  ) => {
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
      <Component
        ref={forwardedRef}
        className={root({ class: className })}
        {...rest}
      >
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
