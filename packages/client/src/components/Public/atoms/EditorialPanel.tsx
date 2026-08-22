import { cn } from "@green-goods/shared";
import type { ReactNode } from "react";

export interface EditorialPanelProps {
  children: ReactNode;
  /** `article` when the panel is a self-contained record; `div` otherwise. */
  as?: "div" | "article";
  className?: string;
}

/**
 * The editorial dialect's one bounded surface: a white, hairline-bordered,
 * soft-shadowed panel sitting on the linen canvas. Square corners — the
 * dialect has no radius on surfaces. Same grammar as the `/fund` and
 * `/vaults` cards, lifted into an atom so a section body can carry a record
 * (numbers, rows, a footer line) as one composed object rather than loose
 * text on the canvas.
 *
 * It is a section body, not a side rail: the section header stays on the
 * canvas with its siblings, and the panel spans the full content width.
 */
export function EditorialPanel({ children, as: Tag = "div", className }: EditorialPanelProps) {
  return (
    <Tag
      className={cn(
        "border border-stroke-soft-200 bg-bg-white-0 p-5 shadow-[var(--shadow-editorial-card)] sm:p-6 lg:p-8",
        className
      )}
    >
      {children}
    </Tag>
  );
}
