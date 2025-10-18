import { useMemo, type FC } from "react";
import { useParams } from "react-router-dom";
import { useGardens } from "@/hooks/blockchain/useBaseLists";
import { DEFAULT_CHAIN_ID } from "@/config/blockchain";
import { WorkViewSkeleton } from "@/components/UI/WorkView/WorkView";
import { TopNav } from "@/components/UI/TopNav/TopNav";
import { Badge } from "@/components/UI/Badge/Badge";
import getTag from "@/utils/app/tags";
import { useIntl } from "react-intl";

type GardenAssessmentProps = {};

export const GardenAssessment: FC<GardenAssessmentProps> = () => {
  const { id, assessmentId } = useParams<{ id: string; assessmentId: string }>();
  const { data: gardens = [] } = useGardens(DEFAULT_CHAIN_ID);
  const garden = gardens.find((g) => g.id === id) || null;
  const intl = useIntl();

  const assessment = garden?.assessments.find((assessment) => assessment.id === assessmentId);
  const metricsJson = useMemo(() => {
    if (!assessment?.metrics) return null;
    try {
      return JSON.stringify(assessment.metrics, null, 2);
    } catch {
      return JSON.stringify(assessment.metrics);
    }
  }, [assessment?.metrics]);

  const startDateValue = assessment?.startDate;
  const startDate =
    startDateValue !== undefined && startDateValue !== null
      ? new Date(
          startDateValue > 10_000_000_000 ? startDateValue : startDateValue * 1000
        ).toLocaleDateString()
      : null;
  const endDateValue = assessment?.endDate;
  const endDate =
    endDateValue !== undefined && endDateValue !== null
      ? new Date(
          endDateValue > 10_000_000_000 ? endDateValue : endDateValue * 1000
        ).toLocaleDateString()
      : null;

  if (!assessment || !garden)
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
          <p className="text-xs uppercase tracking-wide text-slate-500">
            {garden.title ?? garden.name}
          </p>
          <h1 className="text-2xl font-semibold text-slate-900">{assessment.title}</h1>
          <p className="text-sm text-slate-600">{assessment.description}</p>
          <div className="flex flex-wrap gap-2">
            <Badge tint="primary" variant="pill">
              {assessment.assessmentType ||
                intl.formatMessage({ id: "app.garden.assessments.title" })}
            </Badge>
            {assessment.capitals.map((capital) => (
              <Badge key={`${assessment.id}-${capital}`} variant="pill" tint="tertiary">
                {capital}
              </Badge>
            ))}
          </div>
          <div className="text-xs text-slate-500">
            {startDate || endDate
              ? [startDate, endDate].filter(Boolean).join(" — ")
              : "Date not set"}
            {" · "}
            {assessment.location || "Location not provided"}
          </div>
          {assessment.tags.length ? (
            <div className="flex flex-wrap gap-2">
              {assessment.tags.map((tag) => (
                <Badge key={`${assessment.id}-${tag}`} variant="pill" tint="primary">
                  {getTag(intl, tag)}
                </Badge>
              ))}
            </div>
          ) : null}
        </header>

        <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">
            {intl.formatMessage({ id: "app.garden.assessments.metrics" })}
          </h2>
          {metricsJson ? (
            <pre className="max-h-96 overflow-auto rounded-lg bg-slate-900/90 p-4 text-xs text-slate-100">
              {metricsJson}
            </pre>
          ) : (
            <p className="text-sm text-slate-500">
              {intl.formatMessage({ id: "app.garden.assessments.noMetrics" })}
            </p>
          )}
        </section>

        <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">
            {intl.formatMessage({ id: "app.garden.assessments.evidence" })}
          </h2>
          {assessment.evidenceMedia.length ? (
            <ul className="space-y-2 text-sm text-green-700">
              {assessment.evidenceMedia.map((media, index) => (
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
            <p className="text-sm text-slate-500">
              {intl.formatMessage({ id: "app.garden.assessments.noEvidence" })}
            </p>
          )}
        </section>

        <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">
            {intl.formatMessage({ id: "app.garden.assessments.documents" })}
          </h2>
          {assessment.reportDocuments.length ? (
            <ul className="space-y-2 text-sm text-green-700">
              {assessment.reportDocuments.map((doc, index) => (
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
            <p className="text-sm text-slate-500">
              {intl.formatMessage({ id: "app.garden.assessments.noDocuments" })}
            </p>
          )}
        </section>

        <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">
            {intl.formatMessage({ id: "app.garden.assessments.impactAttestations" })}
          </h2>
          {assessment.impactAttestations.length ? (
            <ul className="space-y-1 text-xs font-mono text-green-700">
              {assessment.impactAttestations.map((uid) => (
                <li key={`${assessment.id}-${uid}`}>
                  <a
                    href={`https://explorer.easscan.org/attestation/view/${uid}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:underline"
                  >
                    {uid}
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-500">
              {intl.formatMessage({ id: "app.garden.assessments.noImpactRefs" })}
            </p>
          )}
        </section>
      </div>
    </article>
  );
};
