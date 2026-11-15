import type { Address } from "@green-goods/shared/types/domain";
import { StatusBadge } from "@green-goods/shared/components/StatusBadge";
import { useId } from "react";
import { useIntl } from "react-intl";
import { BadgeArtwork } from "./BadgeArtwork";

interface BadgeTileProps {
  slug: string;
  chainId: number;
  unlockLock: Address;
  title: string;
  earned: boolean;
  statusLabel: string;
  onOpen: () => void;
}

/**
 * One badge in the Profile's grid (DL-159). The tile shows the artwork, title, and status.
 * The button takes its accessible name from the title and its description from the status.
 */
export function BadgeTile({
  slug,
  chainId,
  unlockLock,
  title,
  earned,
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
      <BadgeArtwork slug={slug} chainId={chainId} unlockLock={unlockLock} size="tile" />
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
