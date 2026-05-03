import { useInViewReveal } from "@green-goods/shared";
import { useIntl } from "react-intl";
import { Link } from "react-router-dom";
import { EditorialHeading, EditorialKicker, EditorialNumeral } from "./atoms";

interface LoopStep {
  numeral: string;
  titleId: string;
  defaultTitle: string;
  bodyId: string;
  defaultBody: string;
  to: string;
}

const STEPS: readonly LoopStep[] = [
  {
    numeral: "1.",
    titleId: "public.home.loop.assess",
    defaultTitle: "Assess the place.",
    bodyId: "public.home.loop.assessBody",
    defaultBody:
      "A Garden gathers gardeners, operators, evaluators, and (ideally) funders around a real place — together they read where it is and where it's meant to go.",
    to: "/impact",
  },
  {
    numeral: "2.",
    titleId: "public.home.loop.work",
    defaultTitle: "Do the work.",
    bodyId: "public.home.loop.workBody",
    defaultBody:
      "Gardeners submit Work from the field with media, details, and metadata. Operators review those submissions before they become part of the public record.",
    to: "/actions",
  },
  {
    numeral: "3.",
    titleId: "public.home.loop.verify",
    defaultTitle: "Verify impact.",
    bodyId: "public.home.loop.verifyBody",
    defaultBody:
      "Operators bundle the approved Work into an Impact Certificate. Evaluators — from many backgrounds, not only topical experts — then verify what the certificate claims.",
    to: "/impact",
  },
  {
    numeral: "4.",
    titleId: "public.home.loop.fund",
    defaultTitle: "Fund what grows.",
    bodyId: "public.home.loop.fundBody",
    defaultBody:
      "A Garden's community and funders give directly today, or commit a deposit so yield supports the Work over time.",
    to: "/fund",
  },
] as const;

/**
 * PublicRecordLoop — visitor-facing narrative loop in editorial rhythm. Each
 * step is a hairline-bordered row with an italic numeral, a Fraunces title,
 * and a restrained body paragraph linking contextually to the relevant view.
 *
 * Narrative copy only — this is the visitor-facing story of the regenerative
 * cycle, not a formal claim about the data model's order. The Impact page's
 * pipeline figure carries the canonical Assessment → Work → Certificate cycle.
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
      <div className="mx-auto max-w-7xl">
        <div className="max-w-3xl">
          <EditorialKicker className="mb-5 whitespace-nowrap text-[10px] tracking-[0.08em] sm:text-[11px] sm:tracking-[0.16em]">
            {formatMessage({
              id: "public.home.loop.kicker",
              defaultMessage: "§ 03: Regenerative Work Loop",
            })}
          </EditorialKicker>
          <EditorialHeading id="public-loop-title">
            {formatMessage(
              {
                id: "public.home.loop.title",
                defaultMessage: "Four steps. Repeated, <line2>season after season</line2>",
              },
              {
                line2: (chunks) => <span className="block">{chunks}</span>,
              }
            )}
          </EditorialHeading>
        </div>

        <ol className="mt-12">
          {STEPS.map(({ numeral, titleId, defaultTitle, bodyId, defaultBody, to }, index) => (
            <li
              key={titleId}
              className={index === STEPS.length - 1 ? "border-b border-stroke-soft-200" : ""}
            >
              <Link
                to={to}
                viewTransition
                className="group grid grid-cols-[3rem_1fr] gap-4 border-t border-stroke-soft-200 py-7 transition-colors hover:bg-bg-white-0/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-action focus-visible:ring-offset-2 sm:grid-cols-[5rem_1fr] sm:gap-8 md:grid-cols-[7rem_1.1fr_1fr] md:gap-12"
              >
                <span className="pt-2">
                  <EditorialNumeral>{numeral}</EditorialNumeral>
                </span>
                <h3 className="min-w-0 font-serif text-2xl font-normal leading-[1.05] tracking-[-0.018em] text-text-strong-950 group-hover:text-primary-action md:text-4xl">
                  {formatMessage({ id: titleId, defaultMessage: defaultTitle })}
                </h3>
                <p className="col-start-2 min-w-0 text-sm leading-[1.6] text-text-sub-600 md:col-start-auto md:text-base">
                  {formatMessage({ id: bodyId, defaultMessage: defaultBody })}
                </p>
              </Link>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
