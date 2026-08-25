import type { Address } from "@green-goods/shared/types/domain";
import { formatAddress } from "@green-goods/shared/utils/app/text";
import { useEnsName } from "@green-goods/shared/hooks/blockchain/useEnsName";
// `getRelativeTimeParts` is not on the root barrel — only the declared
// `./utils` subpath exports it (shared rule 11: narrowest declared path).
import { getRelativeTimeParts } from "@green-goods/shared/utils/relativeTime";
import { RiImageLine } from "@remixicon/react";
import type { ReactNode } from "react";
import { type IntlShape, useIntl } from "react-intl";
import { EditorialLede } from "@/components/Public/atoms";

/**
 * Small pieces of the public Garden page. Split out of `GardenDetail.tsx` to
 * keep that file under the source-structure ceiling; they have no meaning
 * outside it.
 */

/**
 * Note author as plain text.
 *
 * Deliberately not `AddressDisplay`: that renders a `<button>` carrying a
 * popover tooltip whether or not the copy affordance is on, and the field-note
 * tile is itself a button. A button inside a button is invalid, and it breaks
 * the tile's own click and focus behaviour. `AddressDisplay` is still the right
 * primitive where it is not nested — the note dialog and the stewards row.
 */
export function NoteAuthor({ address }: { address: Address }) {
  const { data: ensName } = useEnsName(address);
  return <span>{formatAddress(address, { ensName, variant: "card" })}</span>;
}

/**
 * One cell of a record strip. A count whose source failed renders an em dash,
 * never `0` — an empty list from a failed read means "we don't know", and this
 * page is not entitled to publish that as zero.
 *
 * `strip` is the hero's four-up strip under the title; `panel` is the larger
 * numeral used inside an `EditorialPanel`, where the number sits beside a
 * sentence and carries the line on its own.
 */
const STAT_VALUE_CLASS = {
  strip: "mt-1 font-serif text-2xl text-text-strong-950",
  panel:
    "mt-2 font-serif text-3xl font-normal leading-none tracking-[-0.018em] tabular-nums text-text-strong-950 md:text-4xl",
} as const;

const STAT_PULSE_CLASS = {
  strip: "inline-block h-7 w-10 animate-pulse rounded-sm bg-stroke-soft-200",
  panel: "inline-block h-9 w-14 animate-pulse rounded-sm bg-stroke-soft-200",
} as const;

export function StatCell({
  label,
  value,
  loading,
  unavailable,
  size = "strip",
}: {
  label: string;
  /** Pre-formatted when a string (a percentage, a localized count). */
  value: number | string | undefined;
  loading: boolean;
  unavailable: boolean;
  size?: keyof typeof STAT_VALUE_CLASS;
}) {
  const { formatMessage } = useIntl();
  const unknownLabel = formatMessage({
    id: "public.gardenDetail.stats.unknown",
    defaultMessage: "Not available",
  });

  return (
    <div className={size === "panel" ? "min-w-0" : undefined}>
      <dt className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-soft-400">
        {label}
      </dt>
      <dd className={STAT_VALUE_CLASS[size]}>
        {unavailable ? (
          <>
            <span aria-hidden="true">—</span>
            <span className="sr-only">{unknownLabel}</span>
          </>
        ) : loading || value === undefined ? (
          <span className={STAT_PULSE_CLASS[size]} />
        ) : (
          value
        )}
      </dd>
    </div>
  );
}

export function SectionEmpty({ message }: { message: string }) {
  return <p className="mt-8 font-serif text-xl italic text-text-soft-400">{message}</p>;
}

/**
 * A failed read says so and offers a retry. Sections whose data comes from
 * the page-level detail query reload the page; a section with its own query
 * passes `onRetry` so only its sources are re-read and the rest of the page,
 * which rendered from reads that succeeded, is left alone.
 */
export function SectionNotice({
  message,
  onRetry = () => window.location.reload(),
  className = "mt-8 text-sm text-text-sub-600",
}: {
  message: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <p role="status" className={className}>
      {message}{" "}
      <button
        type="button"
        onClick={onRetry}
        className="border-b border-primary-action/35 pb-0.5 font-medium text-primary-action transition-colors hover:border-primary-action-hover hover:text-primary-action-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-action focus-visible:ring-offset-2"
      >
        <RetryLabel />
      </button>
    </p>
  );
}

function RetryLabel() {
  const { formatMessage } = useIntl();
  return <>{formatMessage({ id: "public.gardenDetail.retry", defaultMessage: "Try again" })}</>;
}

/**
 * Shown when a note has no media, or every image attempt failed. Distinct from
 * the surrounding `bg-editorial-warm` so it reads as a deliberate tile rather
 * than a hole — same treatment `PublicEvidenceCard` uses for the same case.
 */
export function NotePlaceholderTile() {
  return (
    <div className="flex h-full min-h-32 w-full flex-col items-center justify-center gap-3 bg-bg-weak-50 px-6 py-4 text-center">
      <RiImageLine aria-hidden="true" className="h-7 w-7 text-text-soft-400/60" />
    </div>
  );
}

export function TileSkeletonGrid() {
  return (
    <div aria-hidden="true" className="mt-12 grid grid-cols-1 gap-12 sm:grid-cols-2 lg:grid-cols-3">
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="flex flex-col gap-4">
          <div className="aspect-[3/2] w-full animate-pulse bg-editorial-warm" />
          <div className="h-5 w-3/4 animate-pulse rounded-sm bg-stroke-soft-200" />
          <div className="h-3 w-1/2 animate-pulse rounded-sm bg-stroke-soft-200" />
        </div>
      ))}
    </div>
  );
}

export function ListSkeleton({
  rows = 3,
  className = "mt-8 flex flex-col gap-4",
}: {
  rows?: number;
  className?: string;
}) {
  return (
    <div aria-hidden="true" className={className}>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="h-5 w-2/3 animate-pulse rounded-sm bg-stroke-soft-200" />
      ))}
    </div>
  );
}

/**
 * Localized relative timestamp for a field note.
 *
 * A plain formatter rather than a hook: custom hooks belong in
 * `@green-goods/shared`, and this is page-local formatting.
 *
 * Not the shared `formatRelativeTime`, which is English-only by design; this
 * pairs `getRelativeTimeParts` with react-intl so the value follows the active
 * locale, which this page needs in en/es/pt.
 */
export function formatNoteDate(intl: IntlShape, createdAt: number): string {
  const parts = getRelativeTimeParts(createdAt);
  if (!parts) {
    return intl.formatMessage({
      id: "public.gardenDetail.notes.justNow",
      defaultMessage: "Just now",
    });
  }
  return intl.formatRelativeTime(parts.value, parts.unit, { numeric: "auto" });
}

/**
 * Tier one of a commitments panel: the state sentence on the left (with an
 * optional aside — a retry notice, a one-line note), and whatever carries the
 * record on the right — the stat row, or a `PanelNote` when there is nothing
 * to count. Two-fifths to three-fifths on desktop so the numerals get the
 * wider column; stacked on narrow viewports.
 */
export function PanelLead({
  lede,
  aside,
  children,
}: {
  lede: ReactNode;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:gap-12">
      <div className="flex max-w-xl flex-col gap-4">
        {typeof lede === "string" ? <EditorialLede>{lede}</EditorialLede> : lede}
        {aside}
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

/**
 * Kicker plus an italic serif line — the site's own shape for "there is
 * nothing to count yet" (`PublicProofBand`), reused inside the panel so the
 * readiness and empty states read as composed rather than as a lone sentence.
 */
export function PanelNote({ kicker, children }: { kicker: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <p className="font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-text-soft-400">
        {kicker}
      </p>
      <p className="max-w-md font-serif text-xl italic leading-snug text-text-sub-600 md:text-2xl">
        {children}
      </p>
    </div>
  );
}

/**
 * Lifetime made and kept, plus the kept rate only when the public selector
 * publishes it. "Made" is accepted commitments; the rate is fulfilled over
 * due, never fulfilled over made. A failed read renders em dashes with a
 * screen-reader label, never `0`; a pending read renders pulse blocks under
 * the same labels so the frame does not jump when the numbers arrive.
 */
export function RecordStats({
  made,
  kept,
  rate,
  loading = false,
  unavailable = false,
}: {
  made?: bigint;
  kept?: bigint;
  /** Pre-formatted percentage; omitted below the publication threshold. */
  rate?: string;
  loading?: boolean;
  unavailable?: boolean;
}) {
  const { formatMessage, formatNumber } = useIntl();
  const cells: { key: string; label: string; value: string | undefined }[] = [
    {
      key: "made",
      label: formatMessage({
        id: "public.pool.garden.record.made",
        defaultMessage: "Commitments made",
      }),
      value: made === undefined ? undefined : formatNumber(made),
    },
    {
      key: "kept",
      label: formatMessage({ id: "public.pool.garden.record.kept", defaultMessage: "Kept" }),
      value: kept === undefined ? undefined : formatNumber(kept),
    },
  ];
  if (rate !== undefined) {
    cells.push({
      key: "rate",
      label: formatMessage({
        id: "public.pool.garden.record.keptRate",
        defaultMessage: "Kept rate",
      }),
      value: rate,
    });
  }
  return (
    <dl className="flex flex-wrap gap-x-10 gap-y-6 sm:gap-x-14">
      {cells.map((cell) => (
        <StatCell
          key={cell.key}
          size="panel"
          label={cell.label}
          value={cell.value}
          loading={loading}
          unavailable={unavailable}
        />
      ))}
    </dl>
  );
}
