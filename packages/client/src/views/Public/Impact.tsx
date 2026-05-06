import {
  PUBLIC_IMPACT_RECORD_FETCH_CAP,
  type PublicGardenSummary,
  type PublicImpactEvidenceKind,
  type PublicImpactEvidenceRecord,
  useInViewReveal,
  usePublicGardens,
  usePublicImpactEvidence,
  usePublicStats,
} from "@green-goods/shared";
import { useEffect, useMemo, useState } from "react";
import { useIntl } from "react-intl";
import {
  type EditorialDomain,
  EditorialDomainChip,
  EditorialHeading,
  EditorialKicker,
  EditorialSelect,
  type EditorialSelectOption,
  EditorialTitleAccent,
} from "@/components/Public/atoms";
import { PublicEditorialHero } from "@/components/Public/PublicEditorialHero";
import { PublicEvidenceCard } from "@/components/Public/PublicEvidenceCard";
import { PublicEvidenceDialog } from "@/components/Public/PublicEvidenceDialog";
import { PublicEvidencePipeline } from "@/components/Public/PublicEvidencePipeline";
import { PublicFooter } from "@/components/Public/PublicFooter";
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
          <p className="max-w-[22rem] text-sm leading-[1.55] text-text-sub-600 md:text-base">
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
 *   image-forward evidence grid with combined Kind + Domain filter row +
 *   Prev / Next pagination → optional source dialog → Footer.
 *
 * Cycle order on the pipeline figure follows the user's correction:
 * Assessment first, then Work, then Impact Certificate, with the cycle
 * looping back to a new Assessment.
 */

/**
 * Visible cards per page in the evidence grid. 12 fills 4×3 desktop /
 * 6×2 tablet / 12×1 mobile uniformly.
 */
const LEDGER_PAGE_SIZE = 12;

export default function ImpactPage() {
  const { formatMessage } = useIntl();
  const stats = usePublicStats();
  // Pull the full fetched window in one query so kind/domain filtering and
  // pagination are pure client-side concerns over a stable dataset.
  const evidence = usePublicImpactEvidence({ pageSize: PUBLIC_IMPACT_RECORD_FETCH_CAP });
  const { data: gardens = [] } = usePublicGardens();
  const [activeRecord, setActiveRecord] = useState<PublicImpactEvidenceRecord | null>(null);
  const [kindFilter, setKindFilter] = useState<KindFilter>("all");
  const [domainFilter, setDomainFilter] = useState<EditorialDomain>("all");
  const [gardenFilter, setGardenFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
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
  const { counted, filteredRecords, pageRecords, totalPages } = useMemo(() => {
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
    const gardenFilterLower = gardenFilter === "all" ? null : gardenFilter.toLowerCase();
    const filtered = records.filter((record) => {
      if (kindFilter !== "all" && record.kind !== kindFilter) return false;
      if (domainEntry && domainEntry.filterId !== "all") {
        if (!recordMatchesDomain(record, domainEntry.filterId)) return false;
      }
      if (gardenFilterLower && record.gardenId.toLowerCase() !== gardenFilterLower) return false;
      return true;
    });
    const pages = Math.max(1, Math.ceil(filtered.length / LEDGER_PAGE_SIZE));
    const safePage = Math.min(Math.max(1, page), pages);
    const start = (safePage - 1) * LEDGER_PAGE_SIZE;
    return {
      counted: byKind,
      filteredRecords: filtered,
      pageRecords: filtered.slice(start, start + LEDGER_PAGE_SIZE),
      totalPages: pages,
    };
  }, [slice?.records, kindFilter, domainFilter, gardenFilter, page]);

  // If filters drop the result set below the current page, clamp page back
  // into range. Pure UI concern — don't reset to 1 on every filter change so
  // the user keeps their place when results don't shrink.
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const handleKindFilter = (next: KindFilter) => {
    setKindFilter(next);
    setPage(1);
  };
  const handleDomainFilter = (next: EditorialDomain) => {
    setDomainFilter(next);
    setPage(1);
  };
  const handleGardenFilter = (next: string) => {
    setGardenFilter(next);
    setPage(1);
  };
  const resetFilters = () => {
    setKindFilter("all");
    setDomainFilter("all");
    setGardenFilter("all");
    setPage(1);
  };

  // Sort gardens alphabetically for the dropdown so the visitor scans
  // predictably; the data itself comes back in latest-activity order.
  const gardenOptions = useMemo(
    () => [...gardens].sort((a, b) => a.name.localeCompare(b.name)),
    [gardens]
  );
  const gardenSelectOptions = useMemo<EditorialSelectOption[]>(
    () => [
      {
        value: "all",
        label: formatMessage({
          id: "public.impact.filters.gardenAll",
          defaultMessage: "All Gardens",
        }),
      },
      ...gardenOptions.map((garden) => ({ value: garden.id, label: garden.name })),
    ],
    [gardenOptions, formatMessage]
  );

  const canPrev = page > 1;
  const canNext = page < totalPages;

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
                  "Filter by record kind or domain. Each card opens its source: the full assessment, work entry, or certificate behind the line.",
              })}
            </p>
          </header>

          <nav
            className="mt-8 flex flex-wrap items-center gap-x-2 gap-y-4"
            aria-label={formatMessage({
              id: "public.impact.filters.label",
              defaultMessage: "Filter evidence by record kind, domain, and Garden",
            })}
          >
            {KIND_FILTERS.map((entry) => (
              <EditorialDomainChip
                key={`kind-${entry.id}`}
                domain={entry.domain}
                active={kindFilter === entry.id}
                count={counted[entry.id]}
                onClick={() => handleKindFilter(entry.id)}
              >
                {formatMessage({ id: entry.labelId, defaultMessage: entry.defaultLabel })}
              </EditorialDomainChip>
            ))}
            <span aria-hidden="true" className="mx-2 h-4 w-px bg-text-strong-950" />
            {DOMAIN_FILTERS.map((entry) => (
              <EditorialDomainChip
                key={`domain-${entry.id}`}
                domain={entry.id}
                active={domainFilter === entry.id}
                onClick={() => handleDomainFilter(entry.id)}
              >
                {formatMessage({ id: entry.labelId, defaultMessage: entry.defaultLabel })}
              </EditorialDomainChip>
            ))}
            <span aria-hidden="true" className="mx-2 h-4 w-px bg-text-strong-950" />
            <span className="inline-flex items-center gap-2">
              <span className="font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-text-soft-400">
                {formatMessage({
                  id: "public.impact.filters.garden",
                  defaultMessage: "Garden",
                })}
              </span>
              {/* Mobile: native picker for OS-level usability + bigger tap
                  targets. Desktop: editorial-styled dropdown matching the
                  rest of the dialect. Both wired to the same state. */}
              <label className="md:hidden">
                <span className="sr-only">
                  {formatMessage({
                    id: "public.impact.filters.garden",
                    defaultMessage: "Garden",
                  })}
                </span>
                <select
                  value={gardenFilter}
                  onChange={(event) => handleGardenFilter(event.target.value)}
                  className="cursor-pointer border-b border-stroke-soft-200 bg-transparent pb-1 font-serif text-sm text-text-strong-950 transition-colors duration-[var(--spring-effects-duration)] ease-[var(--spring-effects-easing)] focus:border-primary-action focus:outline-none"
                >
                  {gardenSelectOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <span className="hidden md:inline-flex">
                <EditorialSelect
                  value={gardenFilter}
                  onValueChange={handleGardenFilter}
                  options={gardenSelectOptions}
                  ariaLabel={formatMessage({
                    id: "public.impact.filters.garden",
                    defaultMessage: "Garden",
                  })}
                />
              </span>
            </span>
          </nav>

          {evidence.isLoading ? (
            <div
              className="mt-12 grid grid-cols-1 gap-12 sm:grid-cols-2 lg:grid-cols-3"
              aria-hidden="true"
            >
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex flex-col gap-4">
                  <div className="aspect-[3/2] w-full animate-pulse bg-bg-weak-50" />
                  <div className="h-3 w-24 animate-pulse bg-stroke-soft-200/60" />
                  <div className="h-5 w-3/4 animate-pulse bg-stroke-soft-200/60" />
                  <div className="h-3 w-1/2 animate-pulse bg-stroke-soft-200/40" />
                </div>
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
                    onClick={resetFilters}
                    className="inline-flex cursor-pointer items-center gap-2 border-b border-primary-action/35 pb-0.5 text-sm font-medium text-primary-action transition-colors hover:border-primary-action-hover hover:text-primary-action-hover"
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
            <>
              <div className="mt-12 grid grid-cols-1 gap-12 sm:grid-cols-2 lg:grid-cols-3">
                {pageRecords.map((record) => {
                  const garden = gardensById.get(record.gardenId.toLowerCase());
                  return (
                    <PublicEvidenceCard
                      key={record.id}
                      record={record}
                      gardenImage={garden?.bannerImage}
                      gardenLocation={garden?.location}
                      onOpen={setActiveRecord}
                    />
                  );
                })}
              </div>

              {totalPages > 1 ? (
                <nav
                  className="mt-12 flex items-center justify-between gap-4 border-t border-stroke-soft-200 pt-6"
                  aria-label={formatMessage({
                    id: "public.impact.pagination.label",
                    defaultMessage: "Evidence ledger pagination",
                  })}
                >
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={!canPrev}
                    className="inline-flex cursor-pointer items-center gap-2 border-b border-primary-action/35 pb-0.5 text-sm font-medium text-primary-action transition-colors hover:border-primary-action-hover hover:text-primary-action-hover disabled:cursor-not-allowed disabled:border-stroke-soft-200 disabled:text-text-soft-400 disabled:hover:border-stroke-soft-200 disabled:hover:text-text-soft-400"
                  >
                    <span aria-hidden="true">←</span>
                    {formatMessage({
                      id: "public.impact.pagination.prev",
                      defaultMessage: "Prev",
                    })}
                  </button>
                  <p className="font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-text-soft-400">
                    {formatMessage(
                      {
                        id: "public.impact.pagination.pageOf",
                        defaultMessage: "Page {page} of {total}",
                      },
                      { page, total: totalPages }
                    )}
                  </p>
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={!canNext}
                    className="inline-flex cursor-pointer items-center gap-2 border-b border-primary-action/35 pb-0.5 text-sm font-medium text-primary-action transition-colors hover:border-primary-action-hover hover:text-primary-action-hover disabled:cursor-not-allowed disabled:border-stroke-soft-200 disabled:text-text-soft-400 disabled:hover:border-stroke-soft-200 disabled:hover:text-text-soft-400"
                  >
                    {formatMessage({
                      id: "public.impact.pagination.next",
                      defaultMessage: "Next",
                    })}
                    <span aria-hidden="true">→</span>
                  </button>
                </nav>
              ) : null}
            </>
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
            <div className="mt-6 max-w-2xl border-t border-stroke-soft-200 pt-6">
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
