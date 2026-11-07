import type { Address } from "@green-goods/shared/types/domain";
import { StatusBadge } from "@green-goods/shared/components/StatusBadge";
import { RiAwardLine, RiCoinsLine, RiHammerLine, RiSeedlingLine } from "@remixicon/react";
import { useId, useState } from "react";
import { useIntl } from "react-intl";
import { isAddress, zeroAddress } from "viem";

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
  const [failedSrc, setFailedSrc] = useState<string>();
  // Unlock serves artwork for the collection, even before a badge is claimed.
  const src =
    isAddress(unlockLock, { strict: false }) && unlockLock !== zeroAddress
      ? `https://locksmith.unlock-protocol.com/${chainId}/lock/${unlockLock}/icon`
      : undefined;

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
      <span
        aria-hidden="true"
        className="flex size-16 items-center justify-center overflow-hidden rounded-full bg-[rgb(var(--primary-container))] [&>svg]:size-7 [&>svg]:text-[rgb(var(--primary-container-foreground))]"
      >
        {src && src !== failedSrc ? (
          <img
            src={src}
            alt=""
            width={64}
            height={64}
            className="size-full object-contain"
            referrerPolicy="no-referrer"
            onError={() => setFailedSrc(src)}
          />
        ) : (
          badgeIcon(slug)
        )}
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
