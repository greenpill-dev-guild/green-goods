import { Button } from "@green-goods/shared/components/Button";
import type { ReactNode } from "react";

export interface JournalSectionProps {
  /** Title Case in English, sentence case in Spanish and Portuguese (decision 25). */
  title: string;
  /** The section's one link to its whole list, at the heading's end: See all, Open Your Work. */
  action?: { label: string; onClick: () => void };
  /** The section is reading what it lists; its placeholder rows stand in meanwhile. */
  busy?: boolean;
  /**
   * The section's rows, each an `li`, or the one row that stands for them while the section is
   * empty, loading or failed.
   */
  children: ReactNode;
  "data-component"?: string;
}

/**
 * One section of Home's journal (PWA Home decisions 3 and 27): the heading, the section's link
 * at its end, then its rows as item cards 12px apart. Every section on Home takes this frame,
 * so their headings and rows line up.
 */
export function JournalSection({
  title,
  action,
  busy = false,
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
      <ul className="flex flex-col gap-(--gg-list-gap) px-4">{children}</ul>
    </section>
  );
}
