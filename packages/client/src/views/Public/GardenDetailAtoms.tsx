import { type Address, formatAddress, useEnsName } from "@green-goods/shared";
// `getRelativeTimeParts` is not on the root barrel — only the declared
// `./utils` subpath exports it (shared rule 11: narrowest declared path).
import { getRelativeTimeParts } from "@green-goods/shared/utils";
import { RiImageLine } from "@remixicon/react";
import { type IntlShape, useIntl } from "react-intl";

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
 * primitive where it is not nested — the note dialog and the operators row.
 */
export function NoteAuthor({ address }: { address: Address }) {
  const { data: ensName } = useEnsName(address);
  return <span>{formatAddress(address, { ensName, variant: "card" })}</span>;
}

/**
 * One cell of the record strip. A count whose source failed renders an em dash,
 * never `0` — an empty list from a failed read means "we don't know", and this
 * page is not entitled to publish that as zero.
 */
export function StatCell({
  label,
  value,
  loading,
  unavailable,
}: {
  label: string;
  value: number | undefined;
  loading: boolean;
  unavailable: boolean;
}) {
  const { formatMessage } = useIntl();
  const unknownLabel = formatMessage({
    id: "public.gardenDetail.stats.unknown",
    defaultMessage: "Not available",
  });

  return (
    <div>
      <dt className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-soft-400">
        {label}
      </dt>
      <dd className="mt-1 font-serif text-2xl text-text-strong-950">
        {unavailable ? (
          <>
            <span aria-hidden="true">—</span>
            <span className="sr-only">{unknownLabel}</span>
          </>
        ) : loading || value === undefined ? (
          <span className="inline-block h-7 w-10 animate-pulse rounded-sm bg-stroke-soft-200" />
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
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <p role="status" className="mt-8 text-sm text-text-sub-600">
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

export function ListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div aria-hidden="true" className="mt-8 flex flex-col gap-4">
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
