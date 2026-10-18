import { DEFAULT_CHAIN_ID } from "@green-goods/shared/config/default-chain";
import { useInViewReveal } from "@green-goods/shared/hooks/ui/useInViewReveal";
import { usePublicCommitmentImpact } from "@green-goods/shared/hooks/public/usePublicCommitmentImpact";
import { useIntl } from "react-intl";
import { EditorialHeading, EditorialKicker, EditorialLede, EditorialLinkArrow } from "./atoms";
import { type PublicProofMarker, PublicProofMarkers } from "./PublicProofMarkers";

/**
 * Community commitment totals on the public Impact page. Counts include
 * offers and requests across every registered pool, including earlier seasons.
 * A failed read remains unavailable rather than appearing as an empty record.
 *
 * The band shows no money figure (QA review, 2026-10-12). The Agent reports confirmed
 * payouts to Gardens, but "funding" framed a mutual-aid record as a funding product
 * and the USD valuation is often unavailable. Bringing it back is a product decision.
 */
export function PublicCommitmentsBand({ chainId = DEFAULT_CHAIN_ID }: { chainId?: number }) {
  const { formatMessage, formatNumber } = useIntl();
  const { data, isLoading } = usePublicCommitmentImpact(chainId);
  const { ref, revealed } = useInViewReveal<HTMLElement>();

  const unavailable = data?.unavailableSources;
  // A query that settled without data (an unexpected throw above the
  // per-source guards) is a failed read for every marker, never a zero.
  const failed = !isLoading && data === undefined;
  const noneYet = formatMessage({ id: "public.pool.impact.noneYet", defaultMessage: "None yet" });

  const made: PublicProofMarker = {
    key: "made",
    label: formatMessage({
      id: "public.pool.impact.made.label",
      defaultMessage: "Promises made",
    }),
    note: formatMessage({
      id: "public.pool.impact.made.note",
      defaultMessage: "What members have offered or asked for across Green Goods.",
    }),
    loading: isLoading,
    unavailable: failed || data?.commitmentsMade === null || unavailable?.commitmentPools === true,
    ...countMarker(data?.commitmentsMade, formatNumber, noneYet),
  };

  const kept: PublicProofMarker = {
    key: "kept",
    label: formatMessage({
      id: "public.pool.impact.kept.label",
      defaultMessage: "Promises kept",
    }),
    note: formatMessage({
      id: "public.pool.impact.kept.note",
      defaultMessage: "Work carried out and confirmed by the people involved.",
    }),
    loading: isLoading,
    unavailable:
      failed || data?.commitmentsFulfilled === null || unavailable?.commitmentPools === true,
    ...countMarker(data?.commitmentsFulfilled, formatNumber, noneYet),
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
              defaultMessage: "§ 02: Promises",
            })}
          </EditorialKicker>
          <EditorialHeading id="public-impact-commitments-title" className="max-w-4xl">
            {formatMessage({
              id: "public.pool.impact.title",
              defaultMessage: "Promises within communities",
            })}
          </EditorialHeading>
        </header>

        {/* Markers sit directly on the linen (AD-8): the header's hairline
            opens the record, the footer line's hairline closes it. min-h keeps
            an unavailable or empty record holding its place (AD-11). */}
        <div className="mt-10 min-h-40">
          <EditorialLede className="mb-10 max-w-3xl">
            {formatMessage({
              id: "public.pool.impact.lifecycle",
              defaultMessage:
                "Planting trees, maintaining solar panels, sharing skills. The work of a Garden starts with what its community needs and what people can offer. Promises give that work a shared record: who will carry it out, when, and whether it was kept. Community members can follow what is happening in their Garden. Funders can see the work they help make possible.",
            })}
          </EditorialLede>
          <PublicProofMarkers layout="panel" markers={[made, kept]} unavailableDisplay="label" />
          {made.unavailable || kept.unavailable ? (
            <p role="status" className="mt-6 max-w-xl text-sm leading-relaxed text-text-sub-600">
              {formatMessage({
                id: "public.pool.impact.partial",
                defaultMessage: "Some figures are unavailable right now. Please check back soon.",
              })}
            </p>
          ) : null}
          <div className="mt-10 flex flex-col gap-5 border-t border-stroke-soft-200 pt-6 lg:flex-row lg:items-end lg:justify-between lg:gap-12">
            <EditorialLinkArrow to="/gardens" className="shrink-0 self-start lg:self-auto">
              {formatMessage({
                id: "public.pool.impact.seeGardens",
                defaultMessage: "See the Gardens",
              })}
            </EditorialLinkArrow>
          </div>
        </div>
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
