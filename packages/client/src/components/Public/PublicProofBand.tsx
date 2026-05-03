import { useInViewReveal } from "@green-goods/shared";
import { useIntl } from "react-intl";
import { EditorialHeading, EditorialKicker, EditorialLede, EditorialLinkArrow } from "./atoms";

export interface PublicProofBandProps {
  gardens: number;
  contributors: number;
  works: number;
  assessments: number;
  isLoading?: boolean;
}

interface ProofMarkerProps {
  value: number;
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
  const { formatMessage } = useIntl();
  const formatted = isLoading ? "..." : new Intl.NumberFormat().format(value);
  return (
    <div>
      <p className="font-serif text-5xl font-normal leading-none tracking-[-0.025em] text-text-strong-950 md:text-6xl">
        {formatted}
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
 * band on the warm linen surface. Treats numerals as public proof, not KPI
 * tiles — no card chrome, no shadows, no domain coloring. Link arrows out to
 * `/impact` for the evidence view.
 */
export function PublicProofBand({
  gardens,
  contributors,
  works,
  assessments,
  isLoading = false,
}: PublicProofBandProps) {
  const { formatMessage } = useIntl();
  const { ref: sectionRef, revealed } = useInViewReveal<HTMLElement>();

  return (
    <section
      ref={sectionRef}
      data-revealed={revealed}
      className="editorial-section-reveal bg-editorial-warm px-6 py-20 sm:px-10 md:py-28"
      aria-labelledby="public-proof-title"
    >
      <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[1fr_1.6fr] lg:gap-24">
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
              defaultMessage: "Quantifiable restoration.",
            })}
          </EditorialHeading>
          <div className="mt-5 max-w-md">
            <EditorialLede>
              {formatMessage({
                id: "public.home.proof.body",
                defaultMessage:
                  "This isn't a dashboard. These are confirmed counts: gardens attended, hands at work, entries logged, assessments held. Public, verifiable.",
              })}
            </EditorialLede>
          </div>
          <div className="mt-7">
            <EditorialLinkArrow to="/impact">
              {formatMessage({
                id: "public.home.proof.cta",
                defaultMessage: "View public evidence",
              })}
            </EditorialLinkArrow>
          </div>
        </div>

        <dl className="grid grid-cols-2 gap-x-12 gap-y-12 border-l border-stroke-soft-200 pl-12 sm:gap-x-16 lg:pl-16">
          <ProofMarker
            value={gardens}
            isLoading={isLoading}
            labelId="public.home.proof.gardens"
            defaultLabel="Gardens attended"
            noteId="public.home.proof.gardensNote"
            defaultNote="Active places under continuous documentation."
          />
          <ProofMarker
            value={contributors}
            isLoading={isLoading}
            labelId="public.home.proof.contributors"
            defaultLabel="Hands at work"
            noteId="public.home.proof.contributorsNote"
            defaultNote="Gardeners with a role in at least one Garden. Each address counted once."
          />
          <ProofMarker
            value={works}
            isLoading={isLoading}
            labelId="public.home.proof.works"
            defaultLabel="Entries logged"
            noteId="public.home.proof.worksNote"
            defaultNote="Photos, soil cores, plantings, repairs, restorations, each timestamped."
          />
          <ProofMarker
            value={assessments}
            isLoading={isLoading}
            labelId="public.home.proof.assessments"
            defaultLabel="Assessments held"
            noteId="public.home.proof.assessmentsNote"
            defaultNote="Independent evaluator confirmations, anchored to a public reference."
          />
        </dl>
      </div>
    </section>
  );
}
