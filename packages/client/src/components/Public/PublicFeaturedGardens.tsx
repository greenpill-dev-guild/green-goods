import { type PublicGardenSummary, usePublicGardens } from "@green-goods/shared";
import { useMemo } from "react";
import { useIntl } from "react-intl";
import { publicCuration } from "@/content/publicCuration";
import { PublicGardenCard } from "./PublicGardenCard";

const FEATURED_FALLBACK_LIMIT = 3;

function pickFeatured(
  all: readonly PublicGardenSummary[],
  curatedKeys: readonly string[]
): readonly PublicGardenSummary[] {
  if (all.length === 0) return [];

  if (curatedKeys.length > 0) {
    const indexById = new Map<string, PublicGardenSummary>();
    for (const garden of all) {
      indexById.set(garden.id.toLowerCase(), garden);
      indexById.set(garden.address.toLowerCase(), garden);
    }
    const matched = curatedKeys
      .map((key) => indexById.get(key.toLowerCase()))
      .filter((garden): garden is PublicGardenSummary => garden !== undefined);
    if (matched.length >= FEATURED_FALLBACK_LIMIT) {
      return matched.slice(0, FEATURED_FALLBACK_LIMIT);
    }
    if (matched.length > 0) {
      const remaining = all.filter(
        (garden) => !matched.some((curated) => curated.id.toLowerCase() === garden.id.toLowerCase())
      );
      return [...matched, ...remaining].slice(0, FEATURED_FALLBACK_LIMIT);
    }
  }

  // No curation, or zero matches: fall back to most recently active.
  return [...all]
    .sort((left, right) => right.lastActivityAt - left.lastActivityAt)
    .slice(0, FEATURED_FALLBACK_LIMIT);
}

/**
 * PublicFeaturedGardens — lead-plus-two editorial layout.
 * Pulls curation from `publicCuration` and falls back to recent active Gardens.
 */
export function PublicFeaturedGardens() {
  const { formatMessage } = useIntl();
  const { data: gardens = [], isLoading } = usePublicGardens();

  const featured = useMemo(
    () => pickFeatured(gardens, publicCuration.featuredGardens as string[]),
    [gardens]
  );

  return (
    <section className="bg-bg-weak-50 py-16" aria-labelledby="public-featured-title">
      <div className="mx-auto max-w-7xl px-6 sm:px-10">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <h2
            id="public-featured-title"
            className="font-serif text-2xl text-text-strong-950 md:text-3xl"
          >
            {formatMessage({
              id: "public.home.featured.title",
              defaultMessage: "Gardens making the work visible",
            })}
          </h2>
        </header>

        {isLoading ? (
          <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-80 animate-pulse rounded-3xl bg-bg-white-0"
                aria-hidden="true"
              />
            ))}
          </div>
        ) : featured.length === 0 ? (
          <p className="mt-8 rounded-2xl border border-dashed border-stroke-soft-200 bg-bg-white-0 p-8 text-sm text-text-sub-600">
            {formatMessage({
              id: "public.home.featured.empty",
              defaultMessage: "Featured Gardens will appear here as they come online.",
            })}
          </p>
        ) : (
          <div className="mt-8 grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <PublicGardenCard garden={featured[0]} variant="lead" />
            </div>
            <div className="grid gap-6">
              {featured.slice(1, 3).map((garden) => (
                <PublicGardenCard key={garden.id} garden={garden} />
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
