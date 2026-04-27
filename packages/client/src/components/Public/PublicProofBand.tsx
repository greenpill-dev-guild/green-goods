import { useIntl } from "react-intl";
import { Link } from "react-router-dom";

export interface PublicProofBandProps {
  gardens: number;
  contributors: number;
  works: number;
  assessments: number;
  isLoading?: boolean;
}

/**
 * PublicProofBand — confirmed counts only (Gardens, contributors, Work,
 * Assessments). Links contextually to `/impact`. Unavailable carbon, water,
 * species, and area metrics are deliberately hidden.
 */
export function PublicProofBand({
  gardens,
  contributors,
  works,
  assessments,
  isLoading = false,
}: PublicProofBandProps) {
  const { formatMessage } = useIntl();

  const stats = [
    {
      labelId: "public.home.proof.gardens",
      defaultLabel: "Gardens",
      value: gardens,
    },
    {
      labelId: "public.home.proof.contributors",
      defaultLabel: "Contributors",
      value: contributors,
    },
    {
      labelId: "public.home.proof.works",
      defaultLabel: "Work",
      value: works,
    },
    {
      labelId: "public.home.proof.assessments",
      defaultLabel: "Assessments",
      value: assessments,
    },
  ] as const;

  return (
    <section
      className="border-y border-stroke-soft-200 bg-bg-weak-50 py-12"
      aria-labelledby="public-proof-title"
    >
      <div className="mx-auto max-w-7xl px-6 sm:px-10">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2
            id="public-proof-title"
            className="font-serif text-2xl text-text-strong-950 md:text-3xl"
          >
            {formatMessage({
              id: "public.home.proof.title",
              defaultMessage: "Living public record",
            })}
          </h2>
          <Link to="/impact" className="text-sm font-medium text-primary-base hover:underline">
            {formatMessage({ id: "public.home.proof.cta", defaultMessage: "See full impact →" })}
          </Link>
        </div>
        <dl className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {stats.map(({ labelId, defaultLabel, value }) => (
            <div key={labelId} className="rounded-2xl bg-bg-white-0 p-5 shadow-sm">
              <dt className="text-xs font-medium uppercase tracking-wide text-text-soft-400">
                {formatMessage({ id: labelId, defaultMessage: defaultLabel })}
              </dt>
              <dd className="mt-2 font-serif text-3xl text-text-strong-950 md:text-4xl">
                {isLoading ? "—" : new Intl.NumberFormat().format(value)}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
