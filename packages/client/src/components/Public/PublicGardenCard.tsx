import type { PublicGardenSummary } from "@green-goods/shared";
import { useIntl } from "react-intl";
import { Link } from "react-router-dom";
import { ImageWithFallback } from "@/components/Display";

export interface PublicGardenCardProps {
  garden: PublicGardenSummary;
  variant?: "lead" | "default";
}

/**
 * PublicGardenCard — editorial Garden card. `lead` variant fills more space
 * for the homepage lead-plus-two layout and is also reused in `/gardens` hero.
 */
export function PublicGardenCard({ garden, variant = "default" }: PublicGardenCardProps) {
  const { formatMessage } = useIntl();
  const isLead = variant === "lead";

  return (
    <Link
      to={`/gardens/${garden.slug}`}
      className="group flex h-full flex-col overflow-hidden rounded-3xl border border-stroke-soft-200 bg-bg-white-0 shadow-sm transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-base focus-visible:ring-offset-2"
      aria-label={garden.name}
    >
      <div className={isLead ? "aspect-[4/3] w-full" : "aspect-[3/2] w-full"}>
        <ImageWithFallback
          src={garden.bannerImage || "/images/no-image-placeholder.png"}
          alt={garden.name}
          className="h-full w-full object-cover"
        />
      </div>
      <div className="flex flex-1 flex-col gap-3 p-5">
        <header>
          <h3
            className={
              isLead
                ? "font-serif text-2xl text-text-strong-950"
                : "text-base font-semibold text-text-strong-950"
            }
            title={garden.name}
          >
            <span className="line-clamp-2">{garden.name || garden.slug}</span>
          </h3>
          {garden.location ? (
            <p className="mt-1 text-xs uppercase tracking-wide text-text-soft-400">
              {garden.location}
            </p>
          ) : null}
        </header>
        {garden.description ? (
          <p
            className={
              isLead
                ? "line-clamp-3 text-sm text-text-sub-600"
                : "line-clamp-2 text-xs text-text-sub-600"
            }
            title={garden.description}
          >
            {garden.description}
          </p>
        ) : null}
        <dl className="mt-auto flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-sub-600">
          <div>
            <dt className="sr-only">
              {formatMessage({
                id: "public.gardens.contributors",
                defaultMessage: "Contributors",
              })}
            </dt>
            <dd>
              {formatMessage(
                {
                  id: "public.gardens.gardeners",
                  defaultMessage: "{count} gardeners",
                },
                { count: garden.contributorCount }
              )}
            </dd>
          </div>
          <div>
            <dt className="sr-only">
              {formatMessage({ id: "public.gardens.workShort", defaultMessage: "Work" })}
            </dt>
            <dd>
              {formatMessage(
                {
                  id: "public.gardens.works",
                  defaultMessage: "{count} works",
                },
                { count: garden.actionCount }
              )}
            </dd>
          </div>
        </dl>
      </div>
    </Link>
  );
}
