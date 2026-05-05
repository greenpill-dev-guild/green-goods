import {
  type PublicGardenSummary,
  type PublicImpactEvidenceKind,
  type PublicImpactEvidenceRecord,
  useInViewReveal,
  usePublicGardens,
  usePublicImpactEvidence,
  usePublicStats,
} from "@green-goods/shared";
import { useMemo, useState } from "react";
import { useIntl } from "react-intl";
import {
  type EditorialDomain,
  EditorialDomainChip,
  EditorialHeading,
  EditorialKicker,
  EditorialTitleAccent,
} from "@/components/Public/atoms";
import { PublicEditorialHero } from "@/components/Public/PublicEditorialHero";
import { PublicEvidenceLedgerRow } from "@/components/Public/PublicEvidenceLedgerRow";
import { PublicEvidencePipeline } from "@/components/Public/PublicEvidencePipeline";
import { PublicFooter } from "@/components/Public/PublicFooter";
import { PublicEvidenceDialog } from "@/components/Public/PublicEvidenceDialog";
import { getPublicHeroImage, publicCuration } from "@/content/publicCuration";

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
  noteId: string;
  defaultNote: string;
}

function ProofMarkers({ markers }: { markers: readonly ProofMarker[] }) {
  const { formatMessage } = useIntl();
  return (
    <dl className="grid grid-cols-2 gap-x-12 gap-y-10 md:grid-cols-4 md:gap-x-16">
      {markers.map(({ labelId, defaultLabel, value, isLoading, noteId, defaultNote }) => (
        <div key={labelId} className="flex flex-col gap-3">
          <dt className="font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-text-soft-400">
            {formatMessage({ id: labelId, defaultMessage: defaultLabel })}
          </dt>
          <dd className="font-serif text-5xl font-normal leading-none tracking-[-0.025em] text-text-strong-950 md:text-6xl">
            {isLoading ? "—" : value > 0 ? new Intl.NumberFormat().format(value) : ""}
            {!isLoading && value === 0 ? (
              <span className="font-serif text-2xl italic text-text-soft-400 md:text-2xl">
                {formatMessage({
                  id: "public.impact.proof.notPublicYet",
                  defaultMessage: "Not public yet",
                })}
              </span>
            ) : null}
          </dd>
          <p className="max-w-[18rem] text-xs leading-[1.55] text-text-sub-600">
            {formatMessage({ id: noteId, defaultMessage: defaultNote })}
          </p>
        </div>
      ))}
    </dl>
  );
}

/**
 * Impact — credible public evidence ledger.
 *
 * Editorial recomposition:
 *   Hero ("See how Garden work becomes evidence.") → § 01 Proof markers →
 *   § 02 evidence pipeline (Assessment → Work → Impact Certificate) → § 03
 *   evidence ledger with combined Kind + Domain filter row → optional source
 *   dialog → Footer.
 *
 * Cycle order on the pipeline figure follows the user's correction:
 * Assessment first, then Work, then Impact Certificate, with the cycle
 * looping back to a new Assessment.
 */
/**
 * Page size used when the visitor expands the ledger past its default
 * window. The hook still respects the upstream source cap
 * (PUBLIC_IMPACT_RECORD_FETCH_CAP — 100 records per kind today), so this
 * lifts the *page* slice but not the source slice.
 */
const EXPANDED_LEDGER_PAGE_SIZE = 200;

export default function ImpactPage() {
  const { formatMessage } = useIntl();
  const stats = usePublicStats();
  const [isLedgerExpanded, setIsLedgerExpanded] = useState(false);
  const evidence = usePublicImpactEvidence(
    isLedgerExpanded ? { pageSize: EXPANDED_LEDGER_PAGE_SIZE } : {}
  );
  const { data: gardens = [] } = usePublicGardens();
  const [activeRecord, setActiveRecord] = useState<PublicImpactEvidenceRecord | null>(null);
  const [kindFilter, setKindFilter] = useState<KindFilter>("all");
  const [domainFilter, setDomainFilter] = useState<EditorialDomain>("all");
  const { ref: proofRef, revealed: proofRevealed } = useInViewReveal<HTMLElement>();
  const { ref: ledgerRef, revealed: ledgerRevealed } = useInViewReveal<HTMLElement>();

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
  const { counted, filteredRecords } = useMemo(() => {
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
      filteredRecords: filtered,
    };
  }, [slice?.records, kindFilter, domainFilter]);

  return (
    <>
      <PublicEditorialHero
        variant="banner"
        imageSrc={getPublicHeroImage("impact")}
        imageFallbackSrc={publicCuration.fallbackImagePaths[0]}
        imageAlt=""
        titleId="public-impact-hero-title"
        title={formatMessage(
          {
            id: "public.impact.heroTitle",
            defaultMessage: "See how Garden work becomes <accent>evidence</accent>.",
          },
          {
            accent: (chunks) => <EditorialTitleAccent>{chunks}</EditorialTitleAccent>,
          }
        )}
        lede={formatMessage({
          id: "public.impact.heroLede",
          defaultMessage:
            "Green Goods turns documented regenerative Work into evidence the public can read. Assessments come first, then Work, and when ready, an Impact Certificate that sources every claim.",
        })}
      />

      <section
        ref={proofRef}
        data-revealed={proofRevealed}
        className="editorial-section-reveal bg-bg-weak-50 px-6 pt-32 pb-16 sm:px-10 sm:pt-36 md:pt-40 md:pb-20"
        aria-labelledby="public-impact-proof-title"
      >
        <div className="editorial-cascade mx-auto max-w-7xl">
          <header className="mb-10 border-b border-stroke-soft-200 pb-6">
            <EditorialKicker className="mb-3">
              {formatMessage({
                id: "public.impact.proof.kicker",
                defaultMessage: "§ 01 — Proof markers",
              })}
            </EditorialKicker>
            <EditorialHeading id="public-impact-proof-title">
              {formatMessage({
                id: "public.impact.proof.title",
                defaultMessage: "What the public record holds today.",
              })}
            </EditorialHeading>
          </header>
          <ProofMarkers
            markers={[
              {
                labelId: "public.impact.totalWork",
                defaultLabel: "Work",
                value: counts.fieldNoteCount,
                isLoading: stats.isLoading,
                noteId: "public.impact.proof.workNote",
                defaultNote: "Field entries logged across Gardens.",
              },
              {
                labelId: "public.impact.totalAssessments",
                defaultLabel: "Assessments",
                value: counts.attestationCount,
                isLoading: stats.isLoading,
                noteId: "public.impact.proof.assessmentsNote",
                defaultNote: "Source-backed evaluator confirmations.",
              },
              {
                labelId: "public.impact.totalGardens",
                defaultLabel: "Gardens",
                value: counts.gardenCount,
                isLoading: stats.isLoading,
                noteId: "public.impact.proof.gardensNote",
                defaultNote: "Active places under continuous documentation.",
              },
              {
                labelId: "public.impact.totalCertificates",
                defaultLabel: "Impact Certificates",
                value: 0,
                isLoading: false,
                noteId: "public.impact.proof.certificatesNote",
                defaultNote: "Not public yet. First issuance pending.",
              },
            ]}
          />
        </div>
      </section>

      <PublicEvidencePipeline
        kicker={formatMessage({
          id: "public.impact.pipeline.kicker",
          defaultMessage: "§ 02 — The cycle",
        })}
        title={formatMessage({
          id: "public.impact.pipeline.title",
          defaultMessage: "From plan to public proof, season after season.",
        })}
        titleId="public-impact-pipeline-title"
        intro={formatMessage({
          id: "public.impact.pipeline.intro",
          defaultMessage:
            "Each Garden moves through three stages of evidence and starts again. The cycle is what turns a place's intentions into something the public can verify.",
        })}
      />

      <section
        ref={ledgerRef}
        data-revealed={ledgerRevealed}
        className="editorial-section-reveal bg-editorial-warm px-6 py-20 sm:px-10 md:py-28"
        aria-labelledby="public-impact-ledger-title"
      >
        <div className="editorial-cascade mx-auto max-w-7xl">
          <header className="border-b border-stroke-soft-200 pb-6">
            <EditorialKicker className="mb-3">
              {formatMessage({
                id: "public.impact.ledger.kicker",
                defaultMessage: "§ 03 — Evidence ledger",
              })}
            </EditorialKicker>
            <EditorialHeading id="public-impact-ledger-title">
              {formatMessage({
                id: "public.impact.ledger.title",
                defaultMessage: "Recent evidence across Gardens.",
              })}
            </EditorialHeading>
            <p className="mt-4 max-w-2xl text-base leading-[1.6] text-text-sub-600 md:text-lg">
              {formatMessage({
                id: "public.impact.ledger.intro",
                defaultMessage:
                  "Filter by record kind or domain. Each row links to the source: the full assessment, work entry, or certificate behind the line.",
              })}
            </p>
          </header>

          <nav
            className="mt-8 flex flex-wrap items-center gap-2"
            aria-label={formatMessage({
              id: "public.impact.filters.label",
              defaultMessage: "Filter evidence by record kind and domain",
            })}
          >
            {KIND_FILTERS.map((entry) => (
              <EditorialDomainChip
                key={`kind-${entry.id}`}
                domain={entry.domain}
                active={kindFilter === entry.id}
                count={counted[entry.id]}
                onClick={() => setKindFilter(entry.id)}
              >
                {formatMessage({ id: entry.labelId, defaultMessage: entry.defaultLabel })}
              </EditorialDomainChip>
            ))}
            <span aria-hidden="true" className="mx-2 h-4 w-px bg-stroke-soft-200" />
            {DOMAIN_FILTERS.map((entry) => (
              <EditorialDomainChip
                key={`domain-${entry.id}`}
                domain={entry.id}
                active={domainFilter === entry.id}
                onClick={() => setDomainFilter(entry.id)}
              >
                {formatMessage({ id: entry.labelId, defaultMessage: entry.defaultLabel })}
              </EditorialDomainChip>
            ))}
          </nav>

          {evidence.isLoading ? (
            <ul className="mt-12 flex flex-col" aria-hidden="true">
              {[0, 1, 2].map((i) => (
                <li
                  key={i}
                  className="flex items-stretch gap-4 border-b border-stroke-soft-200 py-5 last:border-b-0 sm:gap-6 sm:py-6"
                >
                  <div className="h-20 w-20 shrink-0 animate-pulse bg-editorial-warm sm:h-28 sm:w-28" />
                  <div className="flex flex-1 flex-col gap-3 py-1">
                    <div className="h-3 w-24 animate-pulse bg-stroke-soft-200/60" />
                    <div className="h-5 w-3/4 animate-pulse bg-stroke-soft-200/60" />
                    <div className="h-3 w-1/2 animate-pulse bg-stroke-soft-200/40" />
                  </div>
                </li>
              ))}
            </ul>
          ) : slice && slice.status === "error" ? (
            <p className="mt-12 max-w-2xl border-l-2 border-text-soft-400 bg-bg-white-0 px-4 py-3 text-sm text-text-sub-600">
              {formatMessage({
                id: "public.impact.evidence.error",
                defaultMessage:
                  "Evidence is temporarily unavailable. Please try again in a few minutes.",
              })}
            </p>
          ) : filteredRecords.length === 0 ? (
            <div className="mt-12 max-w-2xl border-t border-stroke-soft-200 pt-6">
              <p className="font-mono text-[10.5px] font-medium uppercase tracking-[0.18em] text-text-soft-400">
                {formatMessage({
                  id: "public.impact.evidence.emptyKicker",
                  defaultMessage: "Reading the ledger",
                })}
              </p>
              <p className="mt-2 font-serif text-xl italic text-text-sub-600 md:text-2xl">
                {kindFilter !== "all" || domainFilter !== "all"
                  ? formatMessage({
                      id: "public.impact.evidence.emptyFiltered",
                      defaultMessage: "No evidence matches this filter combination yet.",
                    })
                  : formatMessage({
                      id: "public.impact.evidence.empty",
                      defaultMessage: "Assessment evidence will appear here as Gardens publish it.",
                    })}
              </p>
              {kindFilter !== "all" || domainFilter !== "all" ? (
                <div className="mt-5">
                  <button
                    type="button"
                    onClick={() => {
                      setKindFilter("all");
                      setDomainFilter("all");
                    }}
                    className="inline-flex items-center gap-2 border-b border-primary-action/35 pb-0.5 text-sm font-medium text-primary-action transition-colors hover:border-primary-action-hover hover:text-primary-action-hover"
                  >
                    {formatMessage({
                      id: "public.impact.evidence.resetFilters",
                      defaultMessage: "Reset filters",
                    })}
                    <span aria-hidden="true">→</span>
                  </button>
                </div>
              ) : null}
            </div>
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
            <div className="mt-8 max-w-2xl border-t border-stroke-soft-200 pt-6">
              <p className="font-mono text-[10.5px] font-medium uppercase tracking-[0.18em] text-text-soft-400">
                {formatMessage({
                  id: "public.impact.evidence.partialDataKicker",
                  defaultMessage: "Reading the source",
                })}
              </p>
              <p className="mt-2 font-serif text-base italic leading-[1.55] text-text-sub-600 md:text-lg">
                {formatMessage({
                  id: "public.impact.evidence.partialData",
                  defaultMessage:
                    "Showing the most recent evidence we could load. More may be available across Gardens.",
                })}
              </p>
            </div>
          ) : null}
          {slice?.sourceLimitReached ? (
            <div className="mt-6 border-t border-stroke-soft-200 pt-6">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div className="max-w-2xl">
                  <p className="font-mono text-[10.5px] font-medium uppercase tracking-[0.18em] text-text-soft-400">
                    {formatMessage({
                      id: "public.impact.evidence.sourceLimitKicker",
                      defaultMessage: "Source limit reached",
                    })}
                  </p>
                  <p className="mt-2 font-serif text-base italic leading-[1.55] text-text-sub-600 md:text-lg">
                    {formatMessage({
                      id: "public.impact.evidence.sourceLimitReached",
                      defaultMessage:
                        "We're showing a capped slice for v1; deeper history will arrive as aggregation matures.",
                    })}
                  </p>
                </div>
                {!isLedgerExpanded ? (
                  <button
                    type="button"
                    onClick={() => setIsLedgerExpanded(true)}
                    className="inline-flex items-center gap-2 border-b border-domain-agro/40 pb-0.5 text-sm font-medium text-domain-agro transition-colors hover:border-domain-agro"
                  >
                    {formatMessage({
                      id: "public.impact.evidence.viewArchive",
                      defaultMessage: "Show all loaded entries",
                    })}
                    <span aria-hidden="true">→</span>
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      </section>

      <PublicFooter variant="soil" />

      {activeRecord ? (
        <PublicEvidenceDialog
          open
          onClose={() => setActiveRecord(null)}
          record={activeRecord}
          garden={gardensById.get(activeRecord.gardenId.toLowerCase())}
        />
      ) : null}
    </>
  );
}
