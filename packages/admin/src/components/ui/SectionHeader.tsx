import type { ReactNode } from "react";

import { cn } from "./cn";

interface SectionHeaderProps {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

function SectionHeader({ title, description, action, className }: SectionHeaderProps) {
  return (
    <div className={cn("flex items-start justify-between gap-4", className)}>
      <div className="min-w-0">
        <h2 className="font-heading text-2xl font-bold text-text-strong">{title}</h2>
        {description && <p className="mt-1 text-sm text-text-sub">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export { SectionHeader };
export type { SectionHeaderProps };
