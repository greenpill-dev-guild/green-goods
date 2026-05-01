import { type PublicGardenSummary, usePublicGardens } from "@green-goods/shared";
import { useMemo } from "react";
import { useIntl } from "react-intl";
import { publicCuration } from "@/content/publicCuration";
import { EditorialHeading, EditorialKicker, EditorialLinkArrow } from "./atoms";
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
 *
 * One large lead Garden card and two stacked secondaries — the dialect's
 * curation rhythm (versus a 3-up grid). Curation comes from publicCuration
 * keyed by Garden id/address; falls back to recent active Gardens when
 * curation is empty or unmatched.
 *
 * Note: this section is the first thing below the hero on Home, so it
 * applies generous top padding to absorb the hero card's overlap.
 */
export function PublicFeaturedGardens() {
  const { formatMessage } = useIntl();
  const { data: gardens = [], isLoading } = usePublicGardens();

  const featured = useMemo(
    () => pickFeatured(gardens, publicCuration.featuredGardens as string[]),
    [gardens]
  );

  return (
    <section
      className="bg-bg-weak-50 px-6 pt-32 pb-16 sm:px-10 md:pt-48 md:pb-24"
      aria-labelledby="public-featured-title"
    >
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-col gap-4 border-b border-stroke-soft-200 pb-6 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
          <div>
            <EditorialKicker className="mb-3">
              {formatMessage({
                id: "public.home.featured.kicker",
                defaultMessage: "§ 01 — Featured Gardens",
              })}
            </EditorialKicker>
            <EditorialHeading id="public-featured-title">
              {formatMessage({
                id: "public.home.featured.title",
                defaultMessage: "Tended places, openly recorded.",
              })}
            </EditorialHeading>
          </div>
          <EditorialLinkArrow to="/gardens">
            {formatMessage({
              id: "public.home.featured.cta",
              defaultMessage: "Browse the living archive",
            })}
          </EditorialLinkArrow>
        </header>

        {isLoading ? (
          <div className="mt-12 grid grid-cols-1 gap-12 lg:grid-cols-[1.35fr_1fr]">
            <div className="aspect-[4/3] w-full animate-pulse bg-editorial-warm" />
            <div className="grid gap-12">
              <div className="aspect-[3/2] w-full animate-pulse bg-editorial-warm" />
              <div className="aspect-[3/2] w-full animate-pulse bg-editorial-warm" />
            </div>
          </div>
        ) : featured.length === 0 ? (
          <p className="mt-12 max-w-md text-sm text-text-sub-600">
            {formatMessage({
              id: "public.home.featured.empty",
              defaultMessage: "Featured Gardens will appear here as they come online.",
            })}
          </p>
        ) : (
          <div className="mt-12 grid grid-cols-1 gap-12 lg:grid-cols-[1.35fr_1fr] lg:gap-16">
            <PublicGardenCard garden={featured[0]} variant="lead" />
            <div className="grid gap-12">
              {featured.slice(1, 3).map((garden, index) => (
                <div key={garden.id} className="flex flex-col gap-6">
                  <PublicGardenCard garden={garden} />
                  {index < featured.slice(1, 3).length - 1 ? (
                    <hr aria-hidden="true" className="h-px border-0 bg-stroke-soft-200" />
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
