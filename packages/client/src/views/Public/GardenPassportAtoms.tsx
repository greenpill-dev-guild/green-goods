import { Button } from "@green-goods/shared/components/Button";
import type { ReactNode } from "react";
import { useIntl } from "react-intl";
import { EditorialHeading } from "@/components/Public/atoms";
import { passportDate, passportIsoDate } from "./gardenPassportFormat";

/**
 * Small pieces of the garden passport page. The page is a record read line by line, in the
 * website's own grammar: hairlines, a serif figure, quiet supporting lines. Nothing is a card.
 */

/**
 * One line of the record: its name and how fresh it is on the left, what it holds on the right,
 * stacked on a phone. `as` sets the heading level so the ledger's lines sit under the page title
 * and a section's lines under its section heading.
 */
export function PassportLine({
  id,
  label,
  meta,
  as = "h3",
  children,
}: {
  id: string;
  label: string;
  meta?: ReactNode;
  as?: "h2" | "h3";
  children: ReactNode;
}) {
  return (
    <div
      role="group"
      aria-labelledby={id}
      className="grid gap-x-12 gap-y-4 border-t border-stroke-soft-200 py-8 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]"
    >
      <div className="flex flex-col gap-2">
        <EditorialHeading id={id} as={as} size="sub">
          {label}
        </EditorialHeading>
        {meta}
      </div>
      <div className="flex min-w-0 flex-col gap-3">{children}</div>
    </div>
  );
}

/** The line's main statement, in the serif the site uses for its figures. */
export function PassportFigure({ children }: { children: ReactNode }) {
  return (
    <p className="font-serif text-xl leading-snug text-text-strong-950 md:text-2xl">{children}</p>
  );
}

/** A supporting sentence under a figure. */
export function PassportNote({ children }: { children: ReactNode }) {
  return <p className="max-w-xl text-base leading-relaxed text-text-sub-600">{children}</p>;
}

/** Nothing on record yet: said quietly, never as a zero dressed up as a figure. */
export function PassportNothingYet({ children }: { children: ReactNode }) {
  return <p className="font-serif text-xl italic leading-snug text-text-soft-400">{children}</p>;
}

/**
 * The time window a line covers and when its record last changed. A line with no record yet
 * says so instead of printing a date.
 */
export function PassportFreshness({
  since,
  asOf,
}: {
  /** When the first counted record was written, in seconds. */
  since?: number | null;
  /** Newest change among the records the line reads, in seconds. */
  asOf: number | null;
}) {
  const intl = useIntl();
  const { formatMessage } = intl;
  if (asOf === null) {
    return (
      <p className="text-sm text-text-soft-400">
        {formatMessage({
          id: "public.passport.freshness.none",
          defaultMessage: "No records yet",
        })}
      </p>
    );
  }
  const day = (seconds: number) => (
    <time dateTime={passportIsoDate(seconds)}>{passportDate(intl, seconds)}</time>
  );
  return (
    <p className="text-sm leading-relaxed text-text-soft-400">
      {since
        ? formatMessage(
            {
              id: "public.passport.freshness.since",
              defaultMessage: "Since {since}. Last change on record {asOf}.",
            },
            { since: day(since), asOf: day(asOf) }
          )
        : formatMessage(
            {
              id: "public.passport.freshness.allTime",
              defaultMessage: "All time. Last change on record {asOf}.",
            },
            { asOf: day(asOf) }
          )}
    </p>
  );
}

/**
 * Where a line's figures come from, one tap away. A native disclosure: it opens by keyboard and
 * touch alike, needs no script, and keeps the definition out of the way of the figure.
 */
export function PassportSource({ children }: { children: ReactNode }) {
  const { formatMessage } = useIntl();
  return (
    <details className="group">
      <summary className="inline-flex min-h-11 cursor-pointer items-center text-sm font-medium text-primary-action underline underline-offset-4 transition-colors hover:text-primary-action-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-action">
        {formatMessage({
          id: "public.passport.source.summary",
          defaultMessage: "Where this comes from",
        })}
      </summary>
      <div className="mt-1 flex max-w-xl flex-col gap-2 text-sm leading-relaxed text-text-sub-600">
        {children}
      </div>
    </details>
  );
}

/** A line whose source could not be read. Unknown is never drawn as zero. */
export function PassportUnavailable({ onRetry }: { onRetry: () => void }) {
  const { formatMessage } = useIntl();
  return (
    <p role="status" className="text-base leading-relaxed text-text-sub-600">
      {formatMessage({
        id: "public.passport.unavailable",
        defaultMessage: "This part of the record could not be read just now.",
      })}{" "}
      <RetryAction onRetry={onRetry} />
    </p>
  );
}

/** An inline text action: underlined in the sentence, with the 48px hit area. */
function RetryAction({ onRetry }: { onRetry: () => void }) {
  const { formatMessage } = useIntl();
  return (
    <Button
      type="button"
      emphasis="tertiary"
      size="compact"
      onClick={onRetry}
      className="-my-2 px-1.5 underline"
    >
      {formatMessage({ id: "public.surface.retry", defaultMessage: "Try Again" })}
    </Button>
  );
}

/** Rows of one figure per exact unit label. Different labels never share a row or a total. */
export function PassportUnitRows({
  label,
  rows,
}: {
  /** Names the list for assistive technology. */
  label: string;
  rows: { unitLabel: string; value: string }[];
}) {
  if (rows.length === 0) return null;
  return (
    <dl aria-label={label} className="border-b border-stroke-soft-200">
      {rows.map((row) => (
        <div
          key={row.unitLabel}
          className="flex items-baseline justify-between gap-4 border-t border-stroke-soft-200 py-2.5 text-sm"
        >
          <dt className="truncate text-text-sub-600" title={row.unitLabel}>
            {row.unitLabel}
          </dt>
          <dd className="shrink-0 text-right font-mono text-xs tabular-nums text-text-strong-950">
            {row.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
