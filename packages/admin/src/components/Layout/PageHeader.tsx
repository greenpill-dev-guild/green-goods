import { cn } from "@green-goods/shared/utils";
import { RiArrowLeftLine } from "@remixicon/react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";

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
        "border-b border-stroke-soft bg-bg-white px-4 py-3 sm:px-6 sm:py-4",
        sticky &&
          "sticky top-0 z-30 bg-bg-white/95 supports-[backdrop-filter]:bg-bg-white/70 backdrop-blur",
        className
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 sm:gap-4">
        <div className="flex min-w-0 flex-1 items-start gap-3 sm:gap-4">
          {backLink ? (
            <Link
              to={backLink.to}
              className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border border-stroke-soft text-text-soft transition hover:text-text-sub active:scale-95 sm:h-10 sm:w-10"
              aria-label={backLink.label ?? "Go back"}
            >
              <RiArrowLeftLine className="h-5 w-5" />
            </Link>
          ) : null}

          <div className="min-w-0 flex-1 space-y-0.5 sm:space-y-1">
            <h1 className="truncate text-lg font-semibold text-text-strong sm:text-2xl">{title}</h1>
            {description ? (
              <p className="line-clamp-2 text-xs text-text-sub sm:text-sm">{description}</p>
            ) : null}
            {metadata ? <div className="text-xs text-text-soft sm:text-sm">{metadata}</div> : null}
          </div>
        </div>

        {actions ? (
          <div className="flex flex-shrink-0 items-center gap-1.5 sm:gap-2">{actions}</div>
        ) : null}
      </div>

      {children ? <div className="mt-3 sm:mt-4">{children}</div> : null}
    </header>
  );
}
