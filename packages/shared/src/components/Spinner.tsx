import { cn } from "../utils/cn";
import React from "react";

export interface SpinnerProps {
  size?: "sm" | "md" | "lg";
  className?: string;
  /** Screen reader label */
  label?: string;
}

const sizeClasses = {
  sm: "h-5 w-5 border-2",
  md: "h-8 w-8 border-3",
  lg: "h-10 w-10 border-3",
};

/**
 * Simple spinner component for loading states
 *
 * @example
 * <Spinner size="md" label="Loading..." />
 */
export const Spinner: React.FC<SpinnerProps> = ({ size = "md", className, label = "Loading" }) => {
  return (
    <>
      <div
        className={cn(
          "animate-spin rounded-full border-green-200 border-t-green-600",
          sizeClasses[size],
          className
        )}
        role="status"
        aria-label={label}
      />
      <span className="sr-only">{label}</span>
    </>
  );
};

export interface CenteredSpinnerProps extends SpinnerProps {
  /** Full screen or container-based centering */
  fullScreen?: boolean;
  /** Optional message below spinner */
  message?: string;
}

/**
 * Centered spinner with optional message
 *
 * @example
 * <CenteredSpinner fullScreen message="Loading your data..." />
 */
export const CenteredSpinner: React.FC<CenteredSpinnerProps> = ({
  fullScreen = false,
  message,
  ...spinnerProps
}) => {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3",
        fullScreen ? "min-h-screen bg-white" : "min-h-[200px]"
      )}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <Spinner {...spinnerProps} />
      {message && <p className="text-sm text-slate-600">{message}</p>}
    </div>
  );
};
