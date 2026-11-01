import { StatusBadge } from "@green-goods/shared/components/StatusBadge";
import { RiAwardLine, RiCoinsLine, RiHammerLine, RiSeedlingLine } from "@remixicon/react";
import { useId } from "react";
import { useIntl } from "react-intl";

function badgeIcon(slug: string) {
  switch (slug) {
    case "genesis":
      return <RiSeedlingLine className="h-5 w-5 text-primary-on-surface" />;
    case "first-work":
      return <RiHammerLine className="h-5 w-5 text-primary-on-surface" />;
    case "first-support":
      return <RiCoinsLine className="h-5 w-5 text-primary-on-surface" />;
    default:
      return <RiAwardLine className="h-5 w-5 text-primary-on-surface" />;
  }
}

interface BadgeTileProps {
  slug: string;
  title: string;
  earned: boolean;
  statusLabel: string;
  onOpen: () => void;
}

/**
 * One badge in the Profile's grid (DL-159): a centered tile on the card surface with a 64px round
 * mark in the app's green, the title, and a status colored by what it means. The button names the
 * badge and is described by its status.
 */
export function BadgeTile({ slug, title, earned, statusLabel, onOpen }: BadgeTileProps) {
  const intl = useIntl();
  const statusId = useId();
  return (
    <button
      type="button"
      data-pressable="card"
      onClick={onOpen}
      className="gg-card flex min-h-[11rem] flex-col items-center justify-center gap-3 p-4 text-center"
      aria-describedby={statusId}
      aria-label={intl.formatMessage(
        {
          id: "app.profile.badges.viewDetails",
          defaultMessage: "View {badge} badge",
        },
        { badge: title }
      )}
    >
      <span className="flex size-16 items-center justify-center rounded-full bg-[rgb(var(--primary-container))] [&>svg]:size-7 [&>svg]:text-[rgb(var(--primary-container-foreground))]">
        {badgeIcon(slug)}
      </span>
      <span className="flex min-w-0 flex-col items-center gap-2">
        <span className="line-clamp-2 type-card-title text-text-strong-950">{title}</span>
        {/* A badge's standing describes its tile, so it is not one of the page's statuses. */}
        <StatusBadge
          id={statusId}
          role="none"
          size="xs"
          variant={earned ? "success" : "warning"}
          showIcon={false}
        >
          {statusLabel}
        </StatusBadge>
      </span>
    </button>
  );
}
