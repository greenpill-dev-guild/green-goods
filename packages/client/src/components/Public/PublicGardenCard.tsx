import { cn, type PublicGardenSummary } from "@green-goods/shared";
import { useIntl } from "react-intl";
import { Link, useMatch } from "react-router-dom";
import { ImageWithFallback } from "@/components/Display";
import { EditorialKicker, EditorialMetaRow } from "./atoms";
import { GardenCoverFallback } from "./GardenCoverFallback";

export interface PublicGardenCardProps {
  garden: PublicGardenSummary;
  variant?: "lead" | "default";
  onImageError?: () => void;
}

/**
 * PublicGardenCard — editorial Garden card. `lead` fills more vertical space
 * for the homepage lead-plus-two layout and the Gardens explorer's first row.
 *
 * The dialect prefers rules over chrome, so the card has no border, no rounded
 * corners, and no shadow. Hover scales the image gently and underlines the
 * link affordance — restraint over flash.
 */
export function PublicGardenCard({
  garden,
  variant = "default",
  onImageError,
}: PublicGardenCardProps) {
  const { formatMessage } = useIntl();
  const isLead = variant === "lead";
  const match = useMatch("/gardens/:id");
  const openId = match?.params.id?.toLowerCase();
  const isActiveDialogTarget = openId
    ? openId === garden.id.toLowerCase() ||
      openId === garden.address.toLowerCase() ||
      openId === garden.slug.toLowerCase()
    : false;
  const heroVtName = isActiveDialogTarget ? undefined : `garden-card-${garden.id}`;

  const metaItems: { label: string }[] = [];
  if (garden.location) metaItems.push({ label: garden.location });
  metaItems.push({
    label: formatMessage(
      {
        id: "public.gardens.gardeners",
        defaultMessage: "{count} gardeners",
      },
      { count: garden.contributorCount }
    ),
  });
  metaItems.push({
    label: formatMessage(
      {
        id: "public.gardens.works",
        defaultMessage: "{count} entries",
      },
      { count: garden.actionCount }
    ),
  });

  return (
    <Link
      to={`/gardens/${garden.slug}`}
      viewTransition
      className={cn(
        "group flex h-full flex-col gap-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-action focus-visible:ring-offset-2",
        isLead ? "" : "gap-3"
      )}
      aria-label={garden.name}
    >
      <div
        className={cn(
          "relative w-full overflow-hidden bg-editorial-warm",
          isLead ? "aspect-[4/3]" : "aspect-[3/2]"
        )}
        style={heroVtName ? { viewTransitionName: heroVtName } : undefined}
      >
        <ImageWithFallback
          src={garden.bannerImage}
          alt={garden.name}
          className="h-full w-full object-cover transition-transform duration-[var(--spring-effects-slow-duration)] ease-[var(--spring-effects-slow-easing)] group-hover:scale-[1.03]"
          backgroundFallback={<GardenCoverFallback name={garden.name} slug={garden.slug} />}
          onErrorCallback={onImageError}
        />
      </div>

      {garden.location ? (
        <EditorialKicker className="-mb-1">{garden.location}</EditorialKicker>
      ) : null}

      <h3
        className={cn(
          "font-serif font-normal leading-[1.1] tracking-[-0.012em] text-text-strong-950 transition-[color,transform] duration-[var(--spring-spatial-fast-duration)] ease-[var(--spring-spatial-fast-easing)] group-hover:text-primary-action motion-safe:group-hover:-translate-y-px",
          isLead ? "text-2xl md:text-3xl" : "text-xl"
        )}
        title={garden.name}
      >
        <span className="line-clamp-2">{garden.name || garden.slug}</span>
      </h3>

      {garden.description ? (
        <p
          className={cn(
            "text-sm font-medium leading-[1.55] text-text-sub-600",
            isLead ? "line-clamp-3" : "line-clamp-2"
          )}
          title={garden.description}
        >
          {garden.description}
        </p>
      ) : null}

      <EditorialMetaRow className="mt-auto text-text-sub-600" items={metaItems} />
    </Link>
  );
}
