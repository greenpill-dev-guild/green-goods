import { type PublicGardenSummary, usePublicGardens } from "@green-goods/shared";
import { useMemo, useState } from "react";
import { useIntl } from "react-intl";
import { EditorialDivider, EditorialKicker, EditorialTitleAccent } from "@/components/Public/atoms";
import { PublicEditorialHero } from "@/components/Public/PublicEditorialHero";
import { PublicFooter } from "@/components/Public/PublicFooter";
import { PublicGardenCard } from "@/components/Public/PublicGardenCard";
import { getPublicHeroImage, publicCuration } from "@/content/publicCuration";

/**
 * Gardens — public discovery and browsing view.
 *
 * Editorial hero (no kicker per chat 3 brief), then a search input over a
 * structured Garden grid. Cards link to `/gardens/:slug` and render
 * confirmed-only metadata. The Featured row deliberately doesn't appear here
 * because the Home page handles curation; this page makes every Garden feel
 * discoverable.
 */
export default function GardensGallery() {
  const { formatMessage } = useIntl();
  const { data: gardens = [], isLoading } = usePublicGardens();
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length === 0) return gardens;
    return gardens.filter((garden) => {
      const haystack = [garden.name, garden.location, garden.description, garden.slug]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [gardens, query]);

  return (
    <>
      <PublicEditorialHero
        variant="banner"
        imageSrc={getPublicHeroImage("gardens")}
        imageFallbackSrc={publicCuration.fallbackImagePaths[0]}
        imageAlt=""
        titleId="public-gardens-hero-title"
        title={formatMessage(
          {
            id: "public.gardens.heroTitle",
            defaultMessage: "Explore the <accent>Gardens</accent> growing the public record.",
          },
          {
            accent: (chunks) => <EditorialTitleAccent>{chunks}</EditorialTitleAccent>,
          }
        )}
        lede={formatMessage({
          id: "public.gardens.heroLede",
          defaultMessage:
            "Each Garden is a real place where communities document regenerative Work. Operators, gardeners, and evaluators take turns making the record honest. What lands here is meant to hold up under public reading.",
        })}
      />

      <section
        id="archive"
        className="bg-bg-weak-50 px-6 pt-32 pb-16 sm:px-10 sm:pt-36 md:pt-40 md:pb-20"
        aria-labelledby="public-gardens-archive-title"
      >
        <div className="mx-auto max-w-7xl">
          <header className="flex flex-col gap-6 border-b border-stroke-soft-200 pb-6 sm:flex-row sm:items-end sm:justify-between sm:gap-8">
            <div>
              <EditorialKicker className="mb-3">
                {formatMessage({ id: "public.gardens.kicker", defaultMessage: "Living Archive" })}
              </EditorialKicker>
              <h2
                id="public-gardens-archive-title"
                className="font-serif text-3xl font-normal leading-[1.04] tracking-[-0.02em] text-text-strong-950 md:text-4xl"
              >
                {formatMessage({
                  id: "public.gardens.archiveTitle",
                  defaultMessage: "Browse every Garden under documentation.",
                })}
              </h2>
            </div>
            <label className="relative w-full sm:max-w-xs">
              <span className="sr-only">
                {formatMessage({
                  id: "public.gardens.searchLabel",
                  defaultMessage: "Search Gardens",
                })}
              </span>
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={formatMessage({
                  id: "public.gardens.searchPlaceholder",
                  defaultMessage: "Search Gardens…",
                })}
                className="w-full border-b border-stroke-soft-200 bg-transparent px-1 pb-2 font-serif text-lg text-text-strong-950 placeholder-text-soft-400 focus:border-primary-action focus:outline-none"
              />
            </label>
          </header>

          {!isLoading && filtered.length > 0 ? (
            <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.16em] text-text-soft-400">
              {formatMessage(
                {
                  id: "public.gardens.archiveCount",
                  defaultMessage: "{count, plural, one {# Garden} other {# Gardens}}",
                },
                { count: filtered.length }
              )}
            </p>
          ) : null}

          {/* Reserve a stable height so filtering down to a single result
              does not collapse the page and shift the footer up. */}
          <div className="min-h-[60vh]">
            {isLoading ? (
              <div className="mt-12 grid grid-cols-1 gap-12 sm:grid-cols-2 lg:grid-cols-3">
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <div
                    key={i}
                    className="aspect-[3/2] w-full animate-pulse bg-editorial-warm"
                    aria-hidden="true"
                  />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="mt-12">
                <p className="font-serif text-2xl italic text-text-soft-400">
                  {query.trim().length > 0
                    ? formatMessage(
                        {
                          id: "public.gardens.noMatches",
                          defaultMessage: 'No Gardens match "{query}".',
                        },
                        { query: query.trim() }
                      )
                    : formatMessage({
                        id: "public.gardens.empty",
                        defaultMessage: "Gardens will appear here as they come online.",
                      })}
                </p>
                <div className="mt-6">
                  <EditorialDivider />
                </div>
              </div>
            ) : (
              <div className="mt-12 grid grid-cols-1 gap-12 sm:grid-cols-2 lg:grid-cols-3">
                {filtered.map((garden: PublicGardenSummary) => (
                  <PublicGardenCard key={garden.id} garden={garden} />
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      <PublicFooter variant="soil" />
    </>
  );
}
