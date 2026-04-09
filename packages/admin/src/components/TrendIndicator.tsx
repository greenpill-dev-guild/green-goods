import { cn } from "@green-goods/shared";
import { RiArrowDownSLine, RiArrowUpSLine, RiSubtractLine } from "@remixicon/react";

interface TrendIndicatorProps {
  /** Positive = up, negative = down, 0 = flat */
  value: number;
  /** Optional suffix label, e.g. "vs last period" */
  label?: string;
}

export function TrendIndicator({ value, label }: TrendIndicatorProps) {
  const isUp = value > 0;
  const isDown = value < 0;

  const Icon = isUp ? RiArrowUpSLine : isDown ? RiArrowDownSLine : RiSubtractLine;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-xs font-medium",
        isUp && "text-success-dark",
        isDown && "text-error-dark",
        !isUp && !isDown && "text-text-soft"
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      <span className="tabular-nums">
        {isUp ? "+" : ""}
        {value}
      </span>
      {label && <span className="text-text-soft">{label}</span>}
    </span>
  );
}
