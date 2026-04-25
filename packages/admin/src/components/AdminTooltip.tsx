import * as React from "react";
import { type ReactNode, useId, useState } from "react";
import { cn } from "@green-goods/shared";

interface AdminTooltipProps {
  content: string;
  children: ReactNode;
  className?: string;
}

export function AdminTooltip({ content, children, className }: AdminTooltipProps) {
  const [visible, setVisible] = useState(false);
  const tooltipId = useId();

  const trigger = React.isValidElement<{ "aria-describedby"?: string }>(children)
    ? React.cloneElement(children, {
        "aria-describedby":
          [children.props["aria-describedby"], visible ? tooltipId : undefined]
            .filter(Boolean)
            .join(" ") || undefined,
      })
    : children;

  return (
    <span
      data-component="AdminTooltip"
      className="relative inline-flex"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onFocus={() => setVisible(true)}
      onBlur={() => setVisible(false)}
    >
      {trigger}
      <span
        id={tooltipId}
        role="tooltip"
        aria-hidden={!visible}
        data-state={visible ? "open" : "closed"}
        className={cn(
          "pointer-events-none absolute bottom-full left-1/2 z-overlay mb-2 -translate-x-1/2",
          "max-w-[200px] rounded-[var(--m3-shape-xs)] px-2 py-1",
          "bg-[rgb(var(--m3-inverse-surface))] text-body-sm text-[rgb(var(--m3-inverse-on-surface))]",
          "transition-[opacity,transform] duration-[var(--spring-micro-duration)] ease-[var(--spring-micro-easing)]",
          visible ? "scale-100 opacity-100" : "scale-95 opacity-0",
          className
        )}
      >
        {content}
      </span>
    </span>
  );
}
