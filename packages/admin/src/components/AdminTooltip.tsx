import { type ReactNode, useState } from "react";
import { cn } from "@green-goods/shared";

interface AdminTooltipProps {
  content: string;
  children: ReactNode;
  className?: string;
}

export function AdminTooltip({ content, children, className }: AdminTooltipProps) {
  const [visible, setVisible] = useState(false);

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onFocus={() => setVisible(true)}
      onBlur={() => setVisible(false)}
    >
      {children}
      {visible && (
        <span
          role="tooltip"
          className={cn(
            "pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2",
            "max-w-[200px] rounded-[var(--m3-shape-xs)] px-2 py-1",
            "bg-[rgb(var(--m3-inverse-surface))] text-body-sm text-[rgb(var(--m3-inverse-on-surface))]",
            "animate-in fade-in-0 zoom-in-95 duration-100",
            className
          )}
        >
          {content}
        </span>
      )}
    </span>
  );
}
