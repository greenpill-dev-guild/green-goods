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
    numeral: "i.",
    titleId: "public.home.loop.assess",
    defaultTitle: "Assess the place.",
    bodyId: "public.home.loop.assessBody",
    defaultBody:
      "Begin where you are. Map what's living, what's struggling, and what the land remembers — recorded simply, in the gardener's own hand.",
    to: "/impact",
  },
  {
    numeral: "ii.",
    titleId: "public.home.loop.work",
    defaultTitle: "Do the work.",
    bodyId: "public.home.loop.workBody",
    defaultBody:
      "Plant, prune, mulch, repair. Each entry is timestamped, photographed, and attached to a Garden — the ledger of a season's labour.",
    to: "/actions",
  },
  {
    numeral: "iii.",
    titleId: "public.home.loop.verify",
    defaultTitle: "Verify impact.",
    bodyId: "public.home.loop.verifyBody",
    defaultBody:
      "An independent evaluator visits, witnesses, and signs off. Not an audit — a neighbourly second opinion, anchored to public reference.",
    to: "/impact",
  },
  {
    numeral: "iv.",
    titleId: "public.home.loop.fund",
    defaultTitle: "Fund what grows.",
    bodyId: "public.home.loop.fundBody",
    defaultBody:
      "Funders read the record and support what's working. The loop closes; another season begins.",
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

  return (
    <section className="bg-bg-weak-50" aria-labelledby="public-loop-title">
      <div className="mx-auto max-w-7xl px-6 py-20 sm:px-10 md:py-28">
        <div className="max-w-3xl">
          <EditorialKicker className="mb-5">
            {formatMessage({
              id: "public.home.loop.kicker",
              defaultMessage: "§ 03 — Regenerative Work Loop",
            })}
          </EditorialKicker>
          <EditorialHeading id="public-loop-title">
            {formatMessage({
              id: "public.home.loop.title",
              defaultMessage: "Four steps. Repeated, season after season, in public.",
            })}
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
                className="group grid grid-cols-[3rem_1fr] gap-4 border-t border-stroke-soft-200 py-7 transition-colors hover:bg-bg-white-0/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-action focus-visible:ring-offset-2 sm:grid-cols-[5rem_1fr] sm:gap-8 md:grid-cols-[7rem_1.1fr_1fr] md:gap-12"
              >
                <span className="pt-2">
                  <EditorialNumeral>{numeral}</EditorialNumeral>
                </span>
                <h3 className="font-serif text-2xl font-normal leading-[1.05] tracking-[-0.018em] text-text-strong-950 group-hover:text-primary-action md:text-4xl">
                  {formatMessage({ id: titleId, defaultMessage: defaultTitle })}
                </h3>
                <p className="text-sm leading-[1.6] text-text-sub-600 md:text-base">
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
