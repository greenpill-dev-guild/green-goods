import { useInViewReveal } from "@green-goods/shared/hooks/ui/useInViewReveal";
import { type MessageDescriptor, useIntl } from "react-intl";
import { Link } from "react-router-dom";
import { EditorialHeading, EditorialKicker, EditorialNumeral } from "./atoms";
import { CYCLE_LOOP_MESSAGE, CYCLE_STEP_MESSAGES } from "./cycleSteps";

interface LoopStep {
  /** The stage the step belongs to, shown as a small label over its action. */
  label: MessageDescriptor;
  /** What the step asks of the people involved, as the row's title. */
  action: MessageDescriptor;
  description: MessageDescriptor;
  /** Where the step can be seen on the site. */
  to: string;
}

/**
 * The visitor's plan (Afo, 2026-10-13): the first three stages of the `/impact`
 * cycle in its names and words, each led by the action it asks for, then funding.
 * `/impact` keeps Learnings as its fourth stage; here the loop line closes it.
 */
const LOOP_STEPS: readonly LoopStep[] = [
  {
    label: CYCLE_STEP_MESSAGES.needs.title,
    action: { id: "public.home.loop.step.needs.action", defaultMessage: "Assess the needs." },
    description: CYCLE_STEP_MESSAGES.needs.description,
    to: "/impact",
  },
  {
    label: CYCLE_STEP_MESSAGES.commitment.title,
    action: {
      id: "public.home.loop.step.commitment.action",
      defaultMessage: "Plan, then commit.",
    },
    description: CYCLE_STEP_MESSAGES.commitment.description,
    to: "/gardens",
  },
  {
    label: CYCLE_STEP_MESSAGES.work.title,
    action: { id: "public.home.loop.step.work.action", defaultMessage: "Report the work." },
    description: CYCLE_STEP_MESSAGES.work.description,
    to: "/actions",
  },
  {
    label: { id: "public.home.loop.step.funding.label", defaultMessage: "Funding" },
    action: { id: "public.home.loop.step.funding.action", defaultMessage: "Fund what grows." },
    description: {
      id: "public.home.loop.step.funding.description",
      defaultMessage:
        "Supporters donate to a garden's shared fund or endow its vault, whose yield supports the work.",
    },
    to: "/fund",
  },
];

/**
 * PublicRecordLoop — the home page's "How it works": four steps a Garden repeats,
 * each a hairline row with its number and stage, a Fraunces action title, and a
 * short body, linking to where that step can be seen on the site.
 */
export function PublicRecordLoop() {
  const { formatMessage } = useIntl();
  const { ref: sectionRef, revealed } = useInViewReveal<HTMLElement>();

  return (
    <section
      ref={sectionRef}
      data-revealed={revealed}
      className="editorial-section-reveal bg-bg-weak-50 px-6 py-20 sm:px-10 md:py-28"
      aria-labelledby="public-loop-title"
    >
      <div className="editorial-cascade mx-auto max-w-7xl">
        <div className="max-w-3xl">
          <EditorialKicker className="mb-5 whitespace-nowrap text-[10px] tracking-[0.08em] sm:text-[11px] sm:tracking-[0.16em]">
            {formatMessage({
              id: "public.home.loop.kicker",
              defaultMessage: "§ 03: How it works",
            })}
          </EditorialKicker>
          <EditorialHeading id="public-loop-title">
            {formatMessage({
              id: "public.home.loop.title",
              defaultMessage: "Four steps, season after season.",
            })}
          </EditorialHeading>
        </div>

        <ol className="mt-12">
          {LOOP_STEPS.map((step, index) => (
            <li
              key={step.to + step.label.id}
              className={index === LOOP_STEPS.length - 1 ? "border-b border-stroke-soft-200" : ""}
            >
              <Link
                to={step.to}
                viewTransition
                className="group grid grid-cols-[3rem_1fr] gap-4 border-t border-stroke-soft-200 py-7 transition-colors hover:bg-bg-white-0/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-action focus-visible:ring-offset-2 sm:gap-x-6 xl:grid-cols-[7rem_1.1fr_1fr] xl:gap-12"
              >
                <EditorialNumeral className="leading-5">{`${index + 1}.`}</EditorialNumeral>
                <div className="min-w-0">
                  <span className="mb-2 block font-mono text-[11px] font-medium uppercase leading-5 tracking-[0.16em] text-text-soft-400">
                    {formatMessage(step.label)}
                  </span>
                  <h3 className="flex min-w-0 items-baseline gap-3 font-serif text-2xl font-normal leading-[1.05] tracking-[-0.018em] text-text-strong-950 group-hover:text-primary-action sm:justify-between md:text-3xl xl:justify-start xl:text-4xl">
                    <span className="min-w-0">{formatMessage(step.action)}</span>
                    <span
                      aria-hidden="true"
                      className="shrink-0 text-base text-text-soft-400 transition-transform group-hover:translate-x-0.5 group-hover:text-primary-action md:text-2xl"
                    >
                      →
                    </span>
                  </h3>
                </div>
                <p className="col-start-2 min-w-0 max-w-prose text-sm leading-[1.6] text-text-sub-600 md:text-base xl:col-start-auto xl:mt-7">
                  {formatMessage(step.description)}
                </p>
              </Link>
            </li>
          ))}
        </ol>

        <p className="mt-8 max-w-3xl font-serif text-base italic leading-[1.55] text-text-sub-600 md:text-lg">
          {formatMessage(CYCLE_LOOP_MESSAGE)}
        </p>
      </div>
    </section>
  );
}
