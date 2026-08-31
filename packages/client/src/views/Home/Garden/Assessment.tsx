import type { CynefinPhase } from "@green-goods/shared/types/domain";
import { DEFAULT_CHAIN_ID } from "@green-goods/shared/config/default-chain";
import { DOMAIN_LABEL_IDS } from "@green-goods/shared/utils/garden-detail";
import { formatDateRange } from "@green-goods/shared/utils/time";
import { resolveIPFSUrl } from "@green-goods/shared/modules/data/ipfs/resolve";
import { useGardens } from "@green-goods/shared/hooks/blockchain/useBaseLists";
import type { FC } from "react";
import { useIntl } from "react-intl";
import { useParams } from "react-router-dom";
import { Badge } from "@/components/Communication";
import { WorkViewSkeleton } from "@/components/Features/Work";
import { TopNav } from "@/components/Navigation";

type GardenAssessmentProps = {};

const CYNEFIN_LABEL_IDS: Record<CynefinPhase, string> = {
  0: "app.garden.assessments.cynefin.clear",
  1: "app.garden.assessments.cynefin.complicated",
  2: "app.garden.assessments.cynefin.complex",
  3: "app.garden.assessments.cynefin.chaotic",
};

export const GardenAssessment: FC<GardenAssessmentProps> = () => {
  const { id, assessmentId } = useParams<{ id: string; assessmentId: string }>();
  const { data: gardens = [] } = useGardens(DEFAULT_CHAIN_ID);
  const garden = gardens.find((candidate) => candidate.id === id) || null;
  const assessment = garden?.assessments.find((candidate) => candidate.id === assessmentId);
  const intl = useIntl();

  if (!assessment || !garden) {
    return (
      <article>
        <TopNav onBackClick={() => window.history.back()} />
        <div className="padded pt-16">
          <WorkViewSkeleton showMedia={false} showActions={false} numDetails={2} />
          <p className="mt-6 text-center text-sm text-text-sub-600">
            {intl.formatMessage({ id: "app.garden.assessments.notFound" })}
          </p>
        </div>
      </article>
    );
  }

  const reportingPeriod = formatDateRange(
    assessment.reportingPeriod.start,
    assessment.reportingPeriod.end,
    intl.formatMessage({ id: "app.garden.assessments.dateNotSet" })
  );
  const domainLabel = intl.formatMessage({ id: DOMAIN_LABEL_IDS[assessment.domain] });
  const cynefinLabel = intl.formatMessage({ id: CYNEFIN_LABEL_IDS[assessment.cynefinPhase] });

  return (
    <article>
      <TopNav onBackClick={() => window.history.back()} />
      <div className="padded flex flex-col gap-8 pt-16">
        <header className="space-y-3">
          <p
            className="truncate text-xs uppercase tracking-wide text-text-sub-600"
            title={garden.name}
          >
            {garden.name}
          </p>
          <h1 className="title-screen line-clamp-3 text-text-strong-950" title={assessment.title}>
            {assessment.title}
          </h1>
          <p className="line-clamp-4 text-sm text-text-sub-600" title={assessment.description}>
            {assessment.description}
          </p>
          <div className="flex flex-wrap gap-2">
            <Badge tint="primary" variant="pill">
              {domainLabel}
            </Badge>
            <Badge tint="tertiary" variant="pill">
              {cynefinLabel}
            </Badge>
          </div>
          <p className="break-words text-xs text-text-sub-600">
            {reportingPeriod}
            {" · "}
            {assessment.location ||
              intl.formatMessage({ id: "app.garden.assessments.locationNotProvided" })}
          </p>
        </header>

        <section className="space-y-3 rounded-xl border border-stroke-soft-200 bg-bg-white-0 p-4 shadow-sm">
          <h2 className="text-base font-semibold text-text-strong-950">
            {intl.formatMessage({ id: "app.garden.assessments.diagnosis" })}
          </h2>
          <p className="whitespace-pre-line text-sm text-text-sub-600">{assessment.diagnosis}</p>
        </section>

        <section className="space-y-3 rounded-xl border border-stroke-soft-200 bg-bg-white-0 p-4 shadow-sm">
          <h2 className="text-base font-semibold text-text-strong-950">
            {intl.formatMessage({ id: "app.garden.assessments.smartOutcomes" })}
          </h2>
          {assessment.smartOutcomes.length ? (
            <ul className="space-y-3">
              {assessment.smartOutcomes.map((outcome, index) => (
                <li
                  key={`${assessment.id}-outcome-${index}`}
                  className="rounded-lg border border-stroke-soft-200 bg-bg-weak-50 p-3"
                >
                  <p className="text-sm font-medium text-text-strong-950">{outcome.description}</p>
                  <p className="mt-1 text-xs text-text-sub-600">
                    {intl.formatMessage(
                      { id: "app.garden.assessments.outcomeTarget" },
                      { target: outcome.target, metric: outcome.metric }
                    )}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-text-sub-600">
              {intl.formatMessage({ id: "app.garden.assessments.noSmartOutcomes" })}
            </p>
          )}
        </section>

        <section className="space-y-3 rounded-xl border border-stroke-soft-200 bg-bg-white-0 p-4 shadow-sm">
          <h2 className="text-base font-semibold text-text-strong-950">
            {intl.formatMessage({ id: "app.garden.assessments.sdgAlignment" })}
          </h2>
          {assessment.sdgTargets.length ? (
            <ul className="flex flex-wrap gap-2">
              {assessment.sdgTargets.map((sdg) => (
                <li key={`${assessment.id}-sdg-${sdg}`}>
                  <Badge variant="pill" tint="primary">
                    {intl.formatMessage(
                      { id: "app.garden.assessments.sdgItem" },
                      {
                        number: sdg,
                        label: intl.formatMessage({ id: `app.hypercerts.sdg.${sdg}` }),
                      }
                    )}
                  </Badge>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-text-sub-600">
              {intl.formatMessage({ id: "app.garden.assessments.noSdgTargets" })}
            </p>
          )}
        </section>

        <section className="space-y-3 rounded-xl border border-stroke-soft-200 bg-bg-white-0 p-4 shadow-sm">
          <h2 className="text-base font-semibold text-text-strong-950">
            {intl.formatMessage({ id: "app.garden.assessments.attachments" })}
          </h2>
          {assessment.attachments.length ? (
            <ul className="space-y-2 text-sm">
              {assessment.attachments.map((attachment) => (
                <li
                  key={`${assessment.id}-attachment-${attachment.cid}`}
                  className="flex flex-wrap items-baseline justify-between gap-2"
                >
                  <a
                    href={resolveIPFSUrl(attachment.cid)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-primary hover:underline"
                  >
                    {attachment.name}
                  </a>
                  <span className="text-xs text-text-sub-600">{attachment.mimeType}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-text-sub-600">
              {intl.formatMessage({ id: "app.garden.assessments.noAttachments" })}
            </p>
          )}
        </section>
      </div>
    </article>
  );
};
