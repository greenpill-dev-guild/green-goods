import { cn } from "@green-goods/shared";
import type { ReactNode } from "react";
import { type EditorialDomain, EditorialKicker, EditorialNumeral } from "./atoms";

/**
 * The Impact page's anchor figure. Three nodes — **Assessment → Work →
 * Impact Certificate** — set on a single horizontal rule with italic
 * numerals and a return arrow back to the next Assessment so the cycle is
 * visible at a glance.
 *
 * The cycle order was a design correction (chat with the user, 2026-04-30):
 * Assessment first (you're planning what to do), then Work (you do it),
 * then Impact Certificate (the certified outcome), and a new Assessment
 * begins the next loop.
 */

type EvidenceNodeKind = "assessment" | "work" | "certificate";

type ToneClasses = { surface: string; ink: string };

const NODE_TONES: Record<EvidenceNodeKind, ToneClasses> = {
  assessment: { surface: "bg-domain-education-soft", ink: "text-domain-education" },
  work: { surface: "bg-domain-agro-soft", ink: "text-domain-agro" },
  certificate: { surface: "bg-domain-solar-soft", ink: "text-domain-solar" },
};

interface PipelineNodeProps {
  kind: EvidenceNodeKind;
  numeral: string;
  title: ReactNode;
  description: ReactNode;
  /** When true, renders a return-arrow caption ("→ next Assessment"). */
  closesCycle?: boolean;
}

function PipelineNode({ kind, numeral, title, description, closesCycle }: PipelineNodeProps) {
  const tones = NODE_TONES[kind];
  return (
    <li className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className={cn(
            "inline-flex h-9 w-9 items-center justify-center rounded-full",
            tones.surface,
            tones.ink
          )}
        >
          <EditorialNumeral className={tones.ink}>{numeral}</EditorialNumeral>
        </span>
        <h3
          className={cn(
            "font-serif text-2xl font-normal tracking-[-0.012em] text-text-strong-950 md:text-3xl"
          )}
        >
          {title}
        </h3>
      </div>
      <p className="max-w-prose text-sm leading-relaxed text-text-sub-600 md:text-base">
        {description}
      </p>
      {closesCycle ? (
        <p className="font-serif text-xs italic text-text-soft-400">
          → and a new Assessment begins the next loop.
        </p>
      ) : null}
    </li>
  );
}

export interface PublicEvidencePipelineProps {
  /** Optional kicker label rendered above the figure (`§ 01 — The cycle`). */
  kicker?: ReactNode;
  /** Section heading. Required so the figure has a labelled landmark. */
  title: ReactNode;
  /** id used for `aria-labelledby` on the section landmark. */
  titleId: string;
  /** Short editorial intro under the heading; omit for a tighter layout. */
  intro?: ReactNode;
  /**
   * Italic Fraunces footnote rendered under the figure. Sets honest
   * expectations about what's commonplace vs rare in the cycle.
   */
  footnote?: ReactNode;
}

export function PublicEvidencePipeline({
  kicker,
  title,
  titleId,
  intro,
  footnote,
}: PublicEvidencePipelineProps) {
  return (
    <section className="bg-bg-weak-50 px-6 py-16 sm:px-10 md:py-24" aria-labelledby={titleId}>
      <div className="mx-auto max-w-7xl">
        {kicker ? <EditorialKicker className="mb-3">{kicker}</EditorialKicker> : null}
        <h2
          id={titleId}
          className="max-w-3xl font-serif text-3xl font-normal leading-[1.04] tracking-[-0.02em] text-text-strong-950 md:text-5xl"
        >
          {title}
        </h2>
        {intro ? (
          <p className="mt-4 max-w-2xl text-base leading-[1.6] text-text-sub-600 md:text-lg">
            {intro}
          </p>
        ) : null}

        <div className="relative mt-12 border-t border-stroke-soft-200 pt-10">
          <div
            aria-hidden="true"
            className="absolute top-[calc(2.5rem+18px)] right-6 left-6 hidden h-px bg-stroke-soft-200 md:block"
          />
          <ol className="grid grid-cols-1 gap-8 md:grid-cols-3 md:gap-10">
            <PipelineNode
              kind="assessment"
              numeral="1."
              title="Assessment"
              description="Operators and evaluators document what the place needs and what counts as good. The Assessment names the soil, the species, the work plan, and the standard of proof."
            />
            <PipelineNode
              kind="work"
              numeral="2."
              title="Work"
              description="Gardeners do the regenerative work and document it as it happens — photos, soil cores, plantings, repairs, restorations — each timestamped and attached to the Garden."
            />
            <PipelineNode
              kind="certificate"
              numeral="3."
              title="Impact Certificate"
              description="When the evidence is strong enough, the work is bundled into an Impact Certificate. This is the highest proof layer — public, verifiable, and on-chain."
              closesCycle
            />
          </ol>
        </div>

        {footnote ? (
          <p className="mt-10 max-w-3xl border-t border-stroke-soft-200 pt-6 font-serif text-base italic leading-[1.55] text-text-sub-600 md:text-lg">
            {footnote}
          </p>
        ) : null}
      </div>
    </section>
  );
}

/** Used by the Impact ledger row + filter chips to reflect record kind. */
export const EVIDENCE_KIND_LABELS: Record<EvidenceNodeKind, string> = {
  assessment: "Assessment",
  work: "Work",
  certificate: "Impact Certificate",
};

/** Map record kind → editorial domain ink for chips, tags, and accents. */
export const EVIDENCE_KIND_DOMAINS: Record<EvidenceNodeKind, EditorialDomain> = {
  assessment: "education",
  work: "agro",
  certificate: "solar",
};
