import { cn } from "@green-goods/shared";
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
  variant?: "default" | "canvas";
  /**
   * Filter bar (search, sort, tags) rendered between the title row and children.
   * Use this for list-view toolbars so `children` stays free for tabs.
   */
  toolbar?: ReactNode;
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
  variant = "default",
  toolbar,
  backLink,
  sticky,
  className,
  children,
}: PageHeaderProps) {
  const isCanvas = variant === "canvas";

  return (
    <header
      className={cn(
        isCanvas
          ? "bg-bg-white relative overflow-hidden rounded-[var(--admin-radius-xl)] border border-[rgb(var(--workspace-tint)/0.18)] px-4 py-4 shadow-regular-md sm:px-6 sm:py-5"
          : cn(
              "border-b border-stroke-soft px-4 py-3 sm:px-6 sm:py-4",
              sticky
                ? "bg-bg-white/90 supports-[backdrop-filter]:bg-bg-white/70 backdrop-blur-lg ring-1 ring-black/[0.04] dark:ring-white/[0.06]"
                : "bg-bg-white"
            ),
        sticky && "sticky top-14 z-sticky",
        className
      )}
    >
      <div className="flex min-w-0 items-start gap-3 sm:gap-4">
        {backLink ? (
          <Link
            to={backLink.to}
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border border-stroke-soft text-text-soft transition hover:text-text-sub active:scale-95 sm:h-10 sm:w-10"
            aria-label={backLink.label ?? "Go back"}
          >
            <RiArrowLeftLine className="h-5 w-5" />
          </Link>
        ) : null}

        <div
          className={cn("min-w-0 flex-1", isCanvas ? "space-y-1.5" : "space-y-0.5 sm:space-y-1")}
        >
          <h1
            className={cn(
              "truncate text-headline-lg font-semibold text-text-strong",
              !isCanvas && "text-lg sm:text-2xl"
            )}
            title={typeof title === "string" ? title : undefined}
          >
            {title}
          </h1>
          {description ? (
            <p
              className={cn(
                "line-clamp-2",
                isCanvas ? "text-body-lg text-text-sub" : "text-xs text-text-sub sm:text-sm"
              )}
              title={typeof description === "string" ? description : undefined}
            >
              {description}
            </p>
          ) : null}
          {metadata ? (
            <div
              className={cn(
                "text-text-soft",
                isCanvas ? "pt-1 text-xs sm:text-sm" : "text-xs sm:text-sm"
              )}
            >
              {metadata}
            </div>
          ) : null}
        </div>
      </div>

      {actions || toolbar ? (
        <div
          className={cn(
            "mt-3 flex flex-wrap items-center gap-3 sm:mt-4",
            isCanvas &&
              "rounded-[var(--radius-lg)] border border-[rgb(var(--workspace-tint)/0.14)] bg-[rgb(var(--workspace-tint)/0.06)] px-3 py-3 shadow-regular-sm"
          )}
        >
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3">{toolbar}</div>
          {actions ? (
            <div className="flex flex-shrink-0 flex-wrap items-center gap-1.5 sm:gap-2">
              {actions}
            </div>
          ) : null}
        </div>
      ) : null}

      {children ? (
        <div className={cn("mt-3 sm:mt-4", isCanvas && "border-t border-stroke-soft-200 pt-4")}>
          {children}
        </div>
      ) : null}
    </header>
  );
}
