import {
  cn,
  DEFAULT_CHAIN_ID,
  getEASExplorerUrl,
  getTag,
  useGardenPermissions,
  useGardens,
} from "@green-goods/shared";
import { type FC, useMemo } from "react";
import { useIntl } from "react-intl";
import { useParams } from "react-router-dom";
import { Badge } from "@/components/Communication";
import { WorkViewSkeleton } from "@/components/Features/Work";
import { TopNav } from "@/components/Navigation";
import { pwaStatusStyles } from "@/styles/pwaStatusStyles";

type GardenAssessmentProps = {};

export const GardenAssessment: FC<GardenAssessmentProps> = () => {
  const { id, assessmentId } = useParams<{ id: string; assessmentId: string }>();
  const { data: gardens = [] } = useGardens(DEFAULT_CHAIN_ID);
  const garden = gardens.find((g) => g.id === id) || null;
  const intl = useIntl();
  const { canManageGarden } = useGardenPermissions();
  const isOperatorView = garden ? canManageGarden(garden) : false;

  const assessment = garden?.assessments.find((assessment) => assessment.id === assessmentId);
  const metricsJson = useMemo(() => {
    if (!assessment?.metrics) return null;
    try {
      return JSON.stringify(assessment.metrics, null, 2);
    } catch {
      return JSON.stringify(assessment.metrics);
    }
  }, [assessment?.metrics]);

  const metricsSummary = useMemo(() => {
    if (!assessment?.metrics || typeof assessment.metrics !== "object") return [];
    return Object.entries(assessment.metrics as Record<string, unknown>).flatMap(([key, value]) => {
      if (value === null || value === undefined) return [];
      const display =
        typeof value === "string" || typeof value === "number" || typeof value === "boolean"
          ? String(value)
          : Array.isArray(value)
            ? value.map(String).join(", ")
            : null;
      if (!display) return [];
      const label = key.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase());
      return [{ label, value: display }];
    });
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
          <p className="mt-6 text-center text-sm text-text-sub-600">
            {intl.formatMessage({
              id: "app.garden.assessments.notFound",
              defaultMessage: "Assessment not found.",
            })}
          </p>
        </div>
      </article>
    );

  return (
    <article>
      <TopNav onBackClick={() => window.history.back()} />
      <div className="padded flex flex-col gap-8 pt-16">
        <header className="space-y-3">
          <p className="text-xs uppercase tracking-wide text-text-sub-600">{garden.name}</p>
          <h1 className="text-2xl font-semibold text-text-strong-950">{assessment.title}</h1>
          <p className="text-sm text-text-sub-600">{assessment.description}</p>
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
          <div className="text-xs text-text-sub-600">
            {startDate || endDate
              ? [startDate, endDate].filter(Boolean).join(" — ")
              : intl.formatMessage({
                  id: "app.garden.assessments.dateNotSet",
                  defaultMessage: "Date not set",
                })}
            {" · "}
            {assessment.location ||
              intl.formatMessage({
                id: "app.garden.assessments.locationNotProvided",
                defaultMessage: "Location not provided",
              })}
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

        <section className="space-y-3 rounded-xl border border-stroke-soft-200 bg-bg-white-0 p-4 shadow-sm">
          <h2 className="text-base font-semibold text-text-strong-950">
            {intl.formatMessage({ id: "app.garden.assessments.metrics" })}
          </h2>
          {metricsSummary.length === 0 && !metricsJson ? (
            <p className="text-sm text-text-sub-600">
              {intl.formatMessage({ id: "app.garden.assessments.noMetrics" })}
            </p>
          ) : isOperatorView && metricsJson ? (
            <pre className="max-h-96 overflow-auto rounded-lg bg-bg-surface-800/90 p-4 text-xs text-static-white">
              {metricsJson}
            </pre>
          ) : (
            <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {metricsSummary.map((row) => (
                <div
                  key={`${assessment.id}-metric-${row.label}`}
                  className="rounded-lg border border-stroke-soft-200 bg-bg-weak-50 p-3"
                >
                  <dt className="text-xs uppercase tracking-wide text-text-sub-600">{row.label}</dt>
                  <dd className="mt-1 text-sm text-text-strong-950">{row.value}</dd>
                </div>
              ))}
            </dl>
          )}
        </section>

        <section className="space-y-3 rounded-xl border border-stroke-soft-200 bg-bg-white-0 p-4 shadow-sm">
          <h2 className="text-base font-semibold text-text-strong-950">
            {intl.formatMessage({ id: "app.garden.assessments.evidence" })}
          </h2>
          {assessment.evidenceMedia.length ? (
            <ul className={cn("space-y-2 text-sm", pwaStatusStyles.primary.text)}>
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
            <p className="text-sm text-text-sub-600">
              {intl.formatMessage({ id: "app.garden.assessments.noEvidence" })}
            </p>
          )}
        </section>

        <section className="space-y-3 rounded-xl border border-stroke-soft-200 bg-bg-white-0 p-4 shadow-sm">
          <h2 className="text-base font-semibold text-text-strong-950">
            {intl.formatMessage({ id: "app.garden.assessments.documents" })}
          </h2>
          {assessment.reportDocuments.length ? (
            <ul className={cn("space-y-2 text-sm", pwaStatusStyles.primary.text)}>
              {assessment.reportDocuments.map((doc, index) => (
                <li key={`${assessment.id}-document-${index}`}>
                  <a
                    href={doc}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:underline"
                  >
                    {intl.formatMessage(
                      { id: "app.garden.assessments.documentItem" },
                      { index: index + 1 }
                    )}
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

        {isOperatorView && assessment.impactAttestations.length > 0 && (
          <section className="space-y-3 rounded-xl border border-stroke-soft-200 bg-bg-white-0 p-4 shadow-sm">
            <h2 className="text-base font-semibold text-text-strong-950">
              {intl.formatMessage({ id: "app.garden.assessments.impactAttestations" })}
            </h2>
            <ul className={cn("space-y-1 text-xs font-mono", pwaStatusStyles.primary.text)}>
              {assessment.impactAttestations.map((uid) => (
                <li key={`${assessment.id}-${uid}`}>
                  <a
                    href={getEASExplorerUrl(DEFAULT_CHAIN_ID, uid)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:underline"
                  >
                    {uid}
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </article>
  );
};
