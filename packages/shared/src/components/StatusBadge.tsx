import {
  RiCheckLine,
  RiCloseLine,
  RiErrorWarningLine,
  RiLoader4Line,
  RiTimeLine,
} from "@remixicon/react";
import React from "react";
import { cn } from "../utils/styles/cn";

export type WorkStatus = "approved" | "rejected" | "pending" | "syncing" | "failed";

export interface StatusBadgeProps {
  status: WorkStatus;
  className?: string;
  showIcon?: boolean;
  size?: "sm" | "md";
  /** Use semantic CSS variable tokens (admin) vs hardcoded colors (client) */
  variant?: "semantic" | "default";
}

interface StatusConfig {
  icon: React.ReactNode;
  label: string;
  bgColor: string;
  textColor: string;
  borderColor: string;
}

function getStatusConfig(status: WorkStatus, variant: "semantic" | "default"): StatusConfig {
  const iconClass = "w-3 h-3";

  if (variant === "semantic") {
    // Admin-style semantic tokens
    switch (status) {
      case "approved":
        return {
          icon: <RiCheckLine className={iconClass} />,
          label: "Approved",
          bgColor: "bg-success-lighter",
          textColor: "text-success-dark",
          borderColor: "border-success-light",
        };
      case "rejected":
        return {
          icon: <RiCloseLine className={iconClass} />,
          label: "Rejected",
          bgColor: "bg-error-lighter",
          textColor: "text-error-dark",
          borderColor: "border-error-light",
        };
      case "pending":
        return {
          icon: <RiTimeLine className={iconClass} />,
          label: "Pending",
          bgColor: "bg-warning-lighter",
          textColor: "text-warning-dark",
          borderColor: "border-warning-light",
        };
      case "syncing":
        return {
          icon: <RiLoader4Line className={cn(iconClass, "animate-spin")} />,
          label: "Syncing",
          bgColor: "bg-information-lighter",
          textColor: "text-information-dark",
          borderColor: "border-information-light",
        };
      case "failed":
        return {
          icon: <RiErrorWarningLine className={iconClass} />,
          label: "Failed",
          bgColor: "bg-error-lighter",
          textColor: "text-error-dark",
          borderColor: "border-error-light",
        };
      default:
        return {
          icon: <RiTimeLine className={iconClass} />,
          label: status,
          bgColor: "bg-bg-soft",
          textColor: "text-text-sub",
          borderColor: "border-stroke-soft",
        };
    }
  }

  // Default colors using semantic tokens (dark mode aware)
  switch (status) {
    case "approved":
      return {
        icon: <RiCheckLine className={iconClass} />,
        label: "Approved",
        bgColor: "bg-success-lighter",
        textColor: "text-success-dark",
        borderColor: "border-success-light",
      };
    case "rejected":
      return {
        icon: <RiCloseLine className={iconClass} />,
        label: "Rejected",
        bgColor: "bg-error-lighter",
        textColor: "text-error-dark",
        borderColor: "border-error-light",
      };
    case "pending":
      return {
        icon: <RiTimeLine className={iconClass} />,
        label: "Pending",
        bgColor: "bg-faded-lighter",
        textColor: "text-text-sub-600",
        borderColor: "border-faded-light",
      };
    case "syncing":
      return {
        icon: <RiLoader4Line className={cn(iconClass, "animate-spin")} />,
        label: "Syncing",
        bgColor: "bg-information-lighter",
        textColor: "text-information-dark",
        borderColor: "border-information-light",
      };
    case "failed":
      return {
        icon: <RiErrorWarningLine className={iconClass} />,
        label: "Failed",
        bgColor: "bg-error-lighter",
        textColor: "text-error-dark",
        borderColor: "border-error-light",
      };
    default:
      return {
        icon: <RiTimeLine className={iconClass} />,
        label: status,
        bgColor: "bg-faded-lighter",
        textColor: "text-text-sub-600",
        borderColor: "border-faded-light",
      };
  }
}

/**
 * Get status color classes for inline use (without the full badge)
 */
export function getStatusColors(
  status: WorkStatus | string,
  variant: "semantic" | "default" = "default"
) {
  const normalizedStatus = (
    ["approved", "rejected", "pending", "syncing", "failed"].includes(status) ? status : "pending"
  ) as WorkStatus;
  const config = getStatusConfig(normalizedStatus, variant);
  return {
    bg: config.bgColor,
    text: config.textColor,
    border: config.borderColor,
    combined: cn(config.bgColor, config.textColor, config.borderColor),
  };
}

/**
 * Unified StatusBadge component for displaying work/approval status
 *
 * @example
 * // Client usage (default Tailwind colors)
 * <StatusBadge status="approved" />
 *
 * // Admin usage (semantic CSS variable tokens)
 * <StatusBadge status="approved" variant="semantic" />
 */
export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  className,
  showIcon = true,
  size = "md",
  variant = "default",
}) => {
  const config = getStatusConfig(status, variant);
  const textSize = size === "sm" ? "text-xs" : "text-sm";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-medium",
        config.bgColor,
        config.textColor,
        config.borderColor,
        textSize,
        className
      )}
    >
      {showIcon && config.icon}
      {config.label}
    </span>
  );
};
