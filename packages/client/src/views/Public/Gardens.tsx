import { type PublicGardenSummary, usePublicGardens } from "@green-goods/shared";
import { useMemo, useState } from "react";
import { useIntl } from "react-intl";
import { PublicGardenCard } from "@/components/Public";

/**
 * Gardens — public discovery and browsing page.
 *
 * Editorial hero on top, then a search input over a structured Garden grid.
 * Cards link to `/gardens/:slug` and render confirmed-only metadata.
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

  const featured = useMemo(
    () => [...gardens].sort((a, b) => b.lastActivityAt - a.lastActivityAt).slice(0, 3),
    [gardens]
  );

  return (
    <div className="bg-bg-weak-50">
      <header className="mx-auto max-w-7xl px-6 pt-12 pb-6 sm:px-10 sm:pt-16">
        <p className="text-xs font-medium uppercase tracking-wide text-text-soft-400">
          {formatMessage({ id: "public.gardens.kicker", defaultMessage: "Living Archive" })}
        </p>
        <h1 className="mt-2 font-serif text-3xl text-text-strong-950 md:text-5xl">
          {formatMessage({ id: "public.gardens.title", defaultMessage: "Gardens" })}
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-text-sub-600 md:text-base">
          {formatMessage({
            id: "public.gardens.description",
            defaultMessage:
              "Each Garden is a place where regenerative Work is documented, verified, and rewarded.",
          })}
        </p>
      </header>

      {/* Featured row — recent active Gardens */}
      {featured.length > 0 ? (
        <section className="mx-auto max-w-7xl px-6 pb-10 sm:px-10" aria-label="Featured Gardens">
          <div className="grid gap-6 lg:grid-cols-3">
            {featured.map((garden, index) => (
              <PublicGardenCard
                key={garden.id}
                garden={garden}
                variant={index === 0 ? "lead" : "default"}
              />
            ))}
          </div>
        </section>
      ) : null}

      {/* Browse */}
      <section className="mx-auto max-w-7xl px-6 pb-16 sm:px-10" aria-label="Browse Gardens">
        <div className="flex flex-col gap-4 border-y border-stroke-soft-200 py-4 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="font-serif text-2xl text-text-strong-950">
            {formatMessage({ id: "public.gardens.browse", defaultMessage: "Browse all Gardens" })}
          </h2>
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
              className="w-full rounded-full border border-stroke-soft-200 bg-bg-white-0 px-4 py-2.5 text-sm text-text-strong-950 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-base"
            />
          </label>
        </div>

        {isLoading ? (
          <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="h-72 animate-pulse rounded-3xl bg-bg-white-0"
                aria-hidden="true"
              />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-dashed border-stroke-soft-200 bg-bg-white-0 p-8 text-sm text-text-sub-600">
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
          </div>
        ) : (
          <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((garden: PublicGardenSummary) => (
              <PublicGardenCard key={garden.id} garden={garden} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
