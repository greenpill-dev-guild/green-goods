import { useIntl } from "react-intl";

/**
 * One cell of an editorial stat band: mono uppercase label, Fraunces numeral,
 * one-sentence note. Shared by `/impact` § 01 proof markers and the § 02
 * commitments band so the two bands cannot drift apart in grammar.
 *
 * The value is pre-formatted by the caller (number, percentage, or token
 * amount) so this stays a presentation atom. Three honest non-numeral states,
 * each with a screen-reader label so a dash is never read as silence:
 * `loading` paints a quiet dash, `unavailable` paints an em dash (a failed
 * source is never published as zero), and `phrase` swaps the numeral for a
 * short italic sentence when there is genuinely nothing to count yet.
 */
export interface PublicProofMarker {
  /** Stable key; also the `dt` text when no `label` override is needed. */
  key: string;
  label: string;
  note: string;
  /** Formatted numeral. Ignored while `loading`, `unavailable`, or `phrase`. */
  value?: string;
  /** Italic phrase rendered instead of a numeral ("Not public yet"). */
  phrase?: string;
  loading?: boolean;
  unavailable?: boolean;
}

/**
 * `strip` is the § 01 proof-marker strip on the canvas: four across, the
 * page's largest numerals. `panel` is the same four markers inside an
 * `EditorialPanel`, at the panel numeral scale so the figures read as a
 * record beside prose rather than as a dashboard.
 */
const LAYOUT_CLASS = {
  strip: {
    list: "grid grid-cols-2 gap-x-6 gap-y-10 sm:gap-x-12 md:grid-cols-4 md:gap-x-16",
    value:
      "font-serif text-5xl font-normal leading-none tracking-[-0.025em] text-text-strong-950 md:text-6xl",
    phrase: "font-serif text-2xl italic text-text-soft-400",
  },
  panel: {
    list: "grid grid-cols-2 gap-x-8 gap-y-8 md:grid-cols-4 md:gap-x-10",
    value:
      "font-serif text-3xl font-normal leading-none tracking-[-0.018em] tabular-nums text-text-strong-950 md:text-4xl",
    phrase: "font-serif text-lg italic text-text-soft-400 md:text-xl",
  },
} as const;

export function PublicProofMarkers({
  markers,
  layout = "strip",
}: {
  markers: readonly PublicProofMarker[];
  layout?: keyof typeof LAYOUT_CLASS;
}) {
  const { formatMessage } = useIntl();
  const unavailableLabel = formatMessage({
    id: "public.impact.proof.unavailable",
    defaultMessage: "Not available right now",
  });
  const loadingLabel = formatMessage({
    id: "public.impact.proof.loading",
    defaultMessage: "Loading",
  });
  const classes = LAYOUT_CLASS[layout];
  return (
    <dl className={classes.list}>
      {markers.map(({ key, label, note, value, phrase, loading, unavailable }) => (
        <div key={key} className="flex min-w-0 flex-col gap-3">
          <dt className="font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-text-soft-400">
            {label}
          </dt>
          <dd className={classes.value}>
            {unavailable ? (
              <>
                <span aria-hidden="true">—</span>
                <span className="sr-only">{unavailableLabel}</span>
              </>
            ) : loading ? (
              <>
                <span aria-hidden="true">—</span>
                <span className="sr-only">{loadingLabel}</span>
              </>
            ) : phrase ? (
              <span className={classes.phrase}>{phrase}</span>
            ) : (
              value
            )}
          </dd>
          <p className="max-w-[22rem] text-sm leading-[1.55] text-text-sub-600 md:text-base">
            {note}
          </p>
        </div>
      ))}
    </dl>
  );
}
