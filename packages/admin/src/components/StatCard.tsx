import { cn } from "@green-goods/shared";
import { RiArrowRightSLine } from "@remixicon/react";
import type React from "react";
import { Link } from "react-router-dom";

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
  value: React.ReactNode;
  titleText?: string;
  colorScheme?: ColorScheme;
  className?: string;
  to?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  icon,
  label,
  value,
  titleText,
  colorScheme = "success",
  className,
  to,
}) => {
  const content = (
    <div className="flex h-full items-start gap-2 sm:gap-3">
      <div
        className={cn(
          "mt-0.5 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg",
          colorSchemeMap[colorScheme]
        )}
      >
        {icon}
      </div>
      <dl className="min-w-0 flex-1">
        <dt className="subheading-xs break-words leading-tight text-text-soft">
          {label}
        </dt>
        <dd
          className="mt-1 break-words font-heading text-xl font-semibold leading-tight tabular-nums text-text-strong sm:text-2xl"
          title={titleText}
        >
          {value}
        </dd>
      </dl>
      {to && (
        <RiArrowRightSLine className="mt-0.5 h-5 w-5 flex-shrink-0 text-text-soft transition-colors group-hover:text-text-strong" />
      )}
    </div>
  );

  const cardClass = cn(
    "block h-full rounded-xl border border-stroke-soft bg-bg-white p-3 shadow-sm transition-shadow duration-200 hover:shadow-md sm:p-4",
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
