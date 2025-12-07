import React from "react";
import { cn } from "../utils/styles/cn";
import { Spinner } from "./Spinner";

export interface HydrationFallbackProps {
  /** App name for screen reader */
  appName?: string;
  /** Show icon above spinner */
  showIcon?: boolean;
  /** Optional loading message */
  message?: string;
  className?: string;
}

/**
 * Fallback component for React Router lazy loading / hydration
 *
 * @example
 * // Client
 * <HydrationFallback appName="Green Goods" />
 *
 * // Admin
 * <HydrationFallback appName="Green Goods Admin" showIcon message="Loading..." />
 */
export const HydrationFallback: React.FC<HydrationFallbackProps> = ({
  appName = "Green Goods",
  showIcon = false,
  message,
  className,
}) => {
  return (
    <div
      className={cn("min-h-screen flex items-center justify-center bg-white", className)}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="flex flex-col items-center gap-3 text-center">
        {showIcon && (
          <div className="mx-auto h-16 w-16 bg-green-100 rounded-xl flex items-center justify-center mb-1 animate-pulse">
            <svg className="h-10 w-10 text-green-600" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z"
                clipRule="evenodd"
              />
            </svg>
          </div>
        )}

        <Spinner size="lg" label={`Loading ${appName}`} />
        <span className="sr-only">Loading {appName}</span>

        {message && <p className="mt-2 text-sm text-slate-500">{message}</p>}
      </div>
    </div>
  );
};
