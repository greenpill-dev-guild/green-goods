import { cn } from "@green-goods/shared";

interface AdminLinearProgressProps {
  value?: number;
  className?: string;
}

export function AdminLinearProgress({ value, className }: AdminLinearProgressProps) {
  const isIndeterminate = value === undefined;
  const clamped = isIndeterminate ? undefined : Math.min(100, Math.max(0, value));

  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={clamped}
      className={cn(
        "h-1 w-full overflow-hidden rounded-none bg-[rgb(var(--m3-surface-container-highest))]",
        className
      )}
    >
      <div
        className={cn(
          "h-full bg-[rgb(var(--m3-primary))]",
          isIndeterminate
            ? "w-1/3 animate-[m3-indeterminate_2s_linear_infinite]"
            : "transition-[width] duration-200"
        )}
        style={isIndeterminate ? undefined : { width: `${clamped}%` }}
      />
    </div>
  );
}
