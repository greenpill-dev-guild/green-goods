import { useIntl } from "react-intl";
import { Link } from "react-router-dom";

interface LoopStep {
  labelId: string;
  defaultLabel: string;
  to: string;
}

const STEPS: readonly LoopStep[] = [
  {
    labelId: "public.home.loop.assess",
    defaultLabel: "Assess the place",
    to: "/impact",
  },
  {
    labelId: "public.home.loop.work",
    defaultLabel: "Do the work",
    to: "/actions",
  },
  {
    labelId: "public.home.loop.verify",
    defaultLabel: "Verify impact",
    to: "/impact",
  },
  {
    labelId: "public.home.loop.fund",
    defaultLabel: "Fund what grows",
    to: "/fund",
  },
] as const;

/**
 * PublicRecordLoop — visitor-facing narrative loop. Each step links contextually.
 * Narrative copy only; this is not a formal claim that EAS Assessment happens
 * before Work in the data model.
 */
export function PublicRecordLoop() {
  const { formatMessage } = useIntl();

  return (
    <section className="bg-bg-white-0 py-16" aria-labelledby="public-loop-title">
      <div className="mx-auto max-w-7xl px-6 sm:px-10">
        <h2 id="public-loop-title" className="font-serif text-2xl text-text-strong-950 md:text-3xl">
          {formatMessage({
            id: "public.home.loop.title",
            defaultMessage: "How regenerative work goes onchain",
          })}
        </h2>
        <ol className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map(({ labelId, defaultLabel, to }, index) => (
            <li key={labelId}>
              <Link
                to={to}
                className="group flex h-full flex-col gap-3 rounded-2xl border border-stroke-soft-200 bg-bg-white-0 p-6 transition-colors hover:border-primary-base hover:bg-bg-weak-50"
              >
                <span className="font-serif text-2xl text-primary-base">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="text-base font-medium text-text-strong-950 group-hover:text-primary-base">
                  {formatMessage({ id: labelId, defaultMessage: defaultLabel })}
                </span>
              </Link>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
