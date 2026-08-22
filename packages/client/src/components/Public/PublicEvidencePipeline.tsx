import { cn } from "@green-goods/shared";
import type { ReactNode } from "react";
import { type IntlShape, useIntl } from "react-intl";
import {
  EditorialKicker,
  EditorialNumeral,
  EditorialReadDeeper,
  EditorialTermTooltip,
} from "./atoms";

/**
 * The Impact page's anchor figure. Five nodes — **Assessment → Commitment →
 * Work → Confirmation → Impact Certificate** — set on a single horizontal
 * rule with italic numerals and a return arrow back to the next Assessment
 * so the cycle is visible at a glance.
 *
 * The cycle order was a design correction (chat with the user, 2026-04-30):
 * Assessment first (you're planning what to do), then Work (you do it),
 * then Impact Certificate (the certified outcome), and a new Assessment
 * begins the next loop. Commitment pooling added the two relational stages
 * around Work (uiux-spec §7.3): work begins as a commitment to someone, and
 * the person it was made to confirms it was kept.
 *
 * These node kinds are the figure's own vocabulary. They are not the public
 * evidence ledger's record kinds (`PublicImpactEvidenceKind`, labelled in
 * `./evidenceKinds`): Commitment and Confirmation are narrative stages, never
 * ledger records or filters.
 */

type EvidenceNodeKind = "assessment" | "commitment" | "work" | "confirmation" | "certificate";

type ToneClasses = { surface: string; ink: string };

/**
 * One tone per node, all drawn from tokens the editorial dialect already
 * owns. The four domain pastels carry the documentary stages; Confirmation
 * takes the dialect's walnut-on-linen tone (`editorial-deep`, mode-aware), so
 * the stage where a person seals the record reads as ink rather than as a
 * fifth work domain.
 */
const NODE_TONES: Record<EvidenceNodeKind, ToneClasses> = {
  assessment: { surface: "bg-domain-education-soft", ink: "text-domain-education" },
  commitment: { surface: "bg-domain-waste-soft", ink: "text-domain-waste" },
  work: { surface: "bg-domain-agro-soft", ink: "text-domain-agro" },
  confirmation: { surface: "bg-editorial-deep", ink: "text-editorial-deep-fg" },
  certificate: { surface: "bg-domain-solar-soft", ink: "text-domain-solar" },
};

/** Display order of the figure. The array is the single source of the order. */
const PIPELINE_NODES: readonly EvidenceNodeKind[] = [
  "assessment",
  "commitment",
  "work",
  "confirmation",
  "certificate",
];

interface PipelineNodeProps {
  kind: EvidenceNodeKind;
  numeral: string;
  title: ReactNode;
  description: ReactNode;
  /** When true, renders a return-arrow caption ("→ next Assessment"). */
  closesCycle?: boolean;
}

function PipelineNode({ kind, numeral, title, description, closesCycle }: PipelineNodeProps) {
  const { formatMessage } = useIntl();
  const tones = NODE_TONES[kind];
  return (
    <li className="flex flex-col gap-3">
      {/* Top-aligned so a title that wraps (five-up "Impact Certificate") keeps
          its numeral badge on the shared rule instead of sliding below it. */}
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className={cn(
            "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
            tones.surface,
            tones.ink
          )}
        >
          <EditorialNumeral className={tones.ink}>{numeral}</EditorialNumeral>
        </span>
        <h3 className="font-serif text-2xl font-normal leading-9 tracking-[-0.012em] text-text-strong-950">
          {title}
        </h3>
      </div>
      <p className="max-w-prose text-sm leading-relaxed text-text-sub-600 md:text-base">
        {description}
      </p>
      {closesCycle ? (
        <p className="font-serif text-xs italic text-text-soft-400">
          {formatMessage({
            id: "public.impact.pipeline.closesCycle",
            defaultMessage: "→ and a new Assessment begins the next loop.",
          })}
        </p>
      ) : null}
    </li>
  );
}

/**
 * Localized title and description per node. The three vocabulary terms a
 * first-time reader may not know (Commitment, Confirmation, Impact
 * Certificate) wrap in `EditorialTermTooltip`; the commitment terms come from
 * the shared `public.pool.terms.*` family so every public surface gives the
 * same first-exposure meaning.
 *
 * A plain formatter rather than a hook: custom hooks belong in
 * `@green-goods/shared`, and this is component-local copy selection.
 */
function nodeCopy(
  kind: EvidenceNodeKind,
  formatMessage: IntlShape["formatMessage"]
): { title: ReactNode; description: string } {
  switch (kind) {
    case "assessment":
      return {
        title: formatMessage({
          id: "public.impact.pipeline.node.assessment.title",
          defaultMessage: "Assessment",
        }),
        description: formatMessage({
          id: "public.impact.pipeline.node.assessment.description",
          defaultMessage:
            "Operators and evaluators document what the place needs and what counts as good. The Assessment names the conditions on the ground, the work plan, and the standard of proof.",
        }),
      };
    case "commitment":
      return {
        title: (
          <EditorialTermTooltip
            term={formatMessage({
              id: "public.impact.pipeline.node.commitment.title",
              defaultMessage: "Commitment",
            })}
            definition={formatMessage({
              id: "public.pool.terms.commitment",
              defaultMessage:
                "An offer or request recorded in a Garden's pool, naming who will carry it out and the window to deliver it in.",
            })}
          />
        ),
        description: formatMessage({
          id: "public.impact.pipeline.node.commitment.description",
          defaultMessage:
            "Work begins as a commitment to someone. A neighbour offers help or asks for it, another takes it up, and the Garden's pool records who will carry it out and by when.",
        }),
      };
    case "work":
      return {
        title: formatMessage({
          id: "public.impact.pipeline.node.work.title",
          defaultMessage: "Work",
        }),
        description: formatMessage({
          id: "public.impact.pipeline.node.work.description",
          defaultMessage:
            "Gardeners do the regenerative work and document it as it happens, capturing photos, measurements, and notes across the four domains, each timestamped and attached to the Garden.",
        }),
      };
    case "confirmation":
      return {
        title: (
          <EditorialTermTooltip
            term={formatMessage({
              id: "public.impact.pipeline.node.confirmation.title",
              defaultMessage: "Confirmation",
            })}
            definition={formatMessage({
              id: "public.pool.terms.confirmation",
              defaultMessage:
                "The moment the person a commitment was made to records that it was kept.",
            })}
          />
        ),
        description: formatMessage({
          id: "public.impact.pipeline.node.confirmation.description",
          defaultMessage:
            "The person the commitment was made to confirms it was kept. Evidence, or approved Work where the commitment calls for it, stands behind the confirmation, and the commitment records the outcome.",
        }),
      };
    case "certificate":
      return {
        title: (
          <EditorialTermTooltip
            term={formatMessage({
              id: "public.impact.pipeline.node.certificate.title",
              defaultMessage: "Impact Certificate",
            })}
            definition={formatMessage({
              id: "public.impact.pipeline.node.certificate.definition",
              defaultMessage:
                "A bundle of approved Work grounded in an Assessment and anchored to a public blockchain so the record stays readable beyond any one platform.",
            })}
          />
        ),
        description: formatMessage({
          id: "public.impact.pipeline.node.certificate.description",
          defaultMessage:
            "When the evidence meets the Assessment standard, approved Work can bundle into an Impact Certificate, a portable record designed to outlast any one platform.",
        }),
      };
  }
}

function LocalizedPipelineNode({ kind, index }: { kind: EvidenceNodeKind; index: number }) {
  const { formatMessage } = useIntl();
  const copy = nodeCopy(kind, formatMessage);
  return (
    <PipelineNode
      kind={kind}
      numeral={`${index + 1}.`}
      title={copy.title}
      description={copy.description}
      closesCycle={index === PIPELINE_NODES.length - 1}
    />
  );
}

export interface PublicEvidencePipelineProps {
  /** Optional kicker label rendered above the figure (`§ 03: The cycle`). */
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
  const { formatMessage } = useIntl();
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
          {/* The rule runs behind the numeral badges once all five nodes share
              a row. Below `lg` the list stacks and the rule is withdrawn, so it
              never cuts through a wrapped row. */}
          <div
            aria-hidden="true"
            className="absolute top-[calc(2.5rem+18px)] right-6 left-6 hidden h-px bg-stroke-soft-200 lg:block"
          />
          <ol
            className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-5 lg:gap-6"
            aria-label={formatMessage({
              id: "public.impact.pipeline.figureLabel",
              defaultMessage: "The stages of evidence, in order",
            })}
          >
            {PIPELINE_NODES.map((kind, index) => (
              <LocalizedPipelineNode key={kind} kind={kind} index={index} />
            ))}
          </ol>
        </div>

        {footnote ? (
          <p className="mt-10 max-w-3xl border-t border-stroke-soft-200 pt-6 font-serif text-base italic leading-[1.55] text-text-sub-600 md:text-lg">
            {footnote}
          </p>
        ) : null}

        <EditorialReadDeeper
          className="max-w-3xl"
          community={{
            labelId: "public.impact.pipeline.readDeeper.community",
            defaultLabel: "How proof works",
            href: "https://docs.greengoods.app/community/how-it-works",
          }}
          builder={{
            labelId: "public.impact.pipeline.readDeeper.builder",
            defaultLabel: "Why on-chain",
            href: "https://docs.greengoods.app/builders/architecture",
          }}
        />
      </div>
    </section>
  );
}
