import { publicGardenHelpers, usePublicGardens } from "@green-goods/shared";
import { useMemo } from "react";
import { useIntl } from "react-intl";
import { Link, useParams } from "react-router-dom";
import { ImageWithFallback } from "@/components/Display";
import { PublicInstallAction } from "@/components/Public/PublicInstallAction";
import { PublicInstallCta } from "@/components/Public/PublicInstallCta";

/**
 * GardenDetail — public Garden story page.
 *
 * Content order: Place → Work → Evidence → Fund.
 * Side rail (desktop) carries counts, funding CTA, and Install/Open App.
 */
export default function GardenDetail() {
  const { id } = useParams<{ id: string }>();
  const { formatMessage } = useIntl();
  const { data: gardens = [] } = usePublicGardens();

  const garden = useMemo(() => {
    if (!id) return undefined;
    const lower = id.trim().toLowerCase();
    const exact = gardens.find(
      (g) => g.id.toLowerCase() === lower || g.address.toLowerCase() === lower
    );
    if (exact) return exact;
    const slugMatches = gardens.filter(
      (g) => publicGardenHelpers.deriveSlug(g.name, g.id) === lower
    );
    return slugMatches.length === 1 ? slugMatches[0] : undefined;
  }, [gardens, id]);

  if (!garden) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-16">
        <h1 className="font-serif text-3xl text-text-strong-950">
          {formatMessage({
            id: "public.gardenDetail.notFound",
            defaultMessage: "Garden not found",
          })}
        </h1>
        <p className="mt-3 text-sm text-text-sub-600">
          {formatMessage({
            id: "public.gardenDetail.notFoundHelp",
            defaultMessage:
              "The link may be stale. Browse all Gardens to find what you're looking for.",
          })}
        </p>
        <Link
          to="/gardens"
          className="mt-6 inline-flex rounded-full border border-stroke-soft-200 bg-bg-white-0 px-5 py-2.5 text-sm font-medium text-text-strong-950 hover:bg-bg-weak-50"
        >
          {formatMessage({
            id: "public.gardenDetail.backToGardens",
            defaultMessage: "Browse Gardens",
          })}
        </Link>
      </div>
    );
  }

  const slug = garden.slug;
  const fundHref = `/fund?garden=${encodeURIComponent(slug)}`;
  return (
    <article className="bg-bg-weak-50">
      <header className="relative">
        <div className="aspect-[16/9] w-full overflow-hidden bg-bg-weak-50 sm:aspect-[3/1]">
          <ImageWithFallback
            src={garden.bannerImage || "/images/no-image-placeholder.png"}
            alt={garden.name}
            className="h-full w-full object-cover"
          />
        </div>
        <div className="mx-auto -mt-16 max-w-6xl px-6 sm:-mt-24 sm:px-10">
          <div className="rounded-3xl bg-bg-white-0 p-6 shadow-md sm:p-10">
            <p className="text-xs font-medium uppercase tracking-wide text-text-soft-400">
              {garden.location}
            </p>
            <h1
              className="mt-2 font-serif text-3xl text-text-strong-950 md:text-5xl"
              title={garden.name}
            >
              {garden.name}
            </h1>
            {garden.description ? (
              <p className="mt-4 max-w-2xl text-sm text-text-sub-600 md:text-base">
                {garden.description}
              </p>
            ) : null}
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-10 px-6 py-12 sm:px-10 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-10">
          <section aria-labelledby="garden-place-title">
            <h2 id="garden-place-title" className="font-serif text-2xl text-text-strong-950">
              {formatMessage({
                id: "public.gardenDetail.place.title",
                defaultMessage: "About this Garden",
              })}
            </h2>
            <p className="mt-3 text-sm text-text-sub-600 md:text-base">
              {garden.description ||
                formatMessage({
                  id: "public.gardenDetail.place.empty",
                  defaultMessage: "Garden narrative will appear here as it is published.",
                })}
            </p>
          </section>

          <section aria-labelledby="garden-work-title">
            <h2 id="garden-work-title" className="font-serif text-2xl text-text-strong-950">
              {formatMessage({
                id: "public.gardenDetail.work.title",
                defaultMessage: "Work",
              })}
            </h2>
            <p className="mt-3 text-sm text-text-sub-600">
              {formatMessage(
                {
                  id: "public.gardenDetail.work.summary",
                  defaultMessage:
                    "{count} {count, plural, one {Work entry} other {Work entries}} documented in the public record.",
                },
                { count: garden.actionCount }
              )}
            </p>
          </section>

          <section aria-labelledby="garden-evidence-title">
            <h2 id="garden-evidence-title" className="font-serif text-2xl text-text-strong-950">
              {formatMessage({
                id: "public.gardenDetail.evidence.title",
                defaultMessage: "Evidence",
              })}
            </h2>
            <p className="mt-3 text-sm text-text-sub-600">
              {formatMessage({
                id: "public.gardenDetail.evidence.summary",
                defaultMessage:
                  "Browse the Impact ledger to see Assessments and Work entries across Gardens.",
              })}
            </p>
            <Link
              to="/impact"
              className="mt-4 inline-flex rounded-full border border-stroke-soft-200 bg-bg-white-0 px-4 py-2 text-sm font-medium text-text-strong-950 hover:bg-bg-weak-50"
            >
              {formatMessage({
                id: "public.gardenDetail.evidence.cta",
                defaultMessage: "View public evidence",
              })}
            </Link>
          </section>

          <section aria-labelledby="garden-fund-title">
            <h2 id="garden-fund-title" className="font-serif text-2xl text-text-strong-950">
              {formatMessage({
                id: "public.gardenDetail.fund.title",
                defaultMessage: "Fund this Garden",
              })}
            </h2>
            <p className="mt-3 text-sm text-text-sub-600">
              {formatMessage({
                id: "public.gardenDetail.fund.description",
                defaultMessage:
                  "Donate directly to the Garden's Cookie Jar, or Endow the Vault — a long-term deposit designed to keep its principal while yield supports the Garden.",
              })}
            </p>
            <Link
              to={fundHref}
              className="mt-4 inline-flex rounded-full bg-primary-action px-5 py-2.5 text-sm font-semibold text-primary-action-foreground hover:bg-primary-action-hover"
            >
              {formatMessage({
                id: "public.gardenDetail.fund.cta",
                defaultMessage: "Support this Garden",
              })}
            </Link>
          </section>
        </div>

        <aside className="flex flex-col gap-4">
          <div className="rounded-3xl border border-stroke-soft-200 bg-bg-white-0 p-5">
            <dl className="flex flex-col gap-3 text-sm">
              <div className="flex items-center justify-between">
                <dt className="text-text-sub-600">
                  {formatMessage({
                    id: "public.gardenDetail.stats.contributors",
                    defaultMessage: "Contributors",
                  })}
                </dt>
                <dd className="font-medium text-text-strong-950">{garden.contributorCount}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-text-sub-600">
                  {formatMessage({
                    id: "public.gardenDetail.stats.work",
                    defaultMessage: "Work",
                  })}
                </dt>
                <dd className="font-medium text-text-strong-950">{garden.actionCount}</dd>
              </div>
            </dl>
          </div>
          <Link
            to={fundHref}
            className="rounded-full bg-primary-action px-5 py-3 text-center text-sm font-semibold text-primary-action-foreground hover:bg-primary-action-hover"
          >
            {formatMessage({
              id: "public.gardenDetail.fund.cta",
              defaultMessage: "Support this Garden",
            })}
          </Link>
          <PublicInstallAction>
            {({ label, href, onClick, dataInstallAction }) => (
              <a
                href={href}
                onClick={onClick}
                data-install-action={dataInstallAction}
                className="cursor-pointer rounded-full border border-stroke-soft-200 bg-bg-white-0 px-5 py-3 text-center text-sm font-medium text-text-strong-950 hover:bg-bg-weak-50"
              >
                {label}
              </a>
            )}
          </PublicInstallAction>
        </aside>
      </div>

      <PublicInstallCta />
    </article>
  );
}
