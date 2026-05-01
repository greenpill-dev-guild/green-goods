import { RiCloseLine } from "@remixicon/react";
import { cn, type PublicGardenSummary, type PublicImpactEvidenceRecord } from "@green-goods/shared";
import { useEffect, useId } from "react";
import { useIntl } from "react-intl";
import { EditorialKicker } from "./atoms";
import { EVIDENCE_KIND_LABELS } from "./PublicEvidencePipeline";

const DOMAIN_INK: Record<"solar" | "agro" | "education" | "waste", string> = {
  solar: "text-domain-solar",
  agro: "text-domain-agro",
  education: "text-domain-education",
  waste: "text-domain-waste",
};

const DOMAIN_DOT: Record<"solar" | "agro" | "education" | "waste", string> = {
  solar: "bg-domain-solar",
  agro: "bg-domain-agro",
  education: "bg-domain-education",
  waste: "bg-domain-waste",
};

const DOMAIN_LABELS: Record<"solar" | "agro" | "education" | "waste", string> = {
  solar: "Solar",
  agro: "Agroforestry",
  education: "Education",
  waste: "Waste",
};

function resolveDomainSlug(domain: string | number | undefined | null) {
  if (domain === undefined || domain === null) return null;
  if (typeof domain === "string") {
    const lower = domain.toLowerCase();
    if (lower in DOMAIN_INK) return lower as keyof typeof DOMAIN_INK;
    return null;
  }
  switch (domain) {
    case 0:
      return "solar" as const;
    case 1:
      return "agro" as const;
    case 2:
      return "education" as const;
    case 3:
      return "waste" as const;
    default:
      return null;
  }
}

function formatTimeWindow(window: PublicImpactEvidenceRecord["timeWindow"]): string | null {
  if (!window) return null;
  const start = window.start ? new Date(window.start * 1000) : null;
  const end = window.end ? new Date(window.end * 1000) : null;
  const fmt = (date: Date) =>
    new Intl.DateTimeFormat(undefined, {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(date);
  if (start && end) return `${fmt(start)} → ${fmt(end)}`;
  if (start) return fmt(start);
  if (end) return fmt(end);
  return null;
}

function shortHex(value: string | undefined): string | null {
  if (!value) return null;
  const stripped = value.startsWith("0x") ? value.slice(2) : value;
  if (stripped.length <= 12) return value;
  return `0x${stripped.slice(0, 6)}…${stripped.slice(-4)}`;
}

interface SourceRef {
  label: string;
  path?: string;
  href?: string;
  /** Renders "Pending" instead of "Open ↗" when href is absent. */
  pending?: boolean;
}

export interface PublicEvidenceDialogProps {
  open: boolean;
  onClose: () => void;
  record: PublicImpactEvidenceRecord;
  /** Optional Garden summary used for richer location context. */
  garden?: PublicGardenSummary;
}

/**
 * PublicEvidenceDialog — editorial source-anchored sheet for the Impact ledger.
 *
 * Right-side sheet on desktop (`max-w-[42rem]`), bottom-sheet on mobile. The
 * body composes the editorial dialect's record anatomy: domain tag → serif
 * title → summary → meta grid (Garden / Location / Time window / Pipeline
 * stage) → "Source records" panel → source badge + cite.
 *
 * The source-records panel only renders rows for refs we actually have on the
 * record (EAS attestation, Hypercert id, media count). It never invents
 * additional rows just to look full — honest > impressive.
 */
export function PublicEvidenceDialog({ open, onClose, record, garden }: PublicEvidenceDialogProps) {
  const { formatMessage } = useIntl();
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handler);
    };
  }, [open, onClose]);

  if (!open) return null;

  const domainSlug = resolveDomainSlug(record.domain);
  const kindLabel = EVIDENCE_KIND_LABELS[record.kind];
  const recordIdShort = record.easUid
    ? shortHex(record.easUid)
    : (shortHex(record.id.split(":")[1]) ?? "—");
  const timeWindowLabel = formatTimeWindow(record.timeWindow);

  const sourceRefs: SourceRef[] = [];
  if (record.easUid) {
    sourceRefs.push({
      label: kindLabel,
      path: `easscan.org/attestation/${shortHex(record.easUid)}`,
      href: `https://easscan.org/attestation/view/${record.easUid}`,
    });
  }
  if (record.hypercertId) {
    sourceRefs.push({
      label: formatMessage({
        id: "public.impact.dialog.refs.certificate",
        defaultMessage: "Impact Certificate",
      }),
      path: shortHex(record.hypercertId) ?? record.hypercertId,
    });
  }
  if (record.media && record.media.length > 0) {
    sourceRefs.push({
      label: formatMessage(
        {
          id: "public.impact.dialog.refs.media",
          defaultMessage: "{count, plural, one {# media item} other {# media items}}",
        },
        { count: record.media.length }
      ),
    });
  }
  if (sourceRefs.length === 0 && !record.sourceAvailable) {
    sourceRefs.push({
      label: formatMessage({
        id: "public.impact.dialog.refs.awaiting",
        defaultMessage: "Awaiting evaluator",
      }),
      pending: true,
    });
  }

  const citationHref = record.easUid
    ? `https://easscan.org/attestation/view/${record.easUid}`
    : null;

  const handleCite = () => {
    if (!citationHref) return;
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(citationHref).catch(() => undefined);
    }
  };

  return (
    <div
      className="fixed inset-0 z-modal flex items-end justify-center sm:justify-end"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <button
        type="button"
        aria-label={formatMessage({
          id: "public.source.close",
          defaultMessage: "Close",
        })}
        onClick={onClose}
        className="absolute inset-0 bg-static-black/40 backdrop-blur-[2px]"
      />
      <div className="relative flex h-[92vh] w-full flex-col overflow-hidden rounded-t-[var(--radius-lg)] bg-bg-weak-50 shadow-[-30px_0_80px_-30px_rgba(28,25,23,0.5)] sm:h-screen sm:max-w-[42rem] sm:rounded-none">
        <header className="flex items-center justify-between border-b border-stroke-soft-200 px-6 pt-5 pb-4 sm:px-10">
          <p className="font-mono text-[10.5px] font-medium uppercase tracking-[0.18em] text-text-soft-400">
            {formatMessage(
              {
                id: "public.impact.dialog.recordHeader",
                defaultMessage: "Evidence record · № {id}",
              },
              { id: recordIdShort }
            )}
          </p>
          <button
            ref={(node) => node?.focus()}
            type="button"
            aria-label={formatMessage({
              id: "public.source.close",
              defaultMessage: "Close",
            })}
            onClick={onClose}
            className="inline-flex items-center gap-1 rounded-full border border-stroke-soft-200 px-3 py-1 font-mono text-[10.5px] uppercase tracking-[0.06em] text-text-strong-950 transition-colors hover:bg-bg-weak-50"
          >
            <span aria-hidden="true">
              <RiCloseLine className="h-3.5 w-3.5" />
            </span>
            {formatMessage({
              id: "public.impact.dialog.close",
              defaultMessage: "Close · Esc",
            })}
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-8 sm:px-10 sm:py-10">
          {domainSlug ? (
            <p
              className={cn(
                "mb-5 inline-flex items-center gap-2 font-mono text-[10.5px] font-medium uppercase tracking-[0.16em]",
                DOMAIN_INK[domainSlug]
              )}
            >
              <span
                aria-hidden="true"
                className={cn("h-1.5 w-1.5 rounded-full", DOMAIN_DOT[domainSlug])}
              />
              {DOMAIN_LABELS[domainSlug]}
            </p>
          ) : null}

          <h2
            id={titleId}
            className="font-serif text-2xl font-normal leading-[1.1] tracking-[-0.018em] text-text-strong-950 md:text-3xl"
          >
            {record.title}
          </h2>

          {record.summary ? (
            <p className="mt-4 max-w-prose text-sm leading-[1.65] text-text-sub-600 md:text-base">
              {record.summary}
            </p>
          ) : null}

          <dl className="mt-8 grid grid-cols-1 gap-x-8 gap-y-6 border-y border-stroke-soft-200 py-6 sm:grid-cols-2">
            {(
              [
                [
                  formatMessage({
                    id: "public.impact.dialog.meta.garden",
                    defaultMessage: "Garden",
                  }),
                  record.gardenName,
                ],
                [
                  formatMessage({
                    id: "public.impact.dialog.meta.location",
                    defaultMessage: "Location",
                  }),
                  garden?.location || null,
                ],
                [
                  formatMessage({
                    id: "public.impact.dialog.meta.timeWindow",
                    defaultMessage: "Time window",
                  }),
                  timeWindowLabel,
                ],
                [
                  formatMessage({
                    id: "public.impact.dialog.meta.stage",
                    defaultMessage: "Pipeline stage",
                  }),
                  kindLabel,
                ],
              ] as const
            ).map(([label, value]) => (
              <div key={label}>
                <dt className="font-mono text-[10.5px] font-medium uppercase tracking-[0.18em] text-text-soft-400">
                  {label}
                </dt>
                <dd className="mt-2 font-serif text-base font-normal tracking-[-0.005em] text-text-strong-950 md:text-lg">
                  {value || <span className="font-serif italic text-text-soft-400">—</span>}
                </dd>
              </div>
            ))}
          </dl>

          {sourceRefs.length > 0 ? (
            <div className="mt-8">
              <EditorialKicker className="mb-3">
                {formatMessage({
                  id: "public.impact.dialog.sourceRecords",
                  defaultMessage: "Source records",
                })}
              </EditorialKicker>
              <ul className="border border-stroke-soft-200 bg-bg-weak-50">
                {sourceRefs.map((ref, index) => (
                  <li
                    key={`${ref.label}-${index}`}
                    className={cn(
                      "flex flex-wrap items-center justify-between gap-3 px-5 py-4",
                      index > 0 && "border-t border-stroke-soft-200"
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-serif text-base font-normal tracking-[-0.005em] text-text-strong-950">
                        {ref.label}
                      </p>
                      {ref.path ? (
                        <p className="mt-1 truncate font-mono text-[11px] text-text-soft-400">
                          {ref.path}
                        </p>
                      ) : null}
                    </div>
                    {ref.href ? (
                      <a
                        href={ref.href}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="inline-flex items-center gap-1 border-b border-domain-agro/40 pb-0.5 text-sm font-medium text-domain-agro transition-colors hover:border-domain-agro"
                      >
                        {formatMessage({
                          id: "public.impact.dialog.openSource",
                          defaultMessage: "Open ↗",
                        })}
                      </a>
                    ) : ref.pending ? (
                      <span className="font-mono text-[10.5px] font-medium uppercase tracking-[0.16em] text-domain-solar">
                        {formatMessage({
                          id: "public.impact.dialog.pending",
                          defaultMessage: "Pending",
                        })}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-stroke-soft-200 pt-6">
            <span
              className={cn(
                "inline-flex items-center gap-2 border-b pb-0.5 font-mono text-[11px] font-medium tracking-[0.04em]",
                record.sourceAvailable
                  ? "border-domain-agro/40 text-domain-agro"
                  : "border-domain-solar/40 text-domain-solar"
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  record.sourceAvailable ? "bg-domain-agro" : "bg-domain-solar"
                )}
              />
              {record.sourceAvailable
                ? formatMessage({
                    id: "public.impact.evidence.viewSource",
                    defaultMessage: "View source",
                  })
                : formatMessage({
                    id: "public.impact.evidence.noSource",
                    defaultMessage: "Source pending",
                  })}
            </span>
            {citationHref ? (
              <button
                type="button"
                onClick={handleCite}
                className="inline-flex items-center gap-1 border-b border-domain-agro/40 pb-0.5 text-sm font-medium text-domain-agro transition-colors hover:border-domain-agro"
              >
                {formatMessage({
                  id: "public.impact.dialog.cite",
                  defaultMessage: "Cite this record",
                })}
                <span aria-hidden="true">→</span>
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
