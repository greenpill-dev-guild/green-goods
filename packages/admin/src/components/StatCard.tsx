import type React from "react";

import { cn } from "./ui/cn";

type ColorScheme = "success" | "warning" | "error" | "info";

const colorSchemeMap: Record<ColorScheme, string> = {
  success: "bg-success-lighter text-success-dark",
  warning: "bg-warning-lighter text-warning-dark",
  error: "bg-error-lighter text-error-dark",
  info: "bg-information-lighter text-information-dark",
};

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  colorScheme?: ColorScheme;
  className?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  icon,
  label,
  value,
  colorScheme = "success",
  className,
}) => {
  return (
    <div
      className={cn(
        "rounded-lg border border-stroke-soft bg-bg-white p-3 shadow-sm transition-shadow duration-200 hover:shadow-md sm:p-4",
        className
      )}
    >
      <div className="flex items-center gap-2 sm:gap-3">
        <div
          className={cn(
            "flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg",
            colorSchemeMap[colorScheme]
          )}
        >
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs uppercase tracking-wide text-text-soft">{label}</p>
          <p className="mt-1 truncate text-xl font-semibold text-text-strong sm:text-2xl">
            {value}
          </p>
        </div>
      </div>
    </div>
  );
};
