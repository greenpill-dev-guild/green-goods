import type React from "react";

import { Button, type ButtonProps } from "./Button";

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description?: string;
  action?: ButtonProps & { label: string };
}

function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-bg-soft text-text-soft">
        {icon}
      </div>
      <h3 className="text-base font-semibold text-text-strong">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-text-sub">{description}</p>}
      {action && (
        <Button className="mt-4" size="sm" {...action}>
          {action.label}
        </Button>
      )}
    </div>
  );
}

export { EmptyState };
export type { EmptyStateProps };
