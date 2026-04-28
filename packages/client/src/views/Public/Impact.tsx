import {
  type PublicImpactEvidenceRecord,
  usePublicImpactEvidence,
  usePublicStats,
} from "@green-goods/shared";
import { useMemo, useState } from "react";
import { useIntl } from "react-intl";
import { PublicSourceDialog } from "@/components/Public/PublicSourceDialog";

/**
 * Impact — credible public evidence ledger.
 *
 * Aggregate counts on top, evidence cards from `usePublicImpactEvidence`.
 * Each card opens a source-anchored dialog with assessment summary and
 * (when available) an EAS reference link.
 */
export default function ImpactPage() {
  const { formatMessage } = useIntl();
  const stats = usePublicStats();
  const evidence = usePublicImpactEvidence();
  const [activeRecord, setActiveRecord] = useState<PublicImpactEvidenceRecord | null>(null);

  const counts = stats.data ?? {
    gardenCount: 0,
    contributorCount: 0,
    fieldNoteCount: 0,
    attestationCount: 0,
  };

  const slice = evidence.data;

  const tiles = useMemo(
    () => [
      {
        labelId: "public.impact.totalAssessments",
        defaultLabel: "Total Assessments",
        value: counts.attestationCount,
      },
      {
        labelId: "public.impact.totalGardens",
        defaultLabel: "Total Gardens",
        value: counts.gardenCount,
      },
      {
        labelId: "public.impact.totalContributors",
        defaultLabel: "Total Contributors",
        value: counts.contributorCount,
      },
    ],
    [counts]
  );

  return (
    <div className="bg-bg-weak-50">
      <header className="mx-auto max-w-7xl px-6 pt-12 pb-6 sm:px-10 sm:pt-16">
        <p className="text-xs font-medium uppercase tracking-wide text-text-soft-400">
          {formatMessage({
            id: "public.impact.kicker",
            defaultMessage: "Public evidence ledger",
          })}
        </p>
        <h1 className="mt-2 font-serif text-3xl text-text-strong-950 md:text-5xl">
          {formatMessage({ id: "public.impact.title", defaultMessage: "Impact" })}
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-text-sub-600 md:text-base">
          {formatMessage({
            id: "public.impact.description",
            defaultMessage:
              "Confirmed counts and the most recent Assessments and evidence published across Gardens.",
          })}
        </p>
      </header>

      <section
        aria-labelledby="impact-stats-title"
        className="mx-auto max-w-7xl px-6 pb-10 sm:px-10"
      >
        <h2 id="impact-stats-title" className="sr-only">
          {formatMessage({ id: "public.impact.statsTitle", defaultMessage: "Impact stats" })}
        </h2>
        {stats.isLoading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-24 animate-pulse rounded-2xl bg-bg-white-0"
                aria-hidden="true"
              />
            ))}
          </div>
        ) : (
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {tiles.map(({ labelId, defaultLabel, value }) => (
              <div key={labelId} className="rounded-2xl bg-bg-white-0 p-5 shadow-sm">
                <dt className="text-xs font-medium uppercase tracking-wide text-text-soft-400">
                  {formatMessage({ id: labelId, defaultMessage: defaultLabel })}
                </dt>
                <dd className="mt-2 font-serif text-3xl text-text-strong-950 md:text-4xl">
                  {new Intl.NumberFormat().format(value)}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </section>

      <section
        aria-labelledby="impact-evidence-title"
        className="mx-auto max-w-7xl px-6 pb-16 sm:px-10"
      >
        <header className="border-y border-stroke-soft-200 py-4">
          <h2 id="impact-evidence-title" className="font-serif text-2xl text-text-strong-950">
            {formatMessage({
              id: "public.impact.evidence.title",
              defaultMessage: "Recent evidence",
            })}
          </h2>
        </header>

        {evidence.isLoading ? (
          <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="h-56 animate-pulse rounded-3xl bg-bg-white-0"
                aria-hidden="true"
              />
            ))}
          </div>
        ) : slice && slice.status === "error" ? (
          <p className="mt-8 rounded-2xl border border-stroke-soft-200 bg-bg-white-0 p-6 text-sm text-text-sub-600">
            {formatMessage({
              id: "public.impact.evidence.error",
              defaultMessage:
                "Evidence is temporarily unavailable. Please try again in a few minutes.",
            })}
          </p>
        ) : !slice || slice.records.length === 0 ? (
          <p className="mt-8 rounded-2xl border border-dashed border-stroke-soft-200 bg-bg-white-0 p-6 text-sm text-text-sub-600">
            {formatMessage({
              id: "public.impact.evidence.empty",
              defaultMessage: "Assessment evidence will appear here as Gardens publish it.",
            })}
          </p>
        ) : (
          <>
            <ul className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {slice.records.map((record) => (
                <li key={record.id}>
                  <button
                    type="button"
                    onClick={() => setActiveRecord(record)}
                    className="flex h-full w-full flex-col rounded-3xl border border-stroke-soft-200 bg-bg-white-0 p-5 text-left shadow-sm transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-base focus-visible:ring-offset-2"
                  >
                    <p className="text-xs font-medium uppercase tracking-wide text-text-soft-400">
                      {record.gardenName}
                    </p>
                    <h3
                      className="mt-2 font-serif text-lg text-text-strong-950"
                      title={record.title}
                    >
                      <span className="line-clamp-2">{record.title}</span>
                    </h3>
                    {record.summary ? (
                      <p className="mt-2 line-clamp-3 text-sm text-text-sub-600">
                        {record.summary}
                      </p>
                    ) : null}
                    <p className="mt-auto pt-4 text-xs text-text-soft-400">
                      {record.sourceAvailable
                        ? formatMessage({
                            id: "public.impact.evidence.viewSource",
                            defaultMessage: "View source",
                          })
                        : formatMessage({
                            id: "public.impact.evidence.noSource",
                            defaultMessage: "Source pending",
                          })}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
            {slice.partialData ? (
              <p className="mt-6 rounded-2xl bg-bg-white-0 p-4 text-xs text-text-soft-400">
                {formatMessage({
                  id: "public.impact.evidence.partialData",
                  defaultMessage:
                    "Showing the most recent evidence we could load. More may be available across Gardens.",
                })}
              </p>
            ) : null}
            {slice.sourceLimitReached ? (
              <p className="mt-2 rounded-2xl bg-bg-white-0 p-4 text-xs text-text-soft-400">
                {formatMessage({
                  id: "public.impact.evidence.sourceLimitReached",
                  defaultMessage:
                    "We're showing a capped slice for v1; deeper history will arrive as aggregation matures.",
                })}
              </p>
            ) : null}
          </>
        )}
      </section>

      {activeRecord ? (
        <PublicSourceDialog
          open
          onClose={() => setActiveRecord(null)}
          title={activeRecord.title}
          subtitle={activeRecord.gardenName}
          sourceHref={
            activeRecord.easUid
              ? `https://easscan.org/attestation/view/${activeRecord.easUid}`
              : undefined
          }
          sourceLabel={formatMessage({
            id: "public.impact.evidence.viewEas",
            defaultMessage: "View Attestation on EAS",
          })}
        >
          {activeRecord.summary ? (
            <p className="text-sm text-text-strong-950">{activeRecord.summary}</p>
          ) : (
            <p className="text-sm text-text-sub-600">
              {formatMessage({
                id: "public.impact.evidence.dialog.noSummary",
                defaultMessage: "No summary published for this Assessment yet.",
              })}
            </p>
          )}
          {activeRecord.timeWindow ? (
            <p className="text-xs uppercase tracking-wide text-text-soft-400">
              {formatTimeWindow(activeRecord.timeWindow, formatMessage)}
            </p>
          ) : null}
        </PublicSourceDialog>
      ) : null}
    </div>
  );
}

function formatTimeWindow(
  window: NonNullable<PublicImpactEvidenceRecord["timeWindow"]>,
  formatMessage: (descriptor: { id: string; defaultMessage: string }) => string
): string {
  const start = window.start ? new Date(window.start * 1000).toLocaleDateString() : null;
  const end = window.end ? new Date(window.end * 1000).toLocaleDateString() : null;
  if (start && end) return `${start} → ${end}`;
  if (start) return start;
  if (end) return end;
  return formatMessage({
    id: "public.impact.evidence.timeUnknown",
    defaultMessage: "Date unknown",
  });
}
