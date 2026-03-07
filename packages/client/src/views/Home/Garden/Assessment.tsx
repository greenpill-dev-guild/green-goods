import {
  DEFAULT_CHAIN_ID,
  getEASExplorerUrl,
  getTag,
  isValidAttestationId,
  resolveIPFSUrl,
  useGardenAssessments,
  useGardens,
} from "@green-goods/shared";
import { type FC, useMemo } from "react";
import { useIntl } from "react-intl";
import { useParams } from "react-router-dom";
import { Badge } from "@/components/Communication";
import { WorkViewSkeleton } from "@/components/Features/Work";
import { TopNav } from "@/components/Navigation";

type GardenAssessmentProps = {};

function formatAssessmentDate(value?: number | null): string | null {
  if (value === undefined || value === null || value === 0) return null;
  const timestamp = value > 10_000_000_000 ? value : value * 1000;
  return new Date(timestamp).toLocaleDateString();
}

export const GardenAssessment: FC<GardenAssessmentProps> = () => {
  const { id, assessmentId } = useParams<{ id: string; assessmentId: string }>();
  const intl = useIntl();
  const { data: gardens = [] } = useGardens(DEFAULT_CHAIN_ID);
  const { data: assessments = [] } = useGardenAssessments(id, DEFAULT_CHAIN_ID);

  const garden = gardens.find((entry) => entry.id === id) || null;
  const assessment = assessments.find((entry) => entry.id === assessmentId) || null;

  const metricsJson = useMemo(() => {
    if (!assessment?.metrics) return null;
    try {
      return JSON.stringify(assessment.metrics, null, 2);
    } catch {
      return JSON.stringify(assessment.metrics);
    }
  }, [assessment?.metrics]);

  const evidenceMedia = assessment?.evidenceMedia?.length
    ? assessment.evidenceMedia
    : (assessment?.attachments ?? [])
        .filter((attachment) => attachment.mimeType.startsWith("image/"))
        .map((attachment) => resolveIPFSUrl(attachment.cid));
  const reportDocuments = assessment?.reportDocuments?.length
    ? assessment.reportDocuments
    : (assessment?.attachments ?? [])
        .filter((attachment) => !attachment.mimeType.startsWith("image/"))
        .map((attachment) => resolveIPFSUrl(attachment.cid));
  const impactAttestations = assessment?.impactAttestations ?? [];
  const capitals = assessment?.capitals ?? [];
  const tags = assessment?.tags ?? [];
  const startDate = formatAssessmentDate(
    assessment?.startDate ?? assessment?.reportingPeriod.start ?? null
  );
  const endDate = formatAssessmentDate(
    assessment?.endDate ?? assessment?.reportingPeriod.end ?? null
  );

  if (!assessment)
    return (
      <article>
        <TopNav onBackClick={() => window.history.back()} />
        <div className="padded pt-16">
          <WorkViewSkeleton showMedia={false} showActions={false} numDetails={2} />
        </div>
      </article>
    );

  return (
    <article>
      <TopNav onBackClick={() => window.history.back()} />
      <div className="padded flex flex-col gap-8 pt-16">
        <header className="space-y-3">
          <p className="text-xs uppercase tracking-wide text-text-sub-600">
            {garden?.name ?? assessment.gardenAddress}
          </p>
          <h1 className="text-2xl font-semibold text-text-strong-950">{assessment.title}</h1>
          <p className="text-sm text-text-sub-600">{assessment.description}</p>
          <div className="flex flex-wrap gap-2">
            <Badge tint="primary" variant="pill">
              {assessment.assessmentType ||
                intl.formatMessage({ id: "app.garden.assessments.title" })}
            </Badge>
            {capitals.map((capital) => (
              <Badge key={`${assessment.id}-${capital}`} variant="pill" tint="tertiary">
                {capital}
              </Badge>
            ))}
          </div>
          <div className="text-xs text-text-sub-600">
            {startDate || endDate
              ? [startDate, endDate].filter(Boolean).join(" — ")
              : "Date not set"}
            {" · "}
            {assessment.location || "Location not provided"}
          </div>
          {tags.length ? (
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => (
                <Badge key={`${assessment.id}-${tag}`} variant="pill" tint="primary">
                  {getTag(intl, tag)}
                </Badge>
              ))}
            </div>
          ) : null}
        </header>

        <section className="space-y-3 rounded-xl border border-stroke-soft-200 bg-bg-white-0 p-4 shadow-sm">
          <h2 className="text-base font-semibold text-text-strong-950">
            {intl.formatMessage({ id: "app.garden.assessments.metrics" })}
          </h2>
          {metricsJson ? (
            <pre className="max-h-96 overflow-auto rounded-lg bg-bg-surface-800/90 p-4 text-xs text-slate-100">
              {metricsJson}
            </pre>
          ) : (
            <p className="text-sm text-text-sub-600">
              {intl.formatMessage({ id: "app.garden.assessments.noMetrics" })}
            </p>
          )}
        </section>

        <section className="space-y-3 rounded-xl border border-stroke-soft-200 bg-bg-white-0 p-4 shadow-sm">
          <h2 className="text-base font-semibold text-text-strong-950">
            {intl.formatMessage({ id: "app.garden.assessments.evidence" })}
          </h2>
          {evidenceMedia.length ? (
            <ul className="space-y-2 text-sm text-green-700">
              {evidenceMedia.map((media, index) => (
                <li key={`${assessment.id}-evidence-${index}`}>
                  <a
                    href={media}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 hover:underline"
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

        <section className="space-y-3 rounded-xl border border-stroke-soft-200 bg-bg-white-0 p-4 shadow-sm">
          <h2 className="text-base font-semibold text-text-strong-950">
            {intl.formatMessage({ id: "app.garden.assessments.documents" })}
          </h2>
          {reportDocuments.length ? (
            <ul className="space-y-2 text-sm text-green-700">
              {reportDocuments.map((doc, index) => (
                <li key={`${assessment.id}-document-${index}`}>
                  <a
                    href={doc}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:underline"
                  >
                    {doc}
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-text-sub-600">
              {intl.formatMessage({ id: "app.garden.assessments.noDocuments" })}
            </p>
          )}
        </section>

        <section className="space-y-3 rounded-xl border border-stroke-soft-200 bg-bg-white-0 p-4 shadow-sm">
          <h2 className="text-base font-semibold text-text-strong-950">
            {intl.formatMessage({ id: "app.garden.assessments.impactAttestations" })}
          </h2>
          {impactAttestations.length ? (
            <ul className="space-y-1 text-xs font-mono text-green-700">
              {impactAttestations.map((uid) => (
                <li key={`${assessment.id}-${uid}`}>
                  {isValidAttestationId(uid) ? (
                    <a
                      href={getEASExplorerUrl(DEFAULT_CHAIN_ID, uid)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:underline"
                    >
                      {uid}
                    </a>
                  ) : (
                    <span>{uid}</span>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-text-sub-600">
              {intl.formatMessage({ id: "app.garden.assessments.noImpactRefs" })}
            </p>
          )}
        </section>
      </div>
    </article>
  );
};
