import {
  RiAlertLine,
  RiArrowGoBackLine,
  RiArrowUpCircleLine,
  RiCheckLine,
  RiCloseCircleLine,
  RiCloseLine,
  RiInformationLine,
  RiLoader4Line,
  RiTimeLine,
  RiUploadCloud2Line,
  RiWifiOffLine,
} from "@remixicon/react";
import React from "react";
import type { WorkDisplayStatus } from "../types/domain";
import { cn } from "../utils/styles/cn";

/**
 * Conviction-voting status states. Per audit §5.5 + Tier 2d of the admin
 * design handoff. A proposal moves through these states based on weight
 * allocation and decay rather than discrete for/against votes.
 */
export type ConvictionStatus = "accruing" | "passing" | "funded" | "withdrawn" | "expired";

interface WorkStatusBadgeProps {
  status: WorkDisplayStatus;
  className?: string;
  showIcon?: boolean;
  size?: "sm" | "md";
  /** Use semantic CSS variable tokens (admin) vs hardcoded colors (client) */
  variant?: "semantic" | "default";
}

type GenericStatusVariant = "success" | "warning" | "error" | "info" | "neutral";

interface GenericStatusBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  className?: string;
  showIcon?: boolean;
  size?: "sm" | "md";
  variant?: GenericStatusVariant;
  icon?: React.ReactNode;
  status?: never;
  convictionStatus?: never;
}

interface ConvictionStatusBadgeProps {
  className?: string;
  showIcon?: boolean;
  size?: "sm" | "md";
  /** One of the five conviction-voting states. Auto-supplies icon + label. */
  convictionStatus: ConvictionStatus;
  /** Override the auto-supplied label (e.g. for translation). */
  label?: string;
  status?: never;
  variant?: never;
}

export type StatusBadgeProps =
  | WorkStatusBadgeProps
  | ConvictionStatusBadgeProps
  | GenericStatusBadgeProps;

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
          icon: <RiAlertLine className={iconClass} />,
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
        icon: <RiAlertLine className={iconClass} />,
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

function getGenericStatusConfig(variant: GenericStatusVariant): StatusConfig {
  const iconClass = "w-3 h-3";

  switch (variant) {
    case "success":
      return {
        icon: <RiCheckLine className={iconClass} />,
        label: "",
        bgColor: "bg-success-lighter",
        textColor: "text-success-dark",
        borderColor: "border-success-light",
      };
    case "warning":
      return {
        icon: <RiAlertLine className={iconClass} />,
        label: "",
        bgColor: "bg-warning-lighter",
        textColor: "text-warning-dark",
        borderColor: "border-warning-light",
      };
    case "error":
      return {
        icon: <RiCloseLine className={iconClass} />,
        label: "",
        bgColor: "bg-error-lighter",
        textColor: "text-error-dark",
        borderColor: "border-error-light",
      };
    case "info":
      return {
        icon: <RiInformationLine className={iconClass} />,
        label: "",
        bgColor: "bg-information-lighter",
        textColor: "text-information-dark",
        borderColor: "border-information-light",
      };
    default:
      return {
        icon: <RiTimeLine className={iconClass} />,
        label: "",
        bgColor: "bg-bg-soft",
        textColor: "text-text-sub",
        borderColor: "border-stroke-soft",
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
    "approved",
    "rejected",
    "pending",
    "syncing",
    "uploading",
    "sync_failed",
    "offline",
  ];
  const normalizedStatus = (
    validStatuses.includes(status as WorkDisplayStatus) ? status : "pending"
  ) as WorkDisplayStatus;
  const config = getStatusConfig(normalizedStatus, variant);
  return {
    bg: config.bgColor,
    text: config.textColor,
    border: config.borderColor,
    combined: cn(config.bgColor, config.textColor, config.borderColor),
  };
}

function getConvictionStatusConfig(state: ConvictionStatus): StatusConfig {
  const iconClass = "w-3 h-3";
  switch (state) {
    case "accruing":
      return {
        icon: <RiTimeLine className={iconClass} />,
        label: "Accruing",
        bgColor: "bg-information-lighter",
        textColor: "text-information-dark",
        borderColor: "border-information-light",
      };
    case "passing":
      return {
        icon: <RiArrowUpCircleLine className={iconClass} />,
        label: "Passing",
        bgColor: "bg-success-lighter",
        textColor: "text-success-dark",
        borderColor: "border-success-light",
      };
    case "funded":
      return {
        icon: <RiCheckLine className={iconClass} />,
        label: "Funded",
        bgColor: "bg-success-lighter",
        textColor: "text-success-dark",
        borderColor: "border-success-light",
      };
    case "withdrawn":
      return {
        icon: <RiArrowGoBackLine className={iconClass} />,
        label: "Withdrawn",
        bgColor: "bg-bg-soft",
        textColor: "text-text-sub",
        borderColor: "border-stroke-soft",
      };
    case "expired":
      return {
        icon: <RiCloseCircleLine className={iconClass} />,
        label: "Expired",
        bgColor: "bg-error-lighter",
        textColor: "text-error-dark",
        borderColor: "border-error-light",
      };
  }
}

function isWorkStatusProps(props: StatusBadgeProps): props is WorkStatusBadgeProps {
  return "status" in props && props.status !== undefined;
}

function isConvictionStatusProps(props: StatusBadgeProps): props is ConvictionStatusBadgeProps {
  return "convictionStatus" in props && props.convictionStatus !== undefined;
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
  className,
  showIcon = true,
  size = "md",
  variant,
  ...props
}) => {
  const textSize = size === "sm" ? "text-label-sm" : "text-label-md";
  const resolvedProps = { className, showIcon, size, variant, ...props } as StatusBadgeProps;

  if (isWorkStatusProps(resolvedProps)) {
    const workVariant = resolvedProps.variant ?? "default";
    const config = getStatusConfig(resolvedProps.status, workVariant);

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
  }

  if (isConvictionStatusProps(resolvedProps)) {
    const config = getConvictionStatusConfig(resolvedProps.convictionStatus);
    const label = resolvedProps.label ?? config.label;

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
        {label}
      </span>
    );
  }

  const genericProps = props as GenericStatusBadgeProps;
  const genericVariant = genericProps.variant ?? "neutral";
  const genericConfig = getGenericStatusConfig(genericVariant);
  const { icon, children, ...spanProps } = genericProps;
  const resolvedIcon = icon ?? genericConfig.icon;

  return (
    <span
      role="status"
      aria-live="polite"
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-medium",
        genericConfig.bgColor,
        genericConfig.textColor,
        genericConfig.borderColor,
        textSize,
        className
      )}
      {...spanProps}
    >
      {showIcon && resolvedIcon}
      {children}
    </span>
  );
};
