import {
  type PublicGardenSummary,
  type PublicImpactEvidenceKind,
  type PublicImpactEvidenceRecord,
  usePublicGardens,
  usePublicImpactEvidence,
  usePublicStats,
} from "@green-goods/shared";
import { useMemo, useState } from "react";
import { useIntl } from "react-intl";
import { type EditorialDomain, EditorialDomainChip } from "@/components/Public/atoms";
import { PublicEditorialHero } from "@/components/Public/PublicEditorialHero";
import { PublicEvidenceLedgerRow } from "@/components/Public/PublicEvidenceLedgerRow";
import { PublicEvidencePipeline } from "@/components/Public/PublicEvidencePipeline";
import { PublicFooter } from "@/components/Public/PublicFooter";
import { PublicSourceDialog } from "@/components/Public/PublicSourceDialog";
import { publicCuration } from "@/content/publicCuration";

type KindFilter = "all" | PublicImpactEvidenceKind;

interface KindEntry {
  id: KindFilter;
  domain: EditorialDomain;
  labelId: string;
  defaultLabel: string;
}

const KIND_FILTERS: readonly KindEntry[] = [
  { id: "all", domain: "all", labelId: "public.impact.kind.all", defaultLabel: "All" },
  {
    id: "assessment",
    domain: "education",
    labelId: "public.impact.kind.assessment",
    defaultLabel: "Assessment",
  },
  {
    id: "work",
    domain: "agro",
    labelId: "public.impact.kind.work",
    defaultLabel: "Work",
  },
  {
    id: "certificate",
    domain: "solar",
    labelId: "public.impact.kind.certificate",
    defaultLabel: "Impact Certificate",
  },
] as const;

interface DomainEntry {
  id: EditorialDomain;
  filterId: string;
  labelId: string;
  defaultLabel: string;
}

const DOMAIN_FILTERS: readonly DomainEntry[] = [
  { id: "all", filterId: "all", labelId: "public.actions.domain.all", defaultLabel: "All" },
  { id: "solar", filterId: "0", labelId: "app.domain.tab.solar", defaultLabel: "Solar" },
  {
    id: "agro",
    filterId: "1",
    labelId: "app.domain.tab.agro",
    defaultLabel: "Agroforestry",
  },
  {
    id: "education",
    filterId: "2",
    labelId: "app.domain.tab.education",
    defaultLabel: "Education",
  },
  { id: "waste", filterId: "3", labelId: "app.domain.tab.waste", defaultLabel: "Waste" },
] as const;

function recordMatchesDomain(record: PublicImpactEvidenceRecord, filterId: string): boolean {
  if (filterId === "all") return true;
  if (record.domain === undefined || record.domain === null) return false;
  return String(record.domain) === filterId;
}

interface ProofMarker {
  labelId: string;
  defaultLabel: string;
  value: number;
  isLoading: boolean;
}

function ProofMarkers({ markers }: { markers: readonly ProofMarker[] }) {
  const { formatMessage } = useIntl();
  return (
    <dl className="grid grid-cols-2 gap-x-12 gap-y-10 md:grid-cols-4 md:gap-x-16">
      {markers.map(({ labelId, defaultLabel, value, isLoading }) => (
        <div key={labelId}>
          <dd className="font-serif text-5xl font-normal leading-none tracking-[-0.025em] text-text-strong-950 md:text-6xl">
            {isLoading ? "—" : value > 0 ? new Intl.NumberFormat().format(value) : ""}
            {!isLoading && value === 0 ? (
              <span className="font-serif text-base italic text-text-soft-400">
                {formatMessage({
                  id: "public.impact.proof.notPublicYet",
                  defaultMessage: "Not public yet",
                })}
              </span>
            ) : null}
          </dd>
          <dt className="mt-3 font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-text-soft-400">
            {formatMessage({ id: labelId, defaultMessage: defaultLabel })}
          </dt>
        </div>
      ))}
    </dl>
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

/**
 * Impact — credible public evidence ledger.
 *
 * Editorial recomposition:
 *   Hero ("See how Garden work becomes evidence.") → quiet proof markers
 *   strip → § 01 evidence pipeline (Assessment → Work → Impact Certificate)
 *   → § 02 evidence ledger filterable by Kind + Domain → optional source
 *   dialog → Footer.
 *
 * Cycle order on the pipeline figure follows the user's correction:
 * Assessment first, then Work, then Impact Certificate, with the cycle
 * looping back to a new Assessment.
 */
export default function ImpactPage() {
  const { formatMessage } = useIntl();
  const stats = usePublicStats();
  const evidence = usePublicImpactEvidence();
  const { data: gardens = [] } = usePublicGardens();
  const [activeRecord, setActiveRecord] = useState<PublicImpactEvidenceRecord | null>(null);
  const [kindFilter, setKindFilter] = useState<KindFilter>("all");
  const [domainFilter, setDomainFilter] = useState<EditorialDomain>("all");

  const gardensById = useMemo(() => {
    const map = new Map<string, PublicGardenSummary>();
    for (const garden of gardens) {
      map.set(garden.id, garden);
      map.set(garden.id.toLowerCase(), garden);
    }
    return map;
  }, [gardens]);

  const counts = stats.data ?? {
    gardenCount: 0,
    contributorCount: 0,
    fieldNoteCount: 0,
    attestationCount: 0,
  };

  const slice = evidence.data;

  // Combine derived stats into one useMemo so the upstream `records` array
  // doesn't trigger redundant recomputation across separate hooks (Rule 9 in
  // CLAUDE.md — never chain useMemos on the same source).
  const { counted, certificateCount, filteredRecords } = useMemo(() => {
    const records = slice?.records ?? [];
    const byKind: Record<KindFilter, number> = {
      all: records.length,
      assessment: 0,
      work: 0,
      certificate: 0,
    };
    for (const record of records) {
      byKind[record.kind] += 1;
    }
    const domainEntry = DOMAIN_FILTERS.find((d) => d.id === domainFilter);
    const filtered = records.filter((record) => {
      if (kindFilter !== "all" && record.kind !== kindFilter) return false;
      if (domainEntry && domainEntry.filterId !== "all") {
        if (!recordMatchesDomain(record, domainEntry.filterId)) return false;
      }
      return true;
    });
    return {
      counted: byKind,
      certificateCount: byKind.certificate,
      filteredRecords: filtered,
    };
  }, [slice?.records, kindFilter, domainFilter]);

  return (
    <>
      <PublicEditorialHero
        imageSrc={publicCuration.heroImagePath}
        imageFallbackSrc={publicCuration.fallbackImagePaths[0]}
        imageAlt=""
        titleId="public-impact-hero-title"
        title={formatMessage({
          id: "public.impact.heroTitle",
          defaultMessage: "See how Garden work becomes evidence.",
        })}
        lede={formatMessage({
          id: "public.impact.heroLede",
          defaultMessage:
            "Green Goods turns documented regenerative work into public evidence through Assessments and, when ready, Impact Certificates.",
        })}
      />

      <section
        className="bg-bg-weak-50 px-6 pt-32 pb-20 sm:px-10 md:pt-48 md:pb-28"
        aria-labelledby="public-impact-proof-title"
      >
        <div className="mx-auto max-w-7xl">
          <h2 id="public-impact-proof-title" className="sr-only">
            {formatMessage({
              id: "public.impact.proof.title",
              defaultMessage: "Proof markers",
            })}
          </h2>
          <ProofMarkers
            markers={[
              {
                labelId: "public.impact.totalWork",
                defaultLabel: "Work",
                value: counts.fieldNoteCount,
                isLoading: stats.isLoading,
              },
              {
                labelId: "public.impact.totalAssessments",
                defaultLabel: "Assessments",
                value: counts.attestationCount,
                isLoading: stats.isLoading,
              },
              {
                labelId: "public.impact.totalGardens",
                defaultLabel: "Gardens",
                value: counts.gardenCount,
                isLoading: stats.isLoading,
              },
              {
                labelId: "public.impact.totalCertificates",
                defaultLabel: "Impact Certificates",
                value: 0,
                isLoading: false,
              },
            ]}
          />
        </div>
      </section>

      <PublicEvidencePipeline
        kicker={formatMessage({
          id: "public.impact.pipeline.kicker",
          defaultMessage: "§ 01 — The cycle",
        })}
        title={formatMessage({
          id: "public.impact.pipeline.title",
          defaultMessage: "From plan to public proof, season after season.",
        })}
        titleId="public-impact-pipeline-title"
        intro={formatMessage({
          id: "public.impact.pipeline.intro",
          defaultMessage:
            "Each Garden moves through three stages of evidence — and starts again. The cycle is what turns a place's intentions into something the public can verify.",
        })}
      />

      <section
        className="bg-bg-weak-50 px-6 py-20 sm:px-10 md:py-28"
        aria-labelledby="public-impact-ledger-title"
      >
        <div className="mx-auto max-w-7xl">
          <header className="border-b border-stroke-soft-200 pb-6">
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-text-soft-400">
              {formatMessage({
                id: "public.impact.ledger.kicker",
                defaultMessage: "§ 02 — Evidence ledger",
              })}
            </p>
            <h2
              id="public-impact-ledger-title"
              className="mt-3 font-serif text-3xl font-normal leading-[1.04] tracking-[-0.02em] text-text-strong-950 md:text-4xl"
            >
              {formatMessage({
                id: "public.impact.ledger.title",
                defaultMessage: "Recent evidence across Gardens.",
              })}
            </h2>
          </header>

          <div className="mt-8 flex flex-col gap-4">
            <div>
              <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.16em] text-text-soft-400">
                {formatMessage({ id: "public.impact.filters.kind", defaultMessage: "Kind" })}
              </p>
              <ul className="flex flex-wrap gap-2">
                {KIND_FILTERS.map((entry) => (
                  <li key={entry.id}>
                    <EditorialDomainChip
                      domain={entry.domain}
                      active={kindFilter === entry.id}
                      count={counted[entry.id]}
                      onClick={() => setKindFilter(entry.id)}
                    >
                      {formatMessage({ id: entry.labelId, defaultMessage: entry.defaultLabel })}
                    </EditorialDomainChip>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.16em] text-text-soft-400">
                {formatMessage({ id: "public.impact.filters.domain", defaultMessage: "Domain" })}
              </p>
              <ul className="flex flex-wrap gap-2">
                {DOMAIN_FILTERS.map((entry) => (
                  <li key={entry.id}>
                    <EditorialDomainChip
                      domain={entry.id}
                      active={domainFilter === entry.id}
                      onClick={() => setDomainFilter(entry.id)}
                    >
                      {formatMessage({ id: entry.labelId, defaultMessage: entry.defaultLabel })}
                    </EditorialDomainChip>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {evidence.isLoading ? (
            <div className="mt-12 flex flex-col gap-4">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-24 w-full animate-pulse bg-editorial-warm"
                  aria-hidden="true"
                />
              ))}
            </div>
          ) : slice && slice.status === "error" ? (
            <p className="mt-12 max-w-2xl border-l-2 border-text-soft-400 bg-bg-white-0 px-4 py-3 text-sm text-text-sub-600">
              {formatMessage({
                id: "public.impact.evidence.error",
                defaultMessage:
                  "Evidence is temporarily unavailable. Please try again in a few minutes.",
              })}
            </p>
          ) : filteredRecords.length === 0 ? (
            <p className="mt-12 max-w-2xl font-serif text-xl italic text-text-soft-400">
              {formatMessage({
                id: "public.impact.evidence.empty",
                defaultMessage: "Assessment evidence will appear here as Gardens publish it.",
              })}
            </p>
          ) : (
            <ul className="mt-8">
              {filteredRecords.map((record) => {
                const garden = gardensById.get(record.gardenId.toLowerCase());
                return (
                  <PublicEvidenceLedgerRow
                    key={record.id}
                    record={record}
                    gardenImage={garden?.bannerImage}
                    gardenLocation={garden?.location}
                    onOpen={setActiveRecord}
                  />
                );
              })}
            </ul>
          )}

          {slice?.partialData ? (
            <p className="mt-6 max-w-2xl text-xs text-text-soft-400">
              {formatMessage({
                id: "public.impact.evidence.partialData",
                defaultMessage:
                  "Showing the most recent evidence we could load. More may be available across Gardens.",
              })}
            </p>
          ) : null}
          {slice?.sourceLimitReached ? (
            <p className="mt-2 max-w-2xl text-xs text-text-soft-400">
              {formatMessage({
                id: "public.impact.evidence.sourceLimitReached",
                defaultMessage:
                  "We're showing a capped slice for v1; deeper history will arrive as aggregation matures.",
              })}
            </p>
          ) : null}
        </div>
      </section>

      <PublicFooter />

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
          {activeRecord.media && activeRecord.media.length > 0 ? (
            <img src={activeRecord.media[0]} alt="" className="w-full rounded-2xl object-cover" />
          ) : null}
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
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-soft-400">
              {formatTimeWindow(activeRecord.timeWindow, formatMessage)}
            </p>
          ) : null}
        </PublicSourceDialog>
      ) : null}
    </>
  );
}
