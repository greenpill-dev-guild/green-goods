import { cn, iconButtonIconVariants, iconButtonVariants } from "@green-goods/shared";
import { RiArrowLeftLine } from "@remixicon/react";
import type { ReactNode } from "react";
import { useIntl } from "react-intl";
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
  toolbar,
  backLink,
  sticky,
  className,
  children,
}: PageHeaderProps) {
  const intl = useIntl();

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
              className={iconButtonVariants({ size: "sm" })}
              aria-label={
                backLink.label ??
                intl.formatMessage({ id: "app.wizard.back", defaultMessage: "Back" })
              }
            >
              <RiArrowLeftLine className={iconButtonIconVariants({ size: "sm" })} />
            </Link>
          ) : null}

          <div className="min-w-0 flex-1 space-y-0.5 sm:space-y-1">
            <h1 className="truncate font-heading text-label-lg text-text-strong sm:text-title-h6">
              {title}
            </h1>
            {description ? (
              <p className="line-clamp-2 text-paragraph-xs text-text-sub sm:text-paragraph-sm">
                {description}
              </p>
            ) : null}
            {metadata ? (
              <div className="text-paragraph-xs text-text-soft sm:text-paragraph-sm">
                {metadata}
              </div>
            ) : null}
          </div>
        </div>

        {actions ? (
          <div className="flex flex-shrink-0 items-center gap-1.5 sm:gap-2">{actions}</div>
        ) : null}
      </div>

      {toolbar ? <div className="mt-3 sm:mt-4">{toolbar}</div> : null}

      {children ? <div className="mt-3 sm:mt-4">{children}</div> : null}
    </header>
  );
}
