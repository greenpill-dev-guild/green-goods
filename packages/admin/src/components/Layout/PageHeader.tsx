import { cn } from "@green-goods/shared";
import { RiArrowLeftLine } from "@remixicon/react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { AdminTooltip } from "../AdminTooltip";

type BackLinkConfig = {
  to: string;
  label?: string;
};

type PageHeaderProps = {
  title: string;
  /**
   * Optional 11px caps label rendered above the title (route name, breadcrumb,
   * stage context). Per Tier 2a of the admin design handoff — see audit §5
   * decision row "5.4.4 / IA". Use it to communicate *which* surface a member
   * is on without re-declaring chrome (Frontend Rule 17).
   */
  eyebrow?: ReactNode;
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
  eyebrow,
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
      data-component="PageHeader"
      data-surface={variant}
      className={cn(
        isCanvas
          ? "relative border-b px-0 pt-3 pb-2"
          : cn(
              "border-b px-4 py-3 sm:px-6 sm:py-4",
              sticky ? "bg-bg-white shadow-regular-sm" : "bg-bg-white"
            ),
        sticky &&
          (isCanvas
            ? "sticky top-14 z-sticky bg-[rgb(var(--admin-surface-0))]"
            : "sticky top-14 z-sticky"),
        className
      )}
      // Handoff DESIGN_NOTES § Tone system: page-header bottom hairline tones
      // to the active view (~18% saturation). Falls back to neutral hairline
      // when no [data-tone] ancestor.
      style={{
        borderBottomColor: "rgb(var(--tone-action, var(--neutral-800)) / 0.10)",
      }}
    >
      <div data-region="route-header-title" className="flex min-w-0 items-start gap-3 sm:gap-4">
        {backLink ? (
          <AdminTooltip content={backLink.label ?? "Go back"}>
            <Link
              to={backLink.to}
              className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border border-stroke-soft text-text-soft transition hover:text-text-sub active:scale-95 sm:h-10 sm:w-10"
              aria-label={backLink.label ?? "Go back"}
            >
              <RiArrowLeftLine className="h-5 w-5" />
            </Link>
          </AdminTooltip>
        ) : null}

        <div className={cn("min-w-0 flex-1", isCanvas ? "space-y-1" : "space-y-0.5 sm:space-y-1")}>
          {eyebrow ? (
            <div
              data-region="route-header-eyebrow"
              className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-text-soft"
            >
              {eyebrow}
            </div>
          ) : null}
          <h1
            className={cn(
              "truncate text-text-strong",
              isCanvas
                ? "text-[1.625rem] font-bold leading-tight tracking-[-0.01em] sm:text-[2rem] lg:text-[2.25rem]"
                : "text-lg font-semibold sm:text-2xl"
            )}
            title={typeof title === "string" ? title : undefined}
          >
            {title}
          </h1>
          {description ? (
            <p
              className={cn(
                "line-clamp-2 text-text-sub",
                isCanvas ? "text-sm sm:text-[0.9375rem]" : "text-xs sm:text-sm"
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

        {actions ? (
          <div
            data-region="route-header-actions"
            className="flex flex-shrink-0 flex-wrap items-center justify-end gap-1.5 sm:gap-2"
          >
            {actions}
          </div>
        ) : null}
      </div>

      {children ? (
        <div
          data-region="route-header-tabs"
          className={cn("mt-3 sm:mt-4", isCanvas && "border-t border-stroke-soft-200 pt-3")}
        >
          {children}
        </div>
      ) : null}

      {toolbar ? (
        <div
          data-region="route-header-toolbar"
          className={cn(
            "mt-2 flex flex-wrap items-center gap-3 border-t border-stroke-soft-200 pt-2 sm:mt-3 sm:pt-3",
            isCanvas && "bg-transparent"
          )}
        >
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3">{toolbar}</div>
        </div>
      ) : null}
    </header>
  );
}
