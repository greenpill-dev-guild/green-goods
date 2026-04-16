import { useGardens } from "@green-goods/shared";
import { useIntl } from "react-intl";
import { useParams } from "react-router-dom";

/**
 * Read-only garden detail with "Join" CTA.
 * Public view — no auth required.
 */
export default function GardenDetail() {
  const { id } = useParams<{ id: string }>();
  const { formatMessage } = useIntl();
  const { data: gardens = [] } = useGardens();
  const garden = gardens.find((g) => g.id === id);

  if (!garden) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <p className="text-sm text-text-sub">
          {formatMessage({
            id: "public.gardenDetail.notFound",
            defaultMessage: "Garden not found",
          })}
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      {garden.bannerImage && (
        <img
          src={garden.bannerImage}
          alt=""
          className="h-48 w-full rounded-xl object-cover sm:h-64"
        />
      )}

      <h1 className="mt-6 text-2xl font-bold text-text-strong" title={garden.name}>
        {garden.name}
      </h1>

      <p className="mt-2 text-sm text-text-sub">{garden.description}</p>

      <div className="mt-4 flex items-center gap-1 text-sm text-text-soft">
        <span>{garden.location}</span>
      </div>

      <div className="mt-4 flex items-center gap-4 text-sm text-text-soft">
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

      <div className="mt-6">
        <button
          type="button"
          className="rounded-lg bg-primary-base px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-dark active:scale-95"
        >
          {formatMessage({
            id: "public.gardens.join",
            defaultMessage: "Join this Garden",
          })}
        </button>
      </div>
    </div>
  );
}
