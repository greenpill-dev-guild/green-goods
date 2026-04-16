import { useGardens } from "@green-goods/shared";
import { useIntl } from "react-intl";
import { Link } from "react-router-dom";
import { ImageWithFallback } from "@/components/Display";

/**
 * Public garden gallery — the browser entry point for greengoods.app.
 * Read-only, no auth required.
 */
export default function GardensGallery() {
  const { formatMessage } = useIntl();
  const { data: gardens = [], isLoading } = useGardens();

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-bold text-text-strong">
        {formatMessage({ id: "public.gardens.title", defaultMessage: "Gardens" })}
      </h1>
      <p className="mt-2 text-sm text-text-sub">
        {formatMessage({
          id: "public.gardens.description",
          defaultMessage: "Explore regenerative gardens documenting impact on-chain",
        })}
      </p>

      {isLoading ? (
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-48 rounded-xl bg-bg-weak animate-pulse" />
          ))}
        </div>
      ) : gardens.length === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed border-stroke-soft bg-bg-white p-6 text-sm text-text-sub">
          {formatMessage({
            id: "public.gardens.empty",
            defaultMessage: "Gardens will appear here as they come online.",
          })}
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {gardens.map((garden) => (
            <Link key={garden.id} to={`/gardens/${garden.id}`} className="group">
              <div className="rounded-xl border border-stroke-soft bg-bg-white p-4 transition-shadow hover:shadow-md">
                {garden.bannerImage && (
                  <ImageWithFallback
                    src={garden.bannerImage}
                    alt={garden.name}
                    className="h-32 w-full rounded-lg object-cover"
                  />
                )}
                <h3
                  className="mt-3 text-base font-semibold text-text-strong group-hover:text-primary-base truncate"
                  title={garden.name}
                >
                  {garden.name}
                </h3>
                <p className="mt-1 text-sm text-text-sub line-clamp-2">{garden.description}</p>
                <div className="mt-3 flex items-center gap-3 text-xs text-text-soft">
                  <span>
                    {formatMessage(
                      { id: "public.gardens.gardeners", defaultMessage: "{count} gardeners" },
                      { count: garden.gardeners?.length ?? 0 }
                    )}
                  </span>
                  <span>
                    {formatMessage(
                      { id: "public.gardens.works", defaultMessage: "{count} works" },
                      { count: garden.works?.length ?? 0 }
                    )}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
