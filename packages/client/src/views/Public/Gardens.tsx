import { TextInput } from "@green-goods/shared/components/Form/ControlPrimitives";
import {
  type PublicGardenSummary,
  usePublicGardens,
} from "@green-goods/shared/hooks/public/usePublicGardens";
import { useInViewReveal } from "@green-goods/shared/hooks/ui/useInViewReveal";
import { selectPublicSurfaceState } from "@green-goods/shared/public";
import { useEffect, useMemo, useState } from "react";
import { useIntl } from "react-intl";
import { useNavigationType } from "react-router-dom";
import {
  EditorialDivider,
  EditorialHeading,
  EditorialKicker,
  EditorialMediaCardSkeleton,
  editorialTitleTags,
} from "@/components/Public/atoms";
import { PublicEditorialHero } from "@/components/Public/PublicEditorialHero";
import { PublicFooter } from "@/components/Public/PublicFooter";
import { PublicGardenCard } from "@/components/Public/PublicGardenCard";
import { PublicSurfaceState } from "@/components/Public/PublicSurfaceState";
import { getPublicHeroImage, publicCuration } from "@/content/publicCuration";
import { focusRememberedGardenCard } from "./gardenReturnFocus";

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
  const { data: gardens = [], isLoading, isError, refetch } = usePublicGardens();
  const [query, setQuery] = useState("");
  const navigationType = useNavigationType();
  const { ref: archiveRef, revealed: archiveRevealed } = useInViewReveal<HTMLElement>();

  // Arriving back from a Garden page: ScrollRestoration puts the grid back
  // where it was, this puts focus back on the card the reader opened.
  useEffect(() => {
    if (navigationType !== "POP" || isLoading) return;
    focusRememberedGardenCard();
  }, [isLoading, navigationType]);

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
  const surfaceState = selectPublicSurfaceState({
    isLoading,
    isError,
    itemCount: filtered.length,
  });

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
            defaultMessage:
              "<line>Explore the</line> <line><accent>Gardens</accent> growing</line> <line>the public record</line>",
          },
          editorialTitleTags
        )}
        lede={formatMessage({
          id: "public.gardens.heroLede",
          defaultMessage:
            "Explore community-led projects working on land restoration, waste, education, and clean energy. Meet the people behind each Garden and discover how to support their work.",
        })}
      />

      <section
        id="archive"
        ref={archiveRef}
        data-revealed={archiveRevealed}
        className="editorial-section-reveal bg-bg-weak-50 px-6 pt-32 pb-16 sm:px-10 sm:pt-36 md:pt-40 md:pb-20"
        aria-labelledby="public-gardens-archive-title"
      >
        <div className="mx-auto max-w-7xl">
          <header className="editorial-cascade flex flex-col gap-6 border-b border-stroke-soft-200 pb-6 sm:flex-row sm:items-end sm:justify-between sm:gap-8">
            <div>
              <EditorialKicker className="mb-3">
                {formatMessage({
                  id: "public.gardens.kicker",
                  defaultMessage: "§ 01: Living archive",
                })}
              </EditorialKicker>
              <EditorialHeading id="public-gardens-archive-title">
                {formatMessage({
                  id: "public.gardens.archiveTitle",
                  defaultMessage: "Meet the Gardens.",
                })}
              </EditorialHeading>
            </div>
            <label className="relative w-full sm:max-w-xs">
              <span className="sr-only">
                {formatMessage({
                  id: "public.gardens.searchLabel",
                  defaultMessage: "Search gardens",
                })}
              </span>
              <TextInput
                type="search"
                surface="editorial"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={formatMessage({
                  id: "public.gardens.searchPlaceholder",
                  defaultMessage: "Search Gardens…",
                })}
                className="text-text-strong-950"
              />
            </label>
          </header>

          {!isLoading ? (
            <p
              role="status"
              aria-live="polite"
              className="mt-4 font-mono text-[11px] uppercase tracking-[0.16em] text-text-soft-400"
            >
              {query.trim().length === 0 && filtered.length > 0
                ? formatMessage(
                    {
                      id: "public.gardens.archiveCount",
                      defaultMessage: "{count, plural, one {# Garden} other {# Gardens}}",
                    },
                    { count: filtered.length }
                  )
                : query.trim().length > 0
                  ? formatMessage(
                      {
                        id: "public.gardens.archiveSearchCount",
                        defaultMessage:
                          '{count, plural, =0 {No matches for "{query}"} one {# match for "{query}"} other {# matches for "{query}"}}',
                      },
                      { count: filtered.length, query: query.trim() }
                    )
                  : ""}
            </p>
          ) : null}

          {/* Reserve a stable height so filtering down to a single result
              does not collapse the page and shift the footer up. */}
          <div className="min-h-[60vh]">
            <PublicSurfaceState
              state={surfaceState}
              loading={
                <div className="mt-12 grid grid-cols-1 gap-12 sm:grid-cols-2 lg:grid-cols-3">
                  {[0, 1, 2, 3, 4, 5].map((i) => (
                    <EditorialMediaCardSkeleton key={i} />
                  ))}
                </div>
              }
              onRetry={() => void refetch()}
              empty={
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
              }
            >
              <div className="mt-12 grid grid-cols-1 gap-12 sm:grid-cols-2 lg:grid-cols-3">
                {filtered.map((garden: PublicGardenSummary) => (
                  <PublicGardenCard key={garden.id} garden={garden} />
                ))}
              </div>
            </PublicSurfaceState>
          </div>
        </div>
      </section>

      <PublicFooter variant="soil" />
    </>
  );
}
