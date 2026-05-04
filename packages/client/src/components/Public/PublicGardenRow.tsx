import { type PublicGardenSummary } from "@green-goods/shared";
import { useIntl } from "react-intl";
import { Link } from "react-router-dom";
import { ImageWithFallback } from "@/components/Display";
import { EditorialKicker, EditorialPrimaryButton } from "./atoms";
import { GardenCoverFallback } from "./GardenCoverFallback";

export interface PublicGardenRowProps {
  garden: PublicGardenSummary;
  onSupport: (garden: PublicGardenSummary) => void;
}

/**
 * PublicGardenRow — minimized horizontal Garden row used on the Fund page.
 *
 * Mirrors the rhythm of `PublicEvidenceLedgerRow` but is shaped for funder
 * scanning: a small thumbnail, the Garden name and place, and a single
 * `Support` CTA on the right. Tapping the thumbnail/title block routes to
 * the public Garden detail page; tapping `Support` opens the funding method
 * selector.
 */
export function PublicGardenRow({ garden, onSupport }: PublicGardenRowProps) {
  const { formatMessage } = useIntl();
  const meta = [
    formatMessage(
      {
        id: "public.gardens.gardeners",
        defaultMessage: "{count} gardeners",
      },
      { count: garden.contributorCount }
    ),
    formatMessage(
      {
        id: "public.gardens.works",
        defaultMessage: "{count} entries",
      },
      { count: garden.actionCount }
    ),
  ];

  return (
    <li className="border-b border-stroke-soft-200 last:border-b-0">
      <div className="flex items-stretch gap-4 py-5 sm:gap-6 sm:py-6">
        <Link
          to={`/gardens/${garden.slug}`}
          viewTransition
          className="group flex min-w-0 flex-1 items-stretch gap-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-action focus-visible:ring-offset-2 sm:gap-6"
          aria-label={garden.name}
        >
          <div className="relative h-20 w-20 shrink-0 overflow-hidden bg-editorial-warm sm:h-24 sm:w-24">
            <ImageWithFallback
              src={garden.bannerImage}
              alt=""
              className="h-full w-full object-cover transition-transform group-hover:scale-[1.03]"
              backgroundFallback={<GardenCoverFallback name={garden.name} slug={garden.slug} />}
            />
          </div>

          <div className="flex min-w-0 flex-1 flex-col justify-center gap-1">
            {garden.location ? (
              <EditorialKicker className="-mb-0.5">{garden.location}</EditorialKicker>
            ) : null}
            <h3
              className="font-serif text-lg font-normal leading-[1.15] tracking-[-0.012em] text-text-strong-950 group-hover:text-primary-action sm:text-xl"
              title={garden.name}
            >
              <span className="line-clamp-2">{garden.name || garden.slug}</span>
            </h3>
            <p className="flex flex-wrap items-center gap-x-2 text-xs text-text-soft-400">
              {meta.map((label, index) => (
                <span key={label} className="flex items-center gap-x-2">
                  {index > 0 ? <span aria-hidden="true">·</span> : null}
                  <span>{label}</span>
                </span>
              ))}
            </p>
          </div>
        </Link>

        <div className="flex shrink-0 items-center">
          <EditorialPrimaryButton onClick={() => onSupport(garden)}>
            {formatMessage({ id: "public.fund.supportShort", defaultMessage: "Support" })}
          </EditorialPrimaryButton>
        </div>
      </div>
    </li>
  );
}
