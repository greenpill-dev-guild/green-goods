import { cn, ImageWithFallback, type PublicImpactEvidenceRecord } from "@green-goods/shared";
import { RiImageLine } from "@remixicon/react";
import { useCallback, useMemo, useState } from "react";
import { useIntl } from "react-intl";
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

/**
 * Date a record happened, in editorial format ("Jan 15, 2024" / range with "→").
 * Falls back to `createdAt` when the record carries no time window — Works and
 * Certificates only have `createdAt`; Assessments also carry a planning window.
 */
function formatRecordDate(record: PublicImpactEvidenceRecord, locale: string): string {
  const dateFormat = new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const window = record.timeWindow;
  const start = window?.start ?? null;
  const end = window?.end ?? null;
  if (start && end) {
    return `${dateFormat.format(start * 1000)} → ${dateFormat.format(end * 1000)}`;
  }
  if (start) return dateFormat.format(start * 1000);
  if (end) return dateFormat.format(end * 1000);
  return dateFormat.format(record.createdAt * 1000);
}

export interface PublicEvidenceCardProps {
  record: PublicImpactEvidenceRecord;
  /** Garden image URL used as a fallback when the record carries no media of
   * its own (Assessments). When the record has its own media, the first item
   * is preferred. */
  gardenImage?: string;
  /** Place caption rendered alongside the garden name (e.g. "Hudson Valley, NY"). */
  gardenLocation?: string;
  onOpen: (record: PublicImpactEvidenceRecord) => void;
}

/**
 * Full-tile placeholder rendered only when *every* image attempt has failed
 * (404, IPFS gateway exhaustion) or the record carried no media at all.
 * Distinct from the surrounding `bg-editorial-warm` page color so it reads
 * as a deliberate "image unavailable" tile, not a hole.
 *
 * Names the kind ("Impact Certificate", "Work", "Assessment") so the visitor
 * still gets useful context when the photo is missing.
 */
function EvidencePlaceholderTile({ kindLabel }: { kindLabel: string }) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-bg-weak-50 px-6 py-4 text-center">
      <RiImageLine aria-hidden="true" className="h-7 w-7 text-text-soft-400/60" />
      <p className="font-serif text-sm italic text-text-soft-400">{kindLabel}</p>
    </div>
  );
}

/**
 * One mosaic cell. Wraps `ImageWithFallback` in a `relative overflow-hidden`
 * shell so the loading pulse stays clipped. Suppresses the per-cell error UI
 * by handing `ImageWithFallback` an empty fallback fragment — the parent
 * mosaic listens via `onError` and removes the failed URL so the layout
 * actually reflows (3 → 2 → 1) instead of leaving an empty slot behind.
 */
function EvidenceImageSlot({
  src,
  alt,
  className,
  onError,
}: {
  src: string;
  alt: string;
  className?: string;
  onError?: () => void;
}) {
  return (
    <div className={cn("relative h-full w-full overflow-hidden", className)}>
      <ImageWithFallback
        src={src}
        alt={alt}
        loading="lazy"
        onErrorCallback={onError}
        backgroundFallback={<></>}
        className="h-full w-full object-cover transition-transform duration-[var(--spring-effects-slow-duration)] ease-[var(--spring-effects-slow-easing)] group-hover:scale-[1.03]"
      />
    </div>
  );
}

/**
 * Up-to-three-image split frame. Capped at 3 because beyond that the slots
 * read as thumbnails rather than evidence. Layouts:
 *   - 1: full bleed
 *   - 2: vertical split (50/50)
 *   - 3: dominant left + two stacked right
 *
 * **Failure handling**: when an individual image 404s or its IPFS gateway
 * race exhausts, that URL is removed from the rendered set and the layout
 * reflows down (e.g. 3 → 2). Only when *every* image fails do we render a
 * single `EvidencePlaceholderTile` covering the whole frame. The visitor
 * never sees a cell-shaped hole alongside working photos.
 */
function EvidenceImageMosaic({
  images,
  alt,
  kindLabel,
}: {
  images: readonly string[];
  alt: string;
  kindLabel: string;
}) {
  const candidates = useMemo(() => images.slice(0, 3), [images]);
  const [failedUrls, setFailedUrls] = useState<readonly string[]>([]);
  const valid = useMemo(
    () => candidates.filter((url) => !failedUrls.includes(url)),
    [candidates, failedUrls]
  );
  const handleError = useCallback((url: string) => {
    setFailedUrls((prev) => (prev.includes(url) ? prev : [...prev, url]));
  }, []);

  if (valid.length === 0) {
    return <EvidencePlaceholderTile kindLabel={kindLabel} />;
  }

  if (valid.length === 1) {
    return <EvidenceImageSlot src={valid[0]} alt={alt} onError={() => handleError(valid[0])} />;
  }

  if (valid.length === 2) {
    return (
      <div className="grid h-full w-full grid-cols-2 gap-px bg-stroke-soft-200">
        {valid.map((src, index) => (
          <EvidenceImageSlot
            key={src}
            src={src}
            alt={index === 0 ? alt : ""}
            onError={() => handleError(src)}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="grid h-full w-full grid-cols-2 grid-rows-2 gap-px bg-stroke-soft-200">
      <EvidenceImageSlot
        src={valid[0]}
        alt={alt}
        className="row-span-2"
        onError={() => handleError(valid[0])}
      />
      <EvidenceImageSlot src={valid[1]} alt="" onError={() => handleError(valid[1])} />
      <EvidenceImageSlot src={valid[2]} alt="" onError={() => handleError(valid[2])} />
    </div>
  );
}

/**
 * Image-forward editorial card for the Impact evidence ledger. Mirrors the
 * `PublicGardenCard` vocabulary — `aspect-[3/2]` photo on top, hairline-only
 * chrome — and re-anchors the visual hierarchy so the visitor scans:
 *
 *   Domain (color-coded) → Title → Garden + Location → Summary → Date · Kind
 *
 * The domain replaces the previously-repeated "Stage · Work" line at the top;
 * the garden moves up from a soft footer to a prominent line under the title
 * because the *who* is as important as the *what* on a public record.
 *
 * The whole card is a button that opens `PublicEvidenceDialog` (existing
 * source affordance preserved). When a record carries multiple media (Work
 * attestations often do), `EvidenceImageMosaic` shows up to three in a split
 * frame so visitors get more of the story without leaving the grid.
 */
export function PublicEvidenceCard({
  record,
  gardenImage,
  gardenLocation,
  onOpen,
}: PublicEvidenceCardProps) {
  const intl = useIntl();
  const domain = resolveDomainSlug(record.domain);
  // Prefer the record's own media (Work attestations carry up to a handful;
  // Hypercerts carry one). Fall back to the garden banner so Assessment cards
  // still show a place. Cap at 3 — see EvidenceImageMosaic.
  const mosaicImages =
    record.media && record.media.length > 0 ? record.media : gardenImage ? [gardenImage] : [];
  const kindLabel = EVIDENCE_KIND_LABELS[record.kind];
  const formattedDate = formatRecordDate(record, intl.locale);

  return (
    <button
      type="button"
      onClick={() => onOpen(record)}
      className="group flex h-full cursor-pointer flex-col gap-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-action focus-visible:ring-offset-2"
      aria-label={record.title}
    >
      <div className="relative aspect-[3/2] w-full overflow-hidden bg-editorial-warm">
        {mosaicImages.length > 0 ? (
          <EvidenceImageMosaic images={mosaicImages} alt="" kindLabel={kindLabel} />
        ) : (
          <EvidencePlaceholderTile kindLabel={kindLabel} />
        )}
      </div>

      <p
        className={cn(
          "flex items-center gap-2 font-mono text-[11px] font-medium uppercase tracking-[0.18em]",
          domain ? DOMAIN_INK[domain] : "text-text-soft-400"
        )}
      >
        {domain ? (
          <span aria-hidden="true" className={cn("inline-block size-1.5", DOMAIN_DOT[domain])} />
        ) : null}
        {domain
          ? DOMAIN_LABELS[domain]
          : intl.formatMessage({
              id: "public.impact.evidence.domainUntagged",
              defaultMessage: "Cross-domain",
            })}
      </p>

      <h3
        className="font-serif text-xl font-normal leading-[1.15] tracking-[-0.012em] text-text-strong-950 transition-[color,transform] duration-[var(--spring-spatial-fast-duration)] ease-[var(--spring-spatial-fast-easing)] group-hover:text-primary-action motion-safe:group-hover:-translate-y-px"
        title={record.title}
      >
        <span className="line-clamp-2">{record.title}</span>
      </h3>

      <p
        className="text-sm font-medium leading-[1.4] text-text-strong-950"
        title={gardenLocation ? `${record.gardenName} · ${gardenLocation}` : record.gardenName}
      >
        <span className="line-clamp-1">{record.gardenName}</span>
        {gardenLocation ? (
          <span className="block text-xs font-normal text-text-sub-600">{gardenLocation}</span>
        ) : null}
      </p>

      {record.summary ? (
        <p className="text-sm leading-[1.55] text-text-sub-600" title={record.summary}>
          <span className="line-clamp-2">{record.summary}</span>
        </p>
      ) : null}

      <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 pt-2 text-xs leading-relaxed tracking-[0.02em] text-text-soft-400">
        <span>{formattedDate}</span>
        <span
          aria-hidden="true"
          className="inline-block h-0.5 w-0.5 rounded-full bg-current opacity-50"
        />
        <span className="italic">{kindLabel}</span>
      </div>
    </button>
  );
}
