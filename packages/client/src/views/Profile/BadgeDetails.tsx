import { StatusBadge } from "@green-goods/shared/components/StatusBadge";
import type { GreenWillBadgeView } from "@green-goods/shared/types/greenwill";
import type { ReactNode } from "react";
import { useIntl } from "react-intl";
import { BadgeArtwork } from "./BadgeArtwork";

/**
 * When the account was issued the badge: the block time its ownership record
 * carries, in seconds. A badge not yet held, or a record without a time, has none.
 */
function earnedAt(badge: GreenWillBadgeView): Date | null {
  const issuedAt = badge.ownership?.issuedAt ?? 0;
  return issuedAt > 0 ? new Date(issuedAt * 1000) : null;
}

interface BadgeDetailsProps {
  badge: GreenWillBadgeView;
  /** The standing to show: a claim that has landed counts before the badge list catches up. */
  earned: boolean;
  statusLabel: string;
  description: string;
  /** Why a badge to claim cannot be claimed yet. */
  note?: string;
  /** A claim's progress, success or failure. */
  claimProgress?: ReactNode;
}

/**
 * One badge's details in its sheet (DL-183): the artwork, the standing with the
 * day an earned badge was earned beside its pill, a claim's progress under the
 * standing it changes, then the description. The date arrives with the badge's
 * ownership record, so a claim that lands before the list catches up shows its
 * success and no date yet.
 */
export function BadgeDetails({
  badge,
  earned,
  statusLabel,
  description,
  note,
  claimProgress,
}: BadgeDetailsProps) {
  const intl = useIntl();
  const earnedOn = earnedAt(badge);

  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <BadgeArtwork
        slug={badge.slug}
        chainId={badge.chainId}
        unlockLock={badge.unlockLock}
        size="sheet"
      />
      <div className="flex flex-col items-center gap-1.5">
        <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
          {/* A badge's standing describes its sheet, so it is not one of the page's statuses. */}
          <StatusBadge
            role="none"
            size="sm"
            variant={earned ? "success" : "warning"}
            showIcon={false}
          >
            {statusLabel}
          </StatusBadge>
          {earnedOn ? (
            <time dateTime={earnedOn.toISOString()} className="type-meta text-text-sub-600">
              {intl.formatDate(earnedOn, { year: "numeric", month: "long", day: "numeric" })}
            </time>
          ) : null}
        </div>
        {note ? <p className="type-meta text-text-sub-600">{note}</p> : null}
      </div>
      {/* Above the description, so a small phone keeps it in view over the claim bar. */}
      {claimProgress}
      <p className="type-body text-text-sub-600">{description}</p>
    </div>
  );
}
