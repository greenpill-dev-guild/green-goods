import {
  cn,
  type PublicGardenSummary,
  useInViewReveal,
  usePublicGardens,
} from "@green-goods/shared";
import { useMemo } from "react";
import { useIntl } from "react-intl";
import { publicCuration } from "@/content/publicCuration";
import { EditorialHeading, EditorialKicker, EditorialLinkArrow } from "./atoms";
import { PublicGardenCard } from "./PublicGardenCard";

const FEATURED_FALLBACK_LIMIT = 4;
const PLACEHOLDER_BANNER = "/images/no-image-placeholder.png";

function isImageBacked(garden: PublicGardenSummary): boolean {
  return Boolean(garden.bannerImage) && garden.bannerImage !== PLACEHOLDER_BANNER;
}

function preferImageBacked(
  gardens: readonly PublicGardenSummary[]
): readonly PublicGardenSummary[] {
  const imaged = gardens.filter(isImageBacked);
  const imageless = gardens.filter((garden) => !isImageBacked(garden));
  return [...imaged, ...imageless];
}

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
    const orderedMatched = preferImageBacked(matched);
    if (orderedMatched.length >= FEATURED_FALLBACK_LIMIT) {
      return orderedMatched.slice(0, FEATURED_FALLBACK_LIMIT);
    }
    if (orderedMatched.length > 0) {
      const matchedIds = new Set(orderedMatched.map((g) => g.id.toLowerCase()));
      const remaining = all.filter((garden) => !matchedIds.has(garden.id.toLowerCase()));
      const sortedRemaining = [...remaining].sort(
        (left, right) => right.lastActivityAt - left.lastActivityAt
      );
      return [...orderedMatched, ...preferImageBacked(sortedRemaining)].slice(
        0,
        FEATURED_FALLBACK_LIMIT
      );
    }
  }

  // No curation, or zero matches: prefer image-backed within most recently active.
  const sorted = [...all].sort((left, right) => right.lastActivityAt - left.lastActivityAt);
  return preferImageBacked(sorted).slice(0, FEATURED_FALLBACK_LIMIT);
}

/**
 * PublicFeaturedGardens — four featured Gardens in an editorial masonry
 * layout. Curation comes from publicCuration keyed by Garden id/address;
 * image-backed Gardens are preferred so the wall feels alive rather than
 * placeholder-heavy. Falls back to recent active Gardens when curation is
 * empty or unmatched.
 *
 * The hero above is now self-contained (no protruding card), so this
 * section keeps standard vertical rhythm — no oversized top padding to
 * absorb an overlap.
 */
export function PublicFeaturedGardens() {
  const { formatMessage } = useIntl();
  const { data: gardens = [], isLoading } = usePublicGardens();
  const { ref: sectionRef, revealed } = useInViewReveal<HTMLElement>();

  const featured = useMemo(
    () => pickFeatured(gardens, publicCuration.featuredGardens as string[]),
    [gardens]
  );

  return (
    <section
      ref={sectionRef}
      data-revealed={revealed}
      className="editorial-section-reveal bg-bg-weak-50 px-6 py-16 sm:px-10 md:py-20"
      aria-labelledby="public-featured-title"
    >
      <div className="editorial-cascade mx-auto max-w-7xl">
        <header className="flex flex-col gap-4 border-b border-stroke-soft-200 pb-6 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
          <div>
            <EditorialKicker className="mb-3">
              {formatMessage({
                id: "public.home.featured.kicker",
                defaultMessage: "§ 01: Featured Gardens",
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
              defaultMessage: "Browse all Gardens",
            })}
          </EditorialLinkArrow>
        </header>

        {isLoading ? (
          <div
            className="mt-12 sm:columns-2 sm:gap-12 lg:gap-16"
            data-testid="public-featured-loading"
          >
            {Array.from({ length: FEATURED_FALLBACK_LIMIT }).map((_, index) => (
              <div
                // Fixed-length array of placeholder cells; index is stable.
                // eslint-disable-next-line react/no-array-index-key
                key={index}
                className="mb-10 break-inside-avoid last:mb-0 sm:mb-12"
              >
                <div
                  className={cn(
                    "w-full animate-pulse bg-editorial-warm",
                    index === 0 || index === 3 ? "aspect-[4/3]" : "aspect-[3/2]"
                  )}
                />
              </div>
            ))}
          </div>
        ) : featured.length === 0 ? (
          <p className="mt-10 max-w-md text-sm text-text-sub-600">
            {formatMessage({
              id: "public.home.featured.empty",
              defaultMessage: "Featured Gardens will appear here as they come online.",
            })}
          </p>
        ) : (
          <div
            className="mt-12 sm:columns-2 sm:gap-12 lg:gap-16"
            data-testid="public-featured-grid"
          >
            {featured.map((garden, index) => (
              <div key={garden.id} className="mb-10 break-inside-avoid last:mb-0 sm:mb-12">
                <PublicGardenCard
                  garden={garden}
                  variant={index === 0 || index === 3 ? "lead" : "default"}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
