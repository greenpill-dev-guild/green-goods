import { useInViewReveal } from "@green-goods/shared/hooks/ui/useInViewReveal";
import { useIntl } from "react-intl";
import { Link } from "react-router-dom";
import { EditorialHeading, EditorialKicker, EditorialNumeral } from "./atoms";
import {
  CYCLE_LOOP_MESSAGE,
  CYCLE_STEP_MESSAGES,
  CYCLE_STEPS,
  type CycleStepKind,
} from "./cycleSteps";

/** Where each step can be seen on the site. */
const STEP_DESTINATIONS: Record<CycleStepKind, string> = {
  needs: "/impact",
  commitment: "/gardens",
  work: "/actions",
  learnings: "/impact",
};

/**
 * PublicRecordLoop — the home page's "How it works": the Garden cycle in the
 * same four steps and words as the `/impact` figure (`./cycleSteps`), so a
 * visitor meets one story, commitments included. Each step is a hairline row
 * with an italic numeral, a Fraunces title, and a short body, linking to where
 * that step can be seen on the site.
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
              id: "public.impact.pipeline.title",
              defaultMessage: "From need to learning, season after season.",
            })}
          </EditorialHeading>
        </div>

        <ol className="mt-12">
          {CYCLE_STEPS.map((kind, index) => (
            <li
              key={kind}
              className={index === CYCLE_STEPS.length - 1 ? "border-b border-stroke-soft-200" : ""}
            >
              <Link
                to={STEP_DESTINATIONS[kind]}
                viewTransition
                className="group grid grid-cols-[3rem_1fr] gap-4 border-t border-stroke-soft-200 py-7 transition-colors hover:bg-bg-white-0/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-action focus-visible:ring-offset-2 sm:gap-x-6 xl:grid-cols-[7rem_1.1fr_1fr] xl:gap-12"
              >
                <span className="pt-2">
                  <EditorialNumeral>{`${index + 1}.`}</EditorialNumeral>
                </span>
                <h3 className="flex min-w-0 items-baseline gap-3 font-serif text-2xl font-normal leading-[1.05] tracking-[-0.018em] text-text-strong-950 group-hover:text-primary-action sm:justify-between md:text-3xl xl:justify-start xl:text-4xl">
                  <span className="min-w-0">{formatMessage(CYCLE_STEP_MESSAGES[kind].title)}</span>
                  <span
                    aria-hidden="true"
                    className="shrink-0 text-base text-text-soft-400 transition-transform group-hover:translate-x-0.5 group-hover:text-primary-action md:text-2xl"
                  >
                    →
                  </span>
                </h3>
                <p className="col-start-2 min-w-0 max-w-prose text-sm leading-[1.6] text-text-sub-600 md:text-base xl:col-start-auto">
                  {formatMessage(CYCLE_STEP_MESSAGES[kind].description, {
                    certificate: (chunks) => chunks,
                  })}
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
