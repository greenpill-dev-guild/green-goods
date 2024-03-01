import React from "react";

interface ButtonProps {
  title: string;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  full?: boolean;
  active?: boolean;
  disabled?: boolean;
  state?: "default" | "loading" | "success" | "error";
  variant?: "primary" | "secondary";
}

export const Button: React.FC<ButtonProps> = ({
  title,
  onClick,
  full,
  // active,
  disabled,
  variant,
}) => {
  if (variant === "secondary") {
    return (
      <button
        className={`${
          full ? "w-full" : ""
        } min-w-[11rem] w-full sm:w-auto px-4 py-2 opacity-80 disabled:opacity-80 hover:opacity-100 transform-gpu transition-opacity duration-200 ease-in-out`}
        onClick={onClick}
        disabled={disabled}
      >
        <span className="text-lg uppercase font-semibold tracking-wide">
          {title}
        </span>
      </button>
    );
  }
  return (
    <button
      className={`${
        full ? "w-full" : ""
      } min-w-[11rem] w-full sm:w-auto px-4 py-2 opacity-80 disabled:opacity-80 hover:opacity-100 transform-gpu transition-opacity duration-200 ease-in-out`}
      onClick={onClick}
      disabled={disabled}
    >
      <span className="text-lg uppercase font-semibold tracking-wide">
        {title}
      </span>
    </button>
  );
};
