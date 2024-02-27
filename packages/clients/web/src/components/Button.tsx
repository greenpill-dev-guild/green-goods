import React from "react";
import { css } from "@emotion/react";

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
  active,
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
        css={css`
          border: 2px solid rgba(0, 0, 0, 0);
          transition: all 0.2s ease-in-out;
          position: relative;

          &::after {
            content: "";
            position: absolute;
            left: 0;
            top: 0;
            z-index: -1;
            width: 100%;
            height: 100%;
            border-top: 1px solid;
            border-bottom: 1px solid;
          }

          &:hover {
            ${!disabled &&
            css`
              border-top: 2px solid;
              border-bottom: 2px solid;
            `}
          }

          ${active &&
          css`
            border-top: 2px solid;
            border-bottom: 2px solid;
          `}
        `}
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
      css={css`
        border-top: 2px solid rgba(0, 0, 0, 0);
        border-bottom: 2px solid rgba(0, 0, 0, 0);
        transition: all 0.2s ease-in-out;
        position: relative;

        &::after {
          content: "";
          position: absolute;
          left: 0;
          top: 0;
          z-index: -1;
          width: 100%;
          height: 100%;
          border-top: 1px solid;
          border-bottom: 1px solid;
        }

        &:hover {
          ${!disabled &&
          css`
            border-top: 2px solid;
            border-bottom: 2px solid;
          `}
        }

        ${active &&
        css`
          border-top: 2px solid;
          border-bottom: 2px solid;
        `}
      `}
    >
      <span className="text-lg uppercase font-semibold tracking-wide">
        {title}
      </span>
    </button>
  );
};
