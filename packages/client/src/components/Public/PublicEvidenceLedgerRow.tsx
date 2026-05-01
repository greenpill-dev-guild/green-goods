import { cn, type PublicImpactEvidenceRecord } from "@green-goods/shared";
import { useIntl } from "react-intl";
import { EVIDENCE_KIND_DOMAINS, EVIDENCE_KIND_LABELS } from "./PublicEvidencePipeline";

const DOMAIN_INK: Record<"solar" | "agro" | "education" | "waste", string> = {
  solar: "text-domain-solar",
  agro: "text-domain-agro",
  education: "text-domain-education",
  waste: "text-domain-waste",
};

const DOMAIN_LABELS: Record<"solar" | "agro" | "education" | "waste", string> = {
  solar: "Solar",
  agro: "Agroforestry",
  education: "Education",
  waste: "Waste",
};

function resolveDomainSlug(domain: string | number | undefined) {
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
  const start = window.start ? new Date(window.start * 1000).toLocaleDateString() : null;
  const end = window.end ? new Date(window.end * 1000).toLocaleDateString() : null;
  if (start && end) return `${start} → ${end}`;
  return start ?? end;
}

function shortHex(value: string | undefined): string | null {
  if (!value) return null;
  const stripped = value.startsWith("0x") ? value.slice(2) : value;
  if (stripped.length <= 12) return value;
  return `0x${stripped.slice(0, 6)}…${stripped.slice(-4)}`;
}

function deriveRecordIdShort(record: PublicImpactEvidenceRecord): string | null {
  return record.easUid ? shortHex(record.easUid) : (shortHex(record.id.split(":")[1]) ?? null);
}

export interface PublicEvidenceLedgerRowProps {
  record: PublicImpactEvidenceRecord;
  /** Garden image URL used as a thumbnail when the record carries no media of
   * its own (Assessments). When the record has its own media, the first item
   * is preferred. */
  gardenImage?: string;
  /** Place caption rendered as the first line of the meta row (e.g. "Hudson Valley, NY"). */
  gardenLocation?: string;
  onOpen: (record: PublicImpactEvidenceRecord) => void;
}

/**
 * Single row in the Impact evidence ledger. Renders thumbnail + record kind
 * tag + title + summary + meta + source affordance, with the editorial dialect's
 * preference for hairlines over card chrome.
 *
 * The thumbnail prefers the record's own media (Work, Hypercert imageUri) and
 * falls back to the Garden image. If neither is available, a calm linen
 * placeholder fills the slot.
 */
export function PublicEvidenceLedgerRow({
  record,
  gardenImage,
  gardenLocation,
  onOpen,
}: PublicEvidenceLedgerRowProps) {
  const intl = useIntl();
  const domain = resolveDomainSlug(record.domain);
  const recordImage = record.media?.[0] ?? gardenImage ?? null;
  const kindLabel = EVIDENCE_KIND_LABELS[record.kind];
  const kindDomain = EVIDENCE_KIND_DOMAINS[record.kind];
  const timeWindow = formatTimeWindow(record.timeWindow);
  const recordIdShort = deriveRecordIdShort(record);
  const stagePrefix = intl.formatMessage({
    id: "public.impact.evidence.stagePrefix",
    defaultMessage: "Stage",
  });

  const sourceLabel = record.sourceAvailable
    ? intl.formatMessage({
        id: "public.impact.evidence.viewSource",
        defaultMessage: "View source",
      })
    : intl.formatMessage({
        id: "public.impact.evidence.noSource",
        defaultMessage: "Source pending",
      });

  return (
    <li className="border-b border-stroke-soft-200 last:border-b-0">
      <button
        type="button"
        onClick={() => onOpen(record)}
        className="group flex w-full items-stretch gap-4 py-5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-action focus-visible:ring-offset-2 sm:gap-6 sm:py-6"
      >
        <div className="relative h-20 w-20 shrink-0 overflow-hidden bg-editorial-warm sm:h-28 sm:w-28">
          {recordImage ? (
            <img
              src={recordImage}
              alt=""
              loading="lazy"
              className="h-full w-full object-cover transition-transform group-hover:scale-[1.03]"
            />
          ) : (
            <span
              aria-hidden="true"
              className="flex h-full w-full items-center justify-center font-serif text-xs italic text-text-soft-400"
            >
              {intl.formatMessage({
                id: "public.impact.evidence.thumbnailFallback",
                defaultMessage: "no image",
              })}
            </span>
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 text-[10px] font-medium uppercase tracking-[0.18em]">
              <span className="text-text-soft-400">{stagePrefix}</span>
              <span aria-hidden="true" className="text-text-soft-400">
                ·
              </span>
              <span className={cn("text-text-soft-400", kindDomain && DOMAIN_INK[kindDomain])}>
                {kindLabel}
              </span>
              {domain ? (
                <>
                  <span aria-hidden="true" className="text-text-soft-400">
                    ·
                  </span>
                  <span className={cn("text-text-soft-400", DOMAIN_INK[domain])}>
                    {DOMAIN_LABELS[domain]}
                  </span>
                </>
              ) : null}
            </div>
            {recordIdShort ? (
              <span className="shrink-0 font-serif text-xs font-normal italic text-text-soft-400">
                № {recordIdShort}
              </span>
            ) : null}
          </div>
          <h3
            className="mt-1.5 font-serif text-lg font-normal tracking-[-0.01em] text-text-strong-950 group-hover:text-primary-action sm:text-xl"
            title={record.title}
          >
            <span className="line-clamp-2">{record.title}</span>
          </h3>
          {record.summary ? (
            <p className="mt-1.5 line-clamp-2 text-sm text-text-sub-600">{record.summary}</p>
          ) : null}
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-soft-400">
            <span>{record.gardenName}</span>
            {gardenLocation ? (
              <>
                <span aria-hidden="true">·</span>
                <span>{gardenLocation}</span>
              </>
            ) : null}
            {timeWindow ? (
              <>
                <span aria-hidden="true">·</span>
                <span>{timeWindow}</span>
              </>
            ) : null}
          </div>
        </div>

        <div className="hidden shrink-0 self-end pb-1 text-right text-xs font-medium text-text-sub-600 sm:block">
          <span
            className={cn(
              "inline-flex items-center gap-1 border-b pb-0.5 transition-colors",
              record.sourceAvailable
                ? "border-primary-action/35 text-primary-action group-hover:border-primary-action group-hover:text-primary-action-hover"
                : "border-stroke-soft-200 text-text-soft-400"
            )}
          >
            {sourceLabel}
            {record.sourceAvailable ? <span aria-hidden="true">→</span> : null}
          </span>
        </div>
      </button>
    </li>
  );
}
