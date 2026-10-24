import { RiArrowUpDownLine, RiCloseLine, RiSearchLine } from "@remixicon/react";
import type { ReactNode } from "react";
import { useIntl } from "react-intl";
import { cn } from "../utils/styles/cn";

/** How the state reads: a calm mark, a warning, or a failure, which is announced. */
export type EmptyStateTone = "neutral" | "warning" | "error";

export interface EmptyStateProps {
  /** The glyph in the round tile; a spinning one while the content loads. */
  icon: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  /**
   * The surface's own button or buttons: the shared `Button` in the app, an `AdminButton` in the
   * cockpit, so the shared Button never renders there (Rule 18).
   */
  action?: ReactNode;
  tone?: EmptyStateTone;
  /**
   * Keep the mark and title fixed while the description and action grow below them: `sheet` at
   * the sheet tabs' upper-middle anchor (DL-036), `list` 32px under a list's header row, where
   * the list would start (DL-056). `center` centers the whole block in its space.
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

const PLACEMENT_CLASSES: Record<NonNullable<EmptyStateProps["placement"]>, string> = {
  center: "justify-center py-7",
  sheet: "justify-start pt-[clamp(3rem,13dvh,7rem)] pb-8",
  list: "justify-start pt-8 pb-8",
};

/**
 * The state block: what stands in for a list, a tab, a panel or a screen that is empty, loading,
 * failed or not ready. One anatomy on both surfaces (a round icon tile, the title, one
 * description and the surface's own action) whose sizes come from the type roles, so the app
 * draws it at its 16px density and the cockpit at its 14px one. The tile's calm color is the
 * surface's to set (`.gg-state-mark` in theme.css).
 */
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
      data-component="EmptyState"
      data-tone={tone}
      // A failed read replaces the content, so it is announced like any error.
      role={tone === "error" ? "alert" : undefined}
      className={cn(
        "flex min-h-[12rem] flex-col items-center gap-2 px-5 text-center",
        PLACEMENT_CLASSES[placement],
        className
      )}
    >
      {icon ? (
        <span data-slot="icon" className="gg-state-mark" data-tone={tone} aria-hidden="true">
          {icon}
        </span>
      ) : null}
      <Title
        data-slot="title"
        id={headingId}
        tabIndex={headingId ? -1 : undefined}
        className="max-w-sm type-title-md text-balance text-text-strong-950 scroll-mt-24 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-action"
      >
        {title}
      </Title>
      {description ? (
        <p data-slot="description" className="max-w-sm type-body text-pretty text-text-sub-600">
          {description}
        </p>
      ) : null}
      {action ? (
        <div data-slot="action" className="mt-1.5 flex w-full justify-center">
          {action}
        </div>
      ) : null}
    </div>
  );
}

export interface ListToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  children?: ReactNode;
  className?: string;
}

export function ListToolbar({
  search,
  onSearchChange,
  searchPlaceholder,
  children,
  className,
}: ListToolbarProps) {
  const intl = useIntl();
  const placeholder =
    searchPlaceholder ??
    intl.formatMessage({
      id: "app.admin.listToolbar.searchPlaceholder",
      defaultMessage: "Search...",
    });

  return (
    <div className={cn("flex flex-wrap items-center gap-3", className)}>
      <div className="relative min-w-0 flex-1 sm:max-w-xs">
        <RiSearchLine className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-soft" />
        <input
          type="text"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder={placeholder}
          aria-label={placeholder}
          className="h-9 w-full rounded-sm bg-bg-white pl-9 pr-8 type-field text-text-strong shadow-[var(--edge-rest)] placeholder:text-text-disabled transition-shadow duration-[var(--spring-effects-fast-duration)] focus:shadow-[var(--edge-focus)] focus:outline-none"
        />
        {search && (
          <button
            type="button"
            onClick={() => onSearchChange("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-text-soft hover:text-text-strong"
            aria-label={intl.formatMessage({
              id: "app.admin.listToolbar.clearSearch",
              defaultMessage: "Clear Search",
            })}
          >
            <RiCloseLine className="h-4 w-4" />
          </button>
        )}
      </div>
      {children ? <div className="flex flex-wrap items-center gap-2">{children}</div> : null}
    </div>
  );
}

export interface SortOption<T extends string> {
  value: T;
  label: string;
}

export interface SortSelectProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: SortOption<T>[];
  "aria-label"?: string;
  className?: string;
}

export function SortSelect<T extends string>({
  value,
  onChange,
  options,
  "aria-label": ariaLabel,
  className,
}: SortSelectProps<T>) {
  const intl = useIntl();
  const resolvedAriaLabel =
    ariaLabel ??
    intl.formatMessage({ id: "app.admin.sortSelect.sortBy", defaultMessage: "Sort by" });

  return (
    <div className={cn("relative", className)}>
      <RiArrowUpDownLine className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-soft" />
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as T)}
        aria-label={resolvedAriaLabel}
        className="h-9 cursor-pointer appearance-none rounded-lg border border-stroke-soft bg-bg-white pl-8 pr-8 text-sm text-text-strong focus:border-primary-base focus:outline-none focus:ring-1 focus:ring-primary-base"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
