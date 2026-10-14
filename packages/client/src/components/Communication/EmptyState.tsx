import { cn } from "@green-goods/shared/utils/styles/cn";
import type React from "react";

type EmptyStateTone = "neutral" | "warning" | "error";

export interface EmptyStateProps {
  icon: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  tone?: EmptyStateTone;
  /**
   * Keep the icon and title fixed while descriptions and actions grow below them:
   * `sheet` at the sheet tabs' upper-middle anchor, `list` 32px under a list's
   * header row, where a garden tab's list would start.
   */
  placement?: "center" | "sheet" | "list";
  className?: string;
  /**
   * The title's level where the page's outline needs another: `h1` when the state is the whole
   * page, `h2` directly under a page heading, as on the public reporting pages.
   */
  titleAs?: "h1" | "h2" | "h3";
  /**
   * Lets the page name itself by the state's title. A title the page names itself by can also be
   * given focus by the page, though never by the Tab key.
   */
  headingId?: string;
}

const toneClassNames: Record<EmptyStateTone, string> = {
  neutral: "border-stroke-soft-200 bg-bg-weak-50 text-primary-on-surface",
  warning: "border-warning-light bg-warning-lighter text-warning-base",
  error: "border-error-light bg-error-lighter text-error-base",
};

export function EmptyState({
  icon,
  title,
  description,
  action,
  tone = "neutral",
  placement = "center",
  className,
  titleAs: Title = "h3",
  headingId,
}: EmptyStateProps) {
  return (
    <div
      // A failed read replaces the content, so it is announced like any error.
      role={tone === "error" ? "alert" : undefined}
      className={cn(
        "flex min-h-[12rem] flex-col items-center px-6 text-center",
        placement === "sheet"
          ? "justify-start pt-[clamp(3rem,13dvh,7rem)] pb-8"
          : placement === "list"
            ? "justify-start pt-8 pb-8"
            : "justify-center py-8",
        className
      )}
    >
      <div
        className={cn(
          "flex h-12 w-12 items-center justify-center rounded-[var(--radius-lg)] border",
          toneClassNames[tone]
        )}
        aria-hidden="true"
      >
        <span className="flex items-center justify-center [&>svg]:h-6 [&>svg]:w-6">{icon}</span>
      </div>
      <div className="mt-3 max-w-sm">
        <Title
          id={headingId}
          tabIndex={headingId ? -1 : undefined}
          className="text-sm font-semibold text-text-strong-950 scroll-mt-24 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-action"
        >
          {title}
        </Title>
        {description ? (
          <p className="mt-1 text-sm leading-relaxed text-text-sub-600">{description}</p>
        ) : null}
      </div>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
