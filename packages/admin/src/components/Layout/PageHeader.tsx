import { Link } from "react-router-dom";
import { RiArrowLeftLine } from "@remixicon/react";
import type { ReactNode } from "react";

import { cn } from "@green-goods/shared/utils";

type BackLinkConfig = {
  to: string;
  label?: string;
};

type PageHeaderProps = {
  title: string;
  description?: ReactNode;
  metadata?: ReactNode;
  actions?: ReactNode;
  backLink?: BackLinkConfig;
  sticky?: boolean;
  className?: string;
  /**
   * Additional content rendered beneath the primary header block.
   * Useful for tabs or contextual controls that should inherit the header styling.
   */
  children?: ReactNode;
};

export function PageHeader({
  title,
  description,
  metadata,
  actions,
  backLink,
  sticky,
  className,
  children,
}: PageHeaderProps) {
  return (
    <header
      className={cn(
        "border-b border-gray-200 bg-white px-6 py-4 dark:border-gray-700 dark:bg-gray-900",
        sticky &&
          "sticky top-0 z-30 bg-white/95 dark:bg-gray-900/95 supports-[backdrop-filter]:bg-white/70 dark:supports-[backdrop-filter]:bg-gray-900/70 backdrop-blur",
        className
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 flex-1 items-start gap-4">
          {backLink ? (
            <Link
              to={backLink.to}
              className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg border border-gray-200 text-gray-500 transition hover:text-gray-700 dark:border-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              aria-label={backLink.label ?? "Go back"}
            >
              <RiArrowLeftLine className="h-5 w-5" />
            </Link>
          ) : null}

          <div className="min-w-0 flex-1 space-y-1">
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">{title}</h1>
            {description ? (
              <p className="text-sm text-gray-600 dark:text-gray-400">{description}</p>
            ) : null}
            {metadata ? (
              <div className="text-sm text-gray-500 dark:text-gray-400">{metadata}</div>
            ) : null}
          </div>
        </div>

        {actions ? <div className="flex flex-shrink-0 items-center gap-2">{actions}</div> : null}
      </div>

      {children ? <div className="mt-4">{children}</div> : null}
    </header>
  );
}
