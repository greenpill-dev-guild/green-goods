// Command surface: a garden tab's status line and its filters, one row above the list.
import type { ReactNode } from "react";

/** The row box every state keeps, so a list and its loading, empty and failed states start at one place. */
const ROW = "mb-2 flex min-h-10 flex-wrap items-center gap-2";
/** The filters' side: they give way first, down to two 4rem floors and the gap between them. */
const FILTERS = "flex min-w-[8.5rem] flex-1 items-center justify-end gap-2";

interface GardenListHeaderProps {
  /** The count, or the offline line. It never gives way (DL-032). */
  status: string;
  /** A control that belongs with the status line, such as the pool's ⓘ, 4px after it. */
  statusAside?: ReactNode;
  /** Compact condensed selects, right-aligned. Only when even their floors don't fit do they wrap. */
  filters?: ReactNode;
}

/**
 * The header row of a garden tab's list (the Promises and Work tabs): the count
 * with anything that belongs to it, then the filters (DL-032).
 */
export function GardenListHeader({ status, statusAside, filters }: GardenListHeaderProps) {
  return (
    <div className={ROW} data-testid="garden-list-header">
      <div className="flex shrink-0 items-center gap-1">
        <p role="status" className="shrink-0 whitespace-nowrap text-sm text-text-sub-600">
          {status}
        </p>
        {statusAside}
      </div>
      {filters ? <div className={FILTERS}>{filters}</div> : null}
    </div>
  );
}

interface GardenListHeaderLoadingProps {
  /** A short line no wider than the count it becomes, so the filters don't move. */
  label: string;
  /** The rest of the sentence, for screen readers. */
  srLabel: string;
  /** Each filter's default option, which sizes its placeholder exactly as the select sizes itself. */
  placeholders: string[];
}

/**
 * The header row while its list loads (D28): the status where the count lands
 * and a placeholder in each filter's place, sized by the same label and inset
 * as the compact condensed select that replaces it.
 */
export function GardenListHeaderLoading({
  label,
  srLabel,
  placeholders,
}: GardenListHeaderLoadingProps) {
  return (
    <div className={ROW} data-testid="garden-list-header-loading">
      <p role="status" className="shrink-0 whitespace-nowrap text-sm text-text-sub-600">
        {label}
        <span className="sr-only"> {srLabel}</span>
      </p>
      <div className={`${FILTERS} animate-pulse`} aria-hidden="true">
        {placeholders.map((text) => (
          <span
            key={text}
            className="block h-8 min-w-16 max-w-48 select-none overflow-hidden whitespace-nowrap rounded-[var(--radius-lg)] bg-bg-soft-200 ps-[calc(0.625rem+1px)] pe-[calc(1.75rem+1px)] text-[length:var(--gg-label-sm)] leading-8"
          >
            {/* The label sizes the placeholder and is never seen. */}
            <span className="invisible">{text}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

/** The header row's space with nothing in it, so a state that has no count still starts where the list would. */
export function GardenListHeaderSpace() {
  return (
    <div className="mb-2 min-h-10" aria-hidden="true" data-testid="garden-list-header-space" />
  );
}
