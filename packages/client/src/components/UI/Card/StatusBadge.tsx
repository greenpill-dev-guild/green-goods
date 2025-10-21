import { cn } from "@green-goods/shared/utils";
import {
  RiCheckLine,
  RiCloseLine,
  RiErrorWarningLine,
  RiLoader4Line,
  RiTimeLine,
} from "@remixicon/react";
import React from "react";

export interface StatusBadgeProps {
  status: "approved" | "rejected" | "pending" | "syncing" | "failed";
  className?: string;
  showIcon?: boolean;
  size?: "sm" | "md";
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  className,
  showIcon = true,
  size = "md",
}) => {
  const getStatusConfig = () => {
    switch (status) {
      case "approved":
        return {
          tint: "primary" as const,
          icon: <RiCheckLine className="w-3 h-3" />,
          label: "Approved",
          bgColor: "bg-green-50",
          textColor: "text-green-700",
          borderColor: "border-green-200",
        };
      case "rejected":
        return {
          tint: "destructive" as const,
          icon: <RiCloseLine className="w-3 h-3" />,
          label: "Rejected",
          bgColor: "bg-red-50",
          textColor: "text-red-700",
          borderColor: "border-red-200",
        };
      case "pending":
        return {
          tint: "secondary" as const,
          icon: <RiTimeLine className="w-3 h-3" />,
          label: "Pending",
          bgColor: "bg-slate-50",
          textColor: "text-slate-700",
          borderColor: "border-slate-200",
        };
      case "syncing":
        return {
          tint: "neutral" as const,
          icon: <RiLoader4Line className="w-3 h-3 animate-spin" />,
          label: "Syncing",
          bgColor: "bg-blue-50",
          textColor: "text-blue-700",
          borderColor: "border-blue-200",
        };
      case "failed":
        return {
          tint: "destructive" as const,
          icon: <RiErrorWarningLine className="w-3 h-3" />,
          label: "Failed",
          bgColor: "bg-red-50",
          textColor: "text-red-700",
          borderColor: "border-red-200",
        };
      default:
        return {
          tint: "secondary" as const,
          icon: <RiTimeLine className="w-3 h-3" />,
          label: status,
          bgColor: "bg-slate-50",
          textColor: "text-slate-700",
          borderColor: "border-slate-200",
        };
    }
  };

  const config = getStatusConfig();
  const textSize = size === "sm" ? "text-xs" : "text-sm";

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-1 rounded-full border",
        config.bgColor,
        config.textColor,
        config.borderColor,
        textSize,
        "font-medium",
        className
      )}
    >
      {showIcon && config.icon}
      <span>{config.label}</span>
    </div>
  );
};
