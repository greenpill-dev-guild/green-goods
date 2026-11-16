import type { Address } from "@green-goods/shared/types/domain";
import { StatusBadge } from "@green-goods/shared/components/StatusBadge";
import { useId } from "react";
import { useIntl } from "react-intl";
import { BadgeArtwork } from "./BadgeArtwork";
import { BadgeIssuedDate } from "./BadgeIssuedDate";

interface BadgeTileProps {
  slug: string;
  chainId: number;
  unlockLock: Address;
  title: string;
  earned: boolean;
  issuedAt?: number;
  statusLabel: string;
  onOpen: () => void;
}

/**
 * One badge in the Profile's grid (DL-186): artwork, title, status, and known issue date.
 * The button's description includes its standing and date.
 */
export function BadgeTile({
  slug,
  chainId,
  unlockLock,
  title,
  earned,
  issuedAt,
  statusLabel,
  onOpen,
}: BadgeTileProps) {
  const intl = useIntl();
  const statusId = useId();

  return (
    <button
      type="button"
      data-pressable="card"
      onClick={onOpen}
      className="gg-card flex min-h-56 min-w-0 flex-col items-center justify-center gap-3 p-4 text-center"
      aria-describedby={statusId}
      aria-label={intl.formatMessage(
        {
          id: "app.profile.badges.viewDetails",
          defaultMessage: "View {badge} badge",
        },
        { badge: title }
      )}
    >
      <BadgeArtwork slug={slug} chainId={chainId} unlockLock={unlockLock} size="tile" />
      <span className="flex w-full min-w-0 flex-col items-center gap-2">
        <span className="line-clamp-2 type-card-title text-text-strong-950">{title}</span>
        <span id={statusId} className="flex flex-col items-center gap-2">
          {/* A badge's standing describes its tile, so it is not one of the page's statuses. */}
          <StatusBadge
            role="none"
            size="xs"
            variant={earned ? "success" : "warning"}
            showIcon={false}
          >
            {statusLabel}
          </StatusBadge>
          <BadgeIssuedDate issuedAt={earned ? issuedAt : undefined} />
        </span>
      </span>
    </button>
  );
}
