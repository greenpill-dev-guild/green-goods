import { useInViewReveal } from "@green-goods/shared/hooks/ui/useInViewReveal";
import { useIntl } from "react-intl";
import {
  EditorialHeading,
  EditorialKicker,
  EditorialLede,
  EditorialLinkArrow,
  EditorialStatSkeleton,
} from "./atoms";

/** A `null` count could not be read: it renders as an em dash, never as zero. */
export interface PublicProofBandProps {
  gardens: number | null;
  contributors: number | null;
  works: number | null;
  assessments: number | null;
  commitmentsMade: number | null;
  commitmentsKept: number | null;
  /** The record counts (Gardens through Assessments) are still loading. */
  isLoading?: boolean;
  /** The commitment counts come from a separate read and settle on their own. */
  isCommitmentsLoading?: boolean;
}

interface ProofMarkerProps {
  value: number | null;
  isLoading: boolean;
  labelId: string;
  defaultLabel: string;
  noteId: string;
  defaultNote: string;
}

function ProofMarker({
  value,
  isLoading,
  labelId,
  defaultLabel,
  noteId,
  defaultNote,
}: ProofMarkerProps) {
  const { formatMessage, formatNumber } = useIntl();
  return (
    <div>
      <p className="font-serif text-5xl font-normal leading-none tracking-[-0.025em] text-text-strong-950 md:text-6xl">
        {isLoading ? (
          <EditorialStatSkeleton className="h-12 w-24 md:h-14 md:w-28" />
        ) : value === null ? (
          <>
            <span aria-hidden="true">—</span>
            <span className="sr-only">
              {formatMessage({
                id: "public.impact.proof.unavailable",
                defaultMessage: "Not available right now",
              })}
            </span>
          </>
        ) : (
          formatNumber(value)
        )}
      </p>
      <p className="mt-3 font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-text-soft-400">
        {formatMessage({ id: labelId, defaultMessage: defaultLabel })}
      </p>
      <p className="mt-2 max-w-[16rem] text-sm leading-[1.55] text-text-sub-600">
        {formatMessage({ id: noteId, defaultMessage: defaultNote })}
      </p>
    </div>
  );
}

/**
 * PublicProofBand — confirmed counts only. Editorial "Living Public Record"
 * band on the warm linen surface: what the listed Gardens have documented
 * (Gardens, members, approved submissions, Assessments) and what their members
 * have committed to (commitments made and kept, in the `/impact` band's words).
 * Treats numerals as public proof, not KPI tiles — no card chrome, no shadows,
 * no domain coloring. Link arrows out to `/impact` for the evidence view.
 */
export function PublicProofBand({
  gardens,
  contributors,
  works,
  assessments,
  commitmentsMade,
  commitmentsKept,
  isLoading = false,
  isCommitmentsLoading = false,
}: PublicProofBandProps) {
  const { formatMessage } = useIntl();
  const { ref: sectionRef, revealed } = useInViewReveal<HTMLElement>();
  const allEmpty =
    !isLoading &&
    !isCommitmentsLoading &&
    [gardens, contributors, works, assessments, commitmentsMade, commitmentsKept].every(
      (count) => count === 0
    );

  return (
    <section
      ref={sectionRef}
      data-revealed={revealed}
      className="editorial-section-reveal @container bg-editorial-warm px-6 py-20 sm:px-10 md:py-28"
      aria-labelledby="public-proof-title"
    >
      <div className="editorial-cascade mx-auto grid max-w-7xl gap-12 sm:gap-8 @min-[70rem]:grid-cols-[1fr_1.6fr] @min-[70rem]:gap-24">
        <div>
          <EditorialKicker className="mb-5">
            {formatMessage({
              id: "public.home.proof.kicker",
              defaultMessage: "§ 02: Living Public Record",
            })}
          </EditorialKicker>
          <EditorialHeading id="public-proof-title">
            {formatMessage({
              id: "public.home.proof.title",
              defaultMessage: "The public record so far.",
            })}
          </EditorialHeading>
          <div className="mt-5 max-w-md">
            <EditorialLede>
              {formatMessage({
                id: "public.home.proof.body",
                defaultMessage:
                  "What the Gardens listed here have documented and committed to. A steward's approval confirms a submission was reviewed; environmental outcomes need their own measurements and assessments.",
              })}
            </EditorialLede>
          </div>
          <div className="mt-7">
            <EditorialLinkArrow to="/impact">
              {formatMessage({
                id: "public.home.proof.cta",
                defaultMessage: "View Public Evidence",
              })}
            </EditorialLinkArrow>
          </div>
        </div>

        {allEmpty ? (
          <div className="flex flex-col justify-center border-l border-stroke-soft-200 pl-12 sm:border-l-0 sm:border-t sm:pl-0 sm:pt-8 @min-[70rem]:border-t-0 @min-[70rem]:border-l @min-[70rem]:pl-16 @min-[70rem]:pt-0">
            <p className="font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-text-soft-400">
              {formatMessage({
                id: "public.home.proof.emptyKicker",
                defaultMessage: "Reading the record",
              })}
            </p>
            <p className="mt-3 max-w-md font-serif text-xl italic leading-snug text-text-sub-600 md:text-2xl">
              {formatMessage({
                id: "public.home.proof.empty",
                defaultMessage:
                  "The first records will appear here as Gardens publish their work, season by season.",
              })}
            </p>
          </div>
        ) : (
          <dl className="grid grid-cols-2 gap-x-12 gap-y-12 border-l border-stroke-soft-200 pl-12 sm:gap-8 sm:border-l-0 sm:border-t sm:pl-0 sm:pt-8 @min-[70rem]:grid-cols-3 @min-[70rem]:gap-x-16 @min-[70rem]:gap-y-12 @min-[70rem]:border-t-0 @min-[70rem]:border-l @min-[70rem]:pl-16 @min-[70rem]:pt-0">
            <ProofMarker
              value={gardens}
              isLoading={isLoading}
              labelId="public.home.proof.gardens"
              defaultLabel="Gardens"
              noteId="public.home.proof.gardensNote"
              defaultNote="Each with at least one approved submission."
            />
            <ProofMarker
              value={contributors}
              isLoading={isLoading}
              labelId="public.home.proof.contributors"
              defaultLabel="Garden members"
              noteId="public.home.proof.contributorsNote"
              defaultNote="Gardeners and stewards, each counted once."
            />
            <ProofMarker
              value={works}
              isLoading={isLoading}
              labelId="public.home.proof.works"
              defaultLabel="Approved submissions"
              noteId="public.home.proof.worksNote"
              defaultNote="Work reviewed by a Garden's stewards."
            />
            <ProofMarker
              value={assessments}
              isLoading={isLoading}
              labelId="public.home.proof.assessments"
              defaultLabel="Assessments"
              noteId="public.home.proof.assessmentsNote"
              defaultNote="Starting conditions, evidence standards, or progress."
            />
            <ProofMarker
              value={commitmentsMade}
              isLoading={isCommitmentsLoading}
              labelId="public.pool.impact.made.label"
              defaultLabel="Commitments made"
              noteId="public.pool.impact.made.note"
              defaultNote="What members have offered or asked for across Green Goods."
            />
            <ProofMarker
              value={commitmentsKept}
              isLoading={isCommitmentsLoading}
              labelId="public.pool.impact.kept.label"
              defaultLabel="Commitments kept"
              noteId="public.pool.impact.kept.note"
              defaultNote="Work carried out and confirmed by the people involved."
            />
          </dl>
        )}
      </div>
    </section>
  );
}
