import { cn } from "@green-goods/shared/utils/styles/cn";
import type { ReactNode } from "react";
import { type IntlShape, useIntl } from "react-intl";
import {
  EditorialKicker,
  EditorialNumeral,
  EditorialReadDeeper,
  EditorialTermTooltip,
} from "./atoms";

/**
 * The Impact page's anchor figure. Four steps — **Needs → Commitment →
 * Work → Learnings** — set on a single horizontal rule with italic numerals,
 * and the loop-line as a full-width footer under all four columns so the
 * cycle closes for the whole figure, never inside the last column.
 *
 * The four-step shape is the 2026-08-25 redesign (experience audit AD-9,
 * superseding the five-node figure): confirmation fuses into Work — the
 * person a commitment was for records that it was kept — and the certificate
 * step becomes Learnings, with "Impact Certificate" surviving inside the
 * step's body rather than as a stage name. Needs-first stays truthful to the
 * protocol: baseline Assessments gate pool readiness.
 *
 * Layout contract from the same decision: four equal columns, level at every
 * width; descriptions held to one length band; number chips aligned with
 * their titles; the rule never cuts through a heading.
 *
 * These step kinds are the figure's own vocabulary. They are not the public
 * evidence ledger's record kinds (`PublicImpactEvidenceKind`, labelled in
 * `./evidenceKinds`): Commitment is a narrative stage, never a ledger record
 * or filter.
 */

type CycleStepKind = "needs" | "commitment" | "work" | "learnings";

type ToneClasses = { surface: string; ink: string };

/**
 * One tone per step, all drawn from tokens the editorial dialect already
 * owns: the four domain pastels carry the four stages of the cycle.
 */
const STEP_TONES: Record<CycleStepKind, ToneClasses> = {
  needs: { surface: "bg-domain-education-soft", ink: "text-domain-education" },
  commitment: { surface: "bg-domain-waste-soft", ink: "text-domain-waste" },
  work: { surface: "bg-domain-agro-soft", ink: "text-domain-agro" },
  learnings: { surface: "bg-domain-solar-soft", ink: "text-domain-solar" },
};

/** Display order of the figure. The array is the single source of the order. */
const CYCLE_STEPS: readonly CycleStepKind[] = ["needs", "commitment", "work", "learnings"];

interface CycleStepProps {
  kind: CycleStepKind;
  numeral: string;
  title: ReactNode;
  description: ReactNode;
}

function CycleStep({ kind, numeral, title, description }: CycleStepProps) {
  const tones = STEP_TONES[kind];
  return (
    <li className="flex flex-col gap-3">
      {/* Chip and title share one centered row: at four-up the titles are
          single words, so nothing wraps below the shared rule and the numeral
          reads aligned with its title at every width. */}
      <div className="flex items-center gap-3">
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
    </li>
  );
}

/**
 * Localized title and description per step (experience audit AD-9 draft).
 * The two vocabulary terms a first-time reader may not know — Commitment and
 * Impact Certificate — wrap in `EditorialTermTooltip`; the commitment term
 * comes from the shared `public.pool.terms.*` family so every public surface
 * gives the same first-exposure meaning.
 *
 * A plain formatter rather than a hook: custom hooks belong in
 * `@green-goods/shared`, and this is component-local copy selection.
 */
function stepCopy(
  kind: CycleStepKind,
  formatMessage: IntlShape["formatMessage"]
): { title: ReactNode; description: ReactNode } {
  switch (kind) {
    case "needs":
      return {
        title: formatMessage({
          id: "public.impact.pipeline.step.needs.title",
          defaultMessage: "Needs",
        }),
        description: formatMessage({
          id: "public.impact.pipeline.step.needs.description",
          defaultMessage:
            "Every season starts from what the place and its people need. A baseline Assessment records the starting conditions and what counts as good, so change can be seen against them.",
        }),
      };
    case "commitment":
      return {
        title: (
          <EditorialTermTooltip
            term={formatMessage({
              id: "public.impact.pipeline.step.commitment.title",
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
          id: "public.impact.pipeline.step.commitment.description",
          defaultMessage:
            "Work begins as a commitment to someone. A neighbour offers help or asks for it, another takes it up, and the Garden's pool records who will carry it out and by when.",
        }),
      };
    case "work":
      return {
        title: formatMessage({
          id: "public.impact.pipeline.step.work.title",
          defaultMessage: "Work",
        }),
        description: formatMessage({
          id: "public.impact.pipeline.step.work.description",
          defaultMessage:
            "Gardeners do the work and document it as it happens — photos, measurements, notes. The person it was for, or another eligible confirmer, records that it was kept.",
        }),
      };
    case "learnings":
      return {
        title: formatMessage({
          id: "public.impact.pipeline.step.learnings.title",
          defaultMessage: "Learnings",
        }),
        // One translatable sentence; the <certificate> tag lets each locale
        // place the term where its own word order wants it.
        description: formatMessage(
          {
            id: "public.impact.pipeline.step.learnings.description",
            defaultMessage:
              "Assessments return to measure what changed against the baseline. What was learned, and the approved Work behind it, anchors into an <certificate>Impact Certificate</certificate> — a portable public record built to outlast any one platform.",
          },
          {
            certificate: (chunks) => (
              <EditorialTermTooltip
                term={chunks}
                definition={formatMessage({
                  id: "public.pool.terms.certificate",
                  defaultMessage:
                    "A bundle of approved Work grounded in an Assessment and anchored to a public blockchain so the record stays readable beyond any one platform.",
                })}
              />
            ),
          }
        ),
      };
  }
}

function LocalizedCycleStep({ kind, index }: { kind: CycleStepKind; index: number }) {
  const { formatMessage } = useIntl();
  const copy = stepCopy(kind, formatMessage);
  return (
    <CycleStep
      kind={kind}
      numeral={`${index + 1}.`}
      title={copy.title}
      description={copy.description}
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
          {/* The rule runs behind the numeral chips once all four steps share
              a row. Below `lg` the list stacks and the rule is withdrawn, so
              it never cuts through a heading. */}
          <div
            aria-hidden="true"
            className="absolute top-[calc(2.5rem+18px)] right-6 left-6 hidden h-px bg-stroke-soft-200 lg:block"
          />
          <ol
            className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4 lg:gap-8"
            aria-label={formatMessage({
              id: "public.impact.pipeline.figureLabel",
              defaultMessage: "The four stages of the cycle, in order",
            })}
          >
            {CYCLE_STEPS.map((kind, index) => (
              <LocalizedCycleStep key={kind} kind={kind} index={index} />
            ))}
          </ol>

          {/* The loop closes for the whole figure: a full-width footer under
              all four columns, never a caption inside the last one (AD-9). */}
          <p className="mt-10 border-t border-stroke-soft-200 pt-6 font-serif text-base italic leading-[1.55] text-text-sub-600 md:text-lg">
            {formatMessage({
              id: "public.impact.pipeline.loop",
              defaultMessage: "→ and what was learned shapes the next season's needs.",
            })}
          </p>
        </div>

        {footnote ? (
          <p className="mt-8 max-w-3xl font-serif text-base italic leading-[1.55] text-text-sub-600 md:text-lg">
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
