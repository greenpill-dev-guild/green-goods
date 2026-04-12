import { RiArrowRightSLine } from "@remixicon/react";
import type React from "react";
import { Link } from "react-router-dom";
import { cn } from "../utils";

type ColorScheme = "success" | "warning" | "error" | "info";

const colorSchemeMap: Record<ColorScheme, string> = {
  success: "bg-success-lighter text-success-dark",
  warning: "bg-warning-lighter text-warning-dark",
  error: "bg-error-lighter text-error-dark",
  info: "bg-information-lighter text-information-dark",
};

export interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  titleText?: string;
  colorScheme?: ColorScheme;
  /** Hero variant: spans 2 grid columns with larger typography */
  hero?: boolean;
  /** Optional trend indicator shown below the value */
  trend?: React.ReactNode;
  className?: string;
  to?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  icon,
  label,
  value,
  titleText,
  colorScheme = "success",
  hero,
  trend,
  className,
  to,
}) => {
  const content = (
    <div className={cn("flex items-center gap-2 sm:gap-3", hero && "gap-3 sm:gap-4")}>
      <div
        className={cn(
          "flex flex-shrink-0 items-center justify-center rounded-lg",
          hero ? "h-12 w-12 rounded-xl [&>svg]:h-6 [&>svg]:w-6" : "h-10 w-10",
          colorSchemeMap[colorScheme]
        )}
      >
        {icon}
      </div>
      <dl className="min-w-0 flex-1">
        <dt className={cn("truncate text-text-soft", hero ? "subheading-sm" : "subheading-xs")}>
          {label}
        </dt>
        <dd
          className={cn(
            "mt-1 line-clamp-2 font-heading font-semibold tabular-nums text-text-strong",
            hero ? "text-2xl sm:text-3xl tracking-tight" : "text-xl sm:text-2xl"
          )}
          title={titleText}
        >
          {value}
        </dd>
        {trend && <div className="mt-1">{trend}</div>}
      </dl>
      {to && (
        <RiArrowRightSLine className="h-5 w-5 flex-shrink-0 text-text-soft transition-colors group-hover:text-text-strong" />
      )}
    </div>
  );

  const cardClass = cn(
    "block rounded-lg glass-raised p-3 transition-all duration-[var(--spring-fast-duration)] ease-[var(--spring-fast-easing)] hover:shadow-[var(--edge-hover),_var(--elevation-2)] hover:-translate-y-0.5 sm:p-4",
    hero && "sm:col-span-2 sm:p-5",
    to && "cursor-pointer group",
    className
  );

  return to ? (
    <Link to={to} className={cardClass}>
      {content}
    </Link>
  ) : (
    <div className={cardClass}>{content}</div>
  );
};
