import { useIntl } from "react-intl";
import { cn } from "../utils/styles/cn";
import { DOMAIN_CONFIG } from "../config/domain";
import type { Domain } from "../types/domain";

interface DomainBadgeProps {
  /** Unknown attestation values stay unlabelled rather than guessing a domain. */
  domain: number;
  size?: "sm" | "md";
  variant?: "badge" | "inline";
  className?: string;
}

export function DomainBadge({
  domain,
  size = "sm",
  variant = "badge",
  className,
}: DomainBadgeProps) {
  const { formatMessage } = useIntl();
  const config = DOMAIN_CONFIG[domain as Domain];
  if (!config) return null;

  const Icon = config.icon;

  // Record labels keep readable surface ink; the existing domain tint belongs
  // to the redundant icon, so colour never carries the meaning by itself.
  if (variant === "inline") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-2 text-label-sm font-medium text-text-sub-600",
          className
        )}
      >
        <span
          className={cn(
            "inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md",
            config.colors.bg,
            config.colors.text
          )}
          aria-hidden="true"
        >
          <Icon className="h-4 w-4" />
        </span>
        {formatMessage({ id: config.labelId })}
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full font-medium backdrop-blur-md",
        config.colors.bg,
        config.colors.text,
        size === "sm" ? "px-2.5 py-1 text-label-sm" : "px-3 py-1.5 text-label-md",
        className
      )}
    >
      <Icon className={size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5"} aria-hidden="true" />
      {formatMessage({ id: config.labelId })}
    </span>
  );
}
