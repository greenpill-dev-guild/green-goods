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
   * Optional caps meta label (label-md, 12px) rendered above the title (route
   * name, breadcrumb, stage context). Per Tier 2a of the admin design handoff —
   * see audit §5 decision row "5.4.4 / IA". Use it to communicate *which*
   * surface a member is on without re-declaring chrome (Frontend Rule 17).
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

  const headerStyle = !isCanvas
    ? {
        borderBottomColor: "rgb(var(--tone-action, var(--neutral-800)) / 0.06)",
      }
    : sticky
      ? {
          background: "transparent",
          backdropFilter: "none",
          WebkitBackdropFilter: "none",
        }
      : undefined;

  return (
    <header
      data-component="PageHeader"
      data-surface={variant}
      className={cn(
        isCanvas
          ? "relative px-0 pt-3 pb-2"
          : cn(
              "border-b px-4 py-3 sm:px-6 sm:py-4",
              sticky ? "bg-bg-white shadow-regular-sm" : "bg-bg-white"
            ),
        sticky &&
          (isCanvas
            ? "page-header-canvas-sticky sticky top-14 z-sticky"
            : "sticky top-14 z-sticky"),
        className
      )}
      style={headerStyle}
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
              className="text-label-md font-semibold uppercase tracking-[0.08em] text-text-soft"
            >
              {eyebrow}
            </div>
          ) : null}
          {/* Title sits on the M3 scale: title-large (22/28) at weight 600 —
              no responsive display ramp (Cockpit M3 1a route header). */}
          <h1
            className="truncate text-title-lg font-semibold leading-[var(--type-title-lg-lh)] text-text-strong"
            title={typeof title === "string" ? title : undefined}
          >
            {title}
          </h1>
          {description ? (
            <p
              className={cn(
                "line-clamp-2 font-normal text-text-sub",
                isCanvas ? "text-body-md leading-5" : "text-xs sm:text-sm"
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
                isCanvas ? "pt-1 text-body-sm" : "text-xs sm:text-sm"
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
        // The tab rail carries its own hairline bottom rule (AdminTabRail);
        // no separator above it — 18px clear of the status line per the 1a spec.
        <div
          data-region="route-header-tabs"
          className={cn(isCanvas ? "mt-[18px]" : "mt-3 sm:mt-4")}
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
