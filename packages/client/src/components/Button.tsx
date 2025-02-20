import { forwardRef } from "react";
import { RemixiconComponentType } from "@remixicon/react";

interface ButtonProps {
  label: string;
  style?: "solid" | "soft" | "outline" | "ghost";
  variant?: "primary" | "secondary" | "tertiary";
  size?: "small" | "medium" | "large";
  className?: string;
  fullWidth?: boolean;
  disabled?: boolean;
  loading?: boolean;
  Icon?: RemixiconComponentType;
  type?: "button" | "submit" | "reset";
  onClick?: () => void;
}

const sizes = {
  small: "py-2 px-3",
  medium: "py-3 px-4 text-xl",
  large: "p-4 sm:p-5 text-xl",
};

const variantColors = {
  primary: "teal",
  secondary: "#D2B48C",
  tertiary: "blue",
};

function generateStyles(variant: "primary" | "secondary" | "tertiary") {
  return {
    solid: `border-transparent bg-${variantColors[variant]}-600 text-white hover:bg-${variantColors[variant]}-700`,
    soft: `border-transparent bg-${variantColors[variant]}-100 text-${variantColors[variant]}-800 hover:bg-${variantColors[variant]}-200  dark:hover:bg-${variantColors[variant]}-900 dark:text-${variantColors[variant]}-500 dark:hover:text-${variantColors[variant]}-400`,
    outline: `border-${variantColors[variant]}-500 text-${variantColors[variant]}-500 hover:border-${variantColors[variant]}-400 hover:text-${variantColors[variant]}-400 `,
    ghost: `border-transparent text-${variantColors[variant]}-500 hover:bg-${variantColors[variant]}-100 hover:text-${variantColors[variant]}-800  dark:hover:bg-${variantColors[variant]}-800/30 dark:hover:text-${variantColors[variant]}-400`,
  };
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      label,
      style = "solid",
      variant = "primary",
      size = "medium",
      className,
      fullWidth = false,
      disabled = false,
      loading = false,
      Icon,
      ...props
    },
    ref
  ) => {
    const sizeClasses = sizes[size];
    const styleClasses = generateStyles(variant)[style];

    return (
      <button
        ref={ref}
        disabled={disabled}
        className={`
         ${sizeClasses} ${styleClasses} ${fullWidth ? "w-full" : ""}
        inline-flex justify-center items-center gap-x-2 text-sm font-semibold rounded-lg
        border disabled:pointer-events-none disabled:opacity-50 ${className}
      `}
        {...props}
      >
        {label}
        {Icon && <Icon className="flex-shrink-0 size-4" />}
        {loading && (
          <span
            className="animate-spin inline-block size-4 border-[3px] border-current border-t-transparent text-white rounded-full"
            role="status"
            aria-label="loading"
          ></span>
        )}
      </button>
    );
  }
);

Button.displayName = "Button";
