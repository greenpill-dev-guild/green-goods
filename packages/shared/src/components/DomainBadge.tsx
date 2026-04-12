import { useIntl } from "react-intl";
import { cn } from "../utils/styles/cn";
import { DOMAIN_CONFIG } from "../config/domain";
import type { Domain } from "../types/domain";

interface DomainBadgeProps {
  domain: Domain;
  size?: "sm" | "md";
  className?: string;
}

export function DomainBadge({ domain, size = "sm", className }: DomainBadgeProps) {
  const { formatMessage } = useIntl();
  const config = DOMAIN_CONFIG[domain];
  if (!config) return null;

  const Icon = config.icon;

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
      <Icon className={size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5"} />
      {formatMessage({ id: config.labelId })}
    </span>
  );
}
