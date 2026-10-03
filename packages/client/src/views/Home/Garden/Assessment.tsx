import { Alert } from "@green-goods/shared/components/Alert";
import { DEFAULT_CHAIN_ID } from "@green-goods/shared/config/default-chain";
import { useGardenAssessmentRecords } from "@green-goods/shared/hooks/assessment/useGardenAssessmentRecords";
import { useGardens } from "@green-goods/shared/hooks/blockchain/useBaseLists";
import { resolveIPFSUrl } from "@green-goods/shared/modules/data/ipfs/resolve";
import { formatReportingPeriod } from "@green-goods/shared/utils/time";
import type { FC } from "react";
import { useIntl } from "react-intl";
import { useParams } from "react-router-dom";
import { Badge } from "@/components/Communication";
import {
  CYNEFIN_LABEL_IDS,
  domainLabelId,
  outcomeMeasure,
} from "@/components/Features/Garden/assessmentDisplay";
import { WorkViewSkeleton } from "@/components/Features/Work";
import { TopNav } from "@/components/Navigation";

type GardenAssessmentProps = {};

export const GardenAssessment: FC<GardenAssessmentProps> = () => {
  const { id, assessmentId } = useParams<{ id: string; assessmentId: string }>();
  const { data: gardens = [], isLoading: gardensLoading } = useGardens(DEFAULT_CHAIN_ID);
  // Addresses arrive in either case: the list is checksummed and a link may be typed.
  const garden = gardens.find((candidate) => candidate.id.toLowerCase() === id?.toLowerCase());
  const { records, status, refreshFailed } = useGardenAssessmentRecords(
    garden?.id,
    DEFAULT_CHAIN_ID
  );
  const record = records.find((candidate) => candidate.summary.id === assessmentId);
  const intl = useIntl();

  if (!record || !garden) {
    // Still looking: the garden list, or this garden's assessments, have not arrived.
    const looking = gardensLoading || (Boolean(garden) && status === "pending");
    // An assessment missing from a list that could not be read, or could not be
    // refreshed, has not been shown to be missing.
    const unread = Boolean(garden) && (status === "error" || refreshFailed);
    const message = looking
      ? null
      : intl.formatMessage({
          id: unread ? "app.garden.assessments.loadError" : "app.garden.assessments.notFound",
        });
    return (
      <article>
        <TopNav onBackClick={() => window.history.back()} />
        <div className="padded pt-16">
          <WorkViewSkeleton showMedia={false} showActions={false} numDetails={2} />
          {message ? <p className="mt-6 text-center text-sm text-text-sub-600">{message}</p> : null}
        </div>
      </article>
    );
  }

  const { summary, detail } = record;
  const reportingPeriod =
    formatReportingPeriod(intl, summary.startDate, summary.endDate) ??
    intl.formatMessage({ id: "app.garden.assessments.dateNotSet" });
  const domainId = domainLabelId(summary.domain);
  const kernel = detail.status === "loaded" ? detail.value : null;

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
          <h1
            className="line-clamp-3 text-[2rem] font-bold text-text-strong-950"
            title={summary.title}
          >
            {summary.title}
          </h1>
          <p className="whitespace-pre-line text-sm text-text-sub-600">{summary.description}</p>
          <div className="flex flex-wrap gap-2">
            {domainId ? (
              <Badge tint="primary" variant="pill">
                {intl.formatMessage({ id: domainId })}
              </Badge>
            ) : null}
            {kernel && kernel.cynefinPhase !== null ? (
              <Badge tint="tertiary" variant="pill">
                {intl.formatMessage({ id: CYNEFIN_LABEL_IDS[kernel.cynefinPhase] })}
              </Badge>
            ) : null}
          </div>
          <p className="break-words text-xs text-text-sub-600">
            {reportingPeriod}
            {" · "}
            {summary.location ||
              intl.formatMessage({ id: "app.garden.assessments.locationNotProvided" })}
          </p>
        </header>

        {detail.status === "pending" ? (
          <div
            className="space-y-3 rounded-xl border border-stroke-soft-200 bg-bg-white-0 p-4 shadow-sm"
            aria-hidden="true"
          >
            <div className="h-4 w-28 animate-pulse rounded bg-bg-soft-200" />
            <div className="h-3 w-full animate-pulse rounded bg-bg-soft-200" />
            <div className="h-3 w-5/6 animate-pulse rounded bg-bg-soft-200" />
            <div className="h-3 w-2/3 animate-pulse rounded bg-bg-soft-200" />
          </div>
        ) : null}

        {/* The stored files could not be read. That is not an assessment with nothing recorded. */}
        {detail.status === "unavailable" ? (
          <Alert variant="warning">
            {intl.formatMessage({ id: "app.garden.assessments.detailUnavailable" })}
          </Alert>
        ) : null}

        {kernel ? (
          <>
            {kernel.diagnosis.trim() ? (
              <section className="space-y-3 rounded-xl border border-stroke-soft-200 bg-bg-white-0 p-4 shadow-sm">
                <h2 className="text-base font-semibold text-text-strong-950">
                  {intl.formatMessage({ id: "app.garden.assessments.diagnosis" })}
                </h2>
                <p className="whitespace-pre-line text-sm text-text-sub-600">{kernel.diagnosis}</p>
              </section>
            ) : null}

            <section className="space-y-3 rounded-xl border border-stroke-soft-200 bg-bg-white-0 p-4 shadow-sm">
              <h2 className="text-base font-semibold text-text-strong-950">
                {intl.formatMessage({ id: "app.garden.assessments.smartOutcomes" })}
              </h2>
              {kernel.smartOutcomes.length ? (
                <ul className="space-y-3">
                  {kernel.smartOutcomes.map((outcome, index) => (
                    <li
                      key={`${summary.id}-outcome-${index}`}
                      className="rounded-lg border border-stroke-soft-200 bg-bg-weak-50 p-3"
                    >
                      <p className="text-sm font-medium text-text-strong-950">
                        {outcome.description}
                      </p>
                      <p className="mt-1 text-xs text-text-sub-600">
                        {outcomeMeasure(intl, summary.domain, outcome)}
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
              {kernel.sdgTargets.length ? (
                <ul className="flex flex-wrap gap-2">
                  {kernel.sdgTargets.map((sdg) => (
                    <li key={`${summary.id}-sdg-${sdg}`}>
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
                {intl.formatMessage({ id: "app.garden.assessments.evidence" })}
              </h2>
              {kernel.evidenceCids.length ? (
                <ul className="space-y-2 text-sm">
                  {/* The upload keeps no file name, so each file is named by its place in the list. */}
                  {kernel.evidenceCids.map((cid, index) => (
                    <li key={`${summary.id}-evidence-${cid}`}>
                      <a
                        href={resolveIPFSUrl(cid)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-primary-on-surface hover:underline"
                      >
                        {intl.formatMessage(
                          { id: "app.garden.assessments.evidenceItem" },
                          { index: index + 1 }
                        )}
                      </a>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-text-sub-600">
                  {intl.formatMessage({ id: "app.garden.assessments.noEvidence" })}
                </p>
              )}
            </section>
          </>
        ) : null}
      </div>
    </article>
  );
};
