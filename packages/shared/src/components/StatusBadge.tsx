import {
  RiCheckLine,
  RiCloseLine,
  RiErrorWarningLine,
  RiLoader4Line,
  RiTimeLine,
  RiUploadCloud2Line,
  RiWifiOffLine,
} from "@remixicon/react";
import React from "react";
import type { WorkDisplayStatus } from "../types/domain";
import { cn } from "../utils/styles/cn";

/** @deprecated Use `WorkDisplayStatus` from `@green-goods/shared` instead. */
export type WorkStatus = WorkDisplayStatus;

export interface StatusBadgeProps {
  status: WorkDisplayStatus;
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

function getStatusConfig(status: WorkDisplayStatus, variant: "semantic" | "default"): StatusConfig {
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
      case "uploading":
        return {
          icon: <RiUploadCloud2Line className={cn(iconClass, "animate-pulse")} />,
          label: "Uploading",
          bgColor: "bg-information-lighter",
          textColor: "text-information-dark",
          borderColor: "border-information-light",
        };
      case "sync_failed":
        return {
          icon: <RiErrorWarningLine className={iconClass} />,
          label: "Sync Failed",
          bgColor: "bg-error-lighter",
          textColor: "text-error-dark",
          borderColor: "border-error-light",
        };
      case "offline":
        return {
          icon: <RiWifiOffLine className={iconClass} />,
          label: "Offline",
          bgColor: "bg-bg-soft",
          textColor: "text-text-sub",
          borderColor: "border-stroke-soft",
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
    case "uploading":
      return {
        icon: <RiUploadCloud2Line className={cn(iconClass, "animate-pulse")} />,
        label: "Uploading",
        bgColor: "bg-information-lighter",
        textColor: "text-information-dark",
        borderColor: "border-information-light",
      };
    case "sync_failed":
      return {
        icon: <RiErrorWarningLine className={iconClass} />,
        label: "Sync Failed",
        bgColor: "bg-error-lighter",
        textColor: "text-error-dark",
        borderColor: "border-error-light",
      };
    case "offline":
      return {
        icon: <RiWifiOffLine className={iconClass} />,
        label: "Offline",
        bgColor: "bg-bg-soft",
        textColor: "text-text-sub",
        borderColor: "border-stroke-soft",
      };
    default:
      return {
        icon: <RiTimeLine className={iconClass} />,
        label: status,
        bgColor: "bg-warning-lighter",
        textColor: "text-warning-dark",
        borderColor: "border-warning-light",
      };
  }
}

/**
 * Get status color classes for inline use (without the full badge)
 */
export function getStatusColors(
  status: WorkDisplayStatus | string,
  variant: "semantic" | "default" = "default"
) {
  const validStatuses: WorkDisplayStatus[] = [
    "approved", "rejected", "pending", "syncing", "uploading", "sync_failed", "offline",
  ];
  const normalizedStatus = (
    validStatuses.includes(status as WorkDisplayStatus)
      ? status
      : "pending"
  ) as WorkDisplayStatus;
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
      role="status"
      aria-live="polite"
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
