import * as React from "react";
import { type ReactNode, useId, useState } from "react";
import { cn } from "@green-goods/shared";

interface AdminTooltipProps {
  content: string;
  children: ReactNode;
  placement?: "top" | "bottom" | "bottom-start";
  className?: string;
}

const tooltipPlacementClass = {
  top: "bottom-full left-1/2 mb-2 -translate-x-1/2",
  bottom: "top-full left-1/2 mt-2 -translate-x-1/2",
  "bottom-start": "top-full left-0 mt-2",
} satisfies Record<NonNullable<AdminTooltipProps["placement"]>, string>;

export function AdminTooltip({
  content,
  children,
  placement = "top",
  className,
}: AdminTooltipProps) {
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
          "pointer-events-none absolute z-overlay",
          tooltipPlacementClass[placement],
          "max-w-[200px] rounded-[var(--m3-shape-xs)] px-2 py-1",
          "bg-[rgb(var(--m3-inverse-surface))] text-body-sm text-[rgb(var(--m3-inverse-on-surface))]",
          "transition-[opacity,transform] duration-[var(--spring-effects-fast-duration)] ease-[var(--spring-effects-fast-easing)]",
          visible ? "scale-100 opacity-100" : "scale-95 opacity-0",
          className
        )}
      >
        {content}
      </span>
    </span>
  );
}
