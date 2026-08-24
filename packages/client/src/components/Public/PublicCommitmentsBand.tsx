import {
  DEFAULT_CHAIN_ID,
  formatTokenAmount,
  getCampaignCookieJarPayoutAssets,
  useInViewReveal,
} from "@green-goods/shared";
import {
  selectPublicPromiseKeptRate,
  usePublicCommitmentImpact,
} from "@green-goods/shared/commitment-pooling";
import { useIntl } from "react-intl";
import {
  EditorialHeading,
  EditorialKicker,
  EditorialLede,
  EditorialLinkArrow,
  EditorialPanel,
} from "./atoms";
import { formatKeptRate } from "./keptRate";
import { type PublicProofMarker, PublicProofMarkers } from "./PublicProofMarkers";

/**
 * `/impact` § 02 — protocol-wide commitment aggregates (uiux-spec §7.3).
 *
 * The section header sits on the linen like § 01 and § 04; the record is one
 * `EditorialPanel` holding four markers in the § 01 proof-marker grammar —
 * Gardens with open pools, lifetime commitments fulfilled across every
 * registered pool, the share of taken-up commitments kept, and CCIP-confirmed G$
 * support — then one lifecycle sentence and a way into `/gardens` as the
 * panel's footer line. No per-garden table, comparison, or ordering of any
 * kind: public comparison drifts toward ranking (§7.4).
 *
 * Honesty rules this band enforces:
 * - every figure comes from `usePublicCommitmentImpact`, which returns `null`
 *   per source when its read failed; a null renders an em dash, never `0`;
 * - the kept share is published only when `selectPublicPromiseKeptRate`
 *   returns its `rate` branch (≥ 5 due, ≥ 3 distinct providers); below that
 *   the marker shows counts and no percentage is ever computed;
 * - "Support arrived" describes the confirmed total and nothing else —
 *   queued, dispatched, and executed-but-unacknowledged settlement never
 *   reach the figure because the aggregate read selects `CONFIRMED` only;
 * - the fulfilled figure is lifetime, not seasonal: a season is per-garden,
 *   so there is no protocol-wide season to scope to.
 */
export function PublicCommitmentsBand({ chainId = DEFAULT_CHAIN_ID }: { chainId?: number }) {
  const { formatMessage, formatNumber, locale } = useIntl();
  const { data, isLoading } = usePublicCommitmentImpact(chainId);
  const { ref, revealed } = useInViewReveal<HTMLElement>();

  const unavailable = data?.unavailableSources;
  // A query that settled without data (an unexpected throw above the
  // per-source guards) is a failed read for every marker, never a zero.
  const failed = !isLoading && data === undefined;
  const noneYet = formatMessage({ id: "public.pool.impact.noneYet", defaultMessage: "None yet" });

  const openPools: PublicProofMarker = {
    key: "open-pools",
    label: formatMessage({
      id: "public.pool.impact.openPools.label",
      defaultMessage: "Gardens with open pools",
    }),
    note: formatMessage({
      id: "public.pool.impact.openPools.note",
      defaultMessage: "Places where neighbours can offer and take up commitments today.",
    }),
    loading: isLoading,
    unavailable: failed || data?.openPoolCount === null || unavailable?.commitmentPools === true,
    ...countMarker(data?.openPoolCount, formatNumber, noneYet),
  };

  const fulfilled: PublicProofMarker = {
    key: "fulfilled",
    label: formatMessage({
      id: "public.pool.impact.fulfilled.label",
      defaultMessage: "Commitments fulfilled",
    }),
    note: formatMessage({
      id: "public.pool.impact.fulfilled.note",
      defaultMessage:
        "Lifetime, across every registered pool. Closing a pool never removes its record.",
    }),
    loading: isLoading,
    unavailable:
      failed || data?.commitmentsFulfilled === null || unavailable?.commitmentPools === true,
    ...countMarker(data?.commitmentsFulfilled, formatNumber, noneYet),
  };

  // The share depends on both the pool counters and the distinct-provider
  // aggregate. If either source failed the threshold cannot be evaluated, and
  // an aggregate that cannot be evaluated is unavailable, not counts-only.
  const keptInputs =
    data &&
    data.commitmentsFulfilled !== null &&
    data.commitmentsDue !== null &&
    data.distinctProviderCount !== null
      ? {
          commitmentsFulfilled: data.commitmentsFulfilled,
          commitmentsDue: data.commitmentsDue,
          distinctProviderCount: data.distinctProviderCount,
        }
      : null;
  const keptSelection = keptInputs ? selectPublicPromiseKeptRate(keptInputs) : null;
  const kept: PublicProofMarker = {
    key: "kept",
    label: formatMessage({
      id: "public.pool.impact.kept.label",
      defaultMessage: "Commitments kept",
    }),
    note:
      keptSelection?.kind === "rate"
        ? formatMessage({
            id: "public.pool.impact.kept.rateNote",
            defaultMessage:
              "Of every commitment taken up and not mutually released, the share confirmed as kept. Commitments still in progress count until they are kept.",
          })
        : formatMessage({
            id: "public.pool.impact.kept.countsOnlyNote",
            defaultMessage:
              "Of every commitment taken up and not mutually released, those confirmed as kept. A share is published once the record is large enough to describe fairly.",
          }),
    loading: isLoading,
    unavailable: !isLoading && keptSelection === null,
    ...(keptSelection?.kind === "rate"
      ? {
          value: formatKeptRate(formatNumber, keptSelection.rate.fulfilled, keptSelection.rate.due),
        }
      : keptSelection?.kind === "counts-only" && keptSelection.counts.due > 0n
        ? {
            value: formatMessage(
              { id: "public.pool.impact.kept.countsOnly", defaultMessage: "{fulfilled} of {due}" },
              {
                fulfilled: formatNumber(keptSelection.counts.fulfilled),
                due: formatNumber(keptSelection.counts.due),
              }
            ),
          }
        : {
            phrase: formatMessage({
              id: "public.pool.impact.kept.noneDue",
              defaultMessage: "None due yet",
            }),
          }),
  };

  // G$ metadata comes from the shared asset registry (symbol + decimals); the
  // figure is never rendered from base units or with guessed decimals. If the
  // registry ever lacks the asset, the figure is unavailable rather than wrong.
  const goodDollar = getCampaignCookieJarPayoutAssets(chainId).find(
    (asset) => asset.id === "gooddollar"
  );
  const confirmedTotal = data?.confirmedDisbursementTotal ?? null;
  const support: PublicProofMarker = {
    key: "support",
    label: formatMessage({
      id: "public.pool.impact.support.label",
      defaultMessage: "Support arrived",
    }),
    note: formatMessage({
      id: "public.pool.impact.support.note",
      defaultMessage:
        "G$ delivered to Gardens and confirmed on arrival. Support still on its way is not counted here.",
    }),
    loading: isLoading,
    unavailable: !isLoading && (confirmedTotal === null || !goodDollar),
    ...(confirmedTotal !== null && goodDollar
      ? confirmedTotal > 0n
        ? {
            value: `${formatTokenAmount(confirmedTotal, goodDollar.decimals, 2, locale)} ${goodDollar.symbol}`,
          }
        : { phrase: noneYet }
      : {}),
  };

  return (
    <section
      ref={ref}
      data-revealed={revealed}
      className="editorial-section-reveal bg-editorial-warm px-6 py-20 sm:px-10 md:py-28"
      aria-labelledby="public-impact-commitments-title"
    >
      <div className="editorial-cascade mx-auto max-w-7xl">
        <header className="border-b border-stroke-soft-200 pb-6">
          <EditorialKicker className="mb-5">
            {formatMessage({
              id: "public.pool.impact.kicker",
              defaultMessage: "§ 02: Commitments",
            })}
          </EditorialKicker>
          <EditorialHeading id="public-impact-commitments-title" className="max-w-4xl">
            {formatMessage({
              id: "public.pool.impact.title",
              defaultMessage: "Work that starts as a commitment kept.",
            })}
          </EditorialHeading>
        </header>

        <EditorialPanel className="mt-10">
          <PublicProofMarkers layout="panel" markers={[openPools, fulfilled, kept, support]} />
          {data?.partialData || failed ? (
            <p role="status" className="mt-6 max-w-xl text-sm leading-relaxed text-text-sub-600">
              {formatMessage({
                id: "public.pool.impact.partial",
                defaultMessage:
                  "Some commitment figures could not be loaded right now. Nothing is shown as zero in their place.",
              })}
            </p>
          ) : null}
          <div className="mt-8 flex flex-col gap-5 border-t border-stroke-soft-200 pt-6 lg:flex-row lg:items-end lg:justify-between lg:gap-12">
            <EditorialLede className="max-w-2xl">
              {formatMessage({
                id: "public.pool.impact.lifecycle",
                defaultMessage:
                  "A commitment is offered or asked for, taken up, worked, witnessed, and confirmed by an eligible confirmer, usually the person it was made to. Fulfilled commitments join a Garden's record and can anchor an Impact Certificate.",
              })}
            </EditorialLede>
            <EditorialLinkArrow to="/gardens" className="shrink-0 self-start lg:self-auto">
              {formatMessage({
                id: "public.pool.impact.seeGardens",
                defaultMessage: "See the Gardens",
              })}
            </EditorialLinkArrow>
          </div>
        </EditorialPanel>
      </div>
    </section>
  );
}

/**
 * Numeral or "none yet" phrase for a lifetime count. A `null` count is left to
 * the caller's `unavailable` flag; `undefined` means the read is still pending.
 */
function countMarker(
  count: bigint | null | undefined,
  formatNumber: (value: bigint) => string,
  noneYet: string
): Pick<PublicProofMarker, "value" | "phrase"> {
  if (count === null || count === undefined) return {};
  return count > 0n ? { value: formatNumber(count) } : { phrase: noneYet };
}
