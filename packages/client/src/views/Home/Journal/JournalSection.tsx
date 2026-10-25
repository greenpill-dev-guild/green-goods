import { Button } from "@green-goods/shared/components/Button";
import type { ReactNode } from "react";

export interface JournalSectionProps {
  /** Title Case in English, sentence case in Spanish and Portuguese (decision 25). */
  title: string;
  /** The section's one link to its whole list, at the heading's end: See all, Open Your Work. */
  action?: { label: string; onClick: () => void };
  /** A quiet line under the heading, such as when an offline copy of the list was saved. */
  note?: string;
  /** The section is reading what it lists; its placeholder rows stand in meanwhile. */
  busy?: boolean;
  /**
   * `rows` stacks the items 12px apart; `carousel` runs them in one row that scrolls sideways
   * to the screen's edges, each snapping to the gutter, with the next one peeking.
   */
  layout?: "rows" | "carousel";
  /**
   * The section's rows, each an `li`, or the one row that stands for them while the section is
   * empty, loading or failed.
   */
  children: ReactNode;
  "data-component"?: string;
}

const LIST_LAYOUT = {
  rows: "flex flex-col gap-(--gg-list-gap) px-4",
  carousel:
    "flex snap-x snap-mandatory gap-(--gg-list-gap) overflow-x-auto overscroll-x-contain scroll-px-4 px-4 pb-1",
} as const;

/**
 * One section of Home's journal (PWA Home decisions 3 and 27): the heading, the section's link
 * at its end, then its rows as item cards 12px apart, or the carousel's cards in one row. Every
 * section on Home takes this frame, so their headings and rows line up.
 */
export function JournalSection({
  title,
  action,
  note,
  busy = false,
  layout = "rows",
  children,
  "data-component": component = "JournalSection",
}: JournalSectionProps) {
  return (
    <section
      data-component={component}
      aria-busy={busy ? true : undefined}
      className="flex flex-col"
    >
      <div className="flex min-h-12 items-center justify-between gap-3 px-4 pt-2">
        <h2 className="min-w-0 truncate type-title-sm text-text-strong-950" title={title}>
          {title}
        </h2>
        {action ? (
          <Button
            type="button"
            emphasis="tertiary"
            size="compact"
            className="shrink-0"
            onClick={action.onClick}
          >
            {action.label}
          </Button>
        ) : null}
      </div>
      {note ? <p className="px-4 pb-2 type-meta text-text-sub-600">{note}</p> : null}
      <ul className={LIST_LAYOUT[layout]}>{children}</ul>
    </section>
  );
}
