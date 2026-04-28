import {
  formatAddress,
  type Address,
  type GreenWillBadgeView,
  useClaimFirstSupportBadge,
  useClaimFirstWorkBadge,
  useClaimGenesisBadge,
  useEnsName,
  useGreenGoodsEnsName,
  useGreenWillBadges,
  useMyVaultDeposits,
  useMyOnlineWorks,
  usePrimaryAddress,
  useProtocolMemberStatus,
} from "@green-goods/shared";
import { RiAwardLine, RiCoinsLine, RiHammerLine, RiSeedlingLine } from "@remixicon/react";
import { useMemo } from "react";
import { useIntl } from "react-intl";
import { Button } from "@/components/Actions";
import { Card } from "@/components/Cards";

const BADGE_ORDER = ["genesis", "first-work", "first-support"] as const;

function badgeIcon(slug: string) {
  switch (slug) {
    case "genesis":
      return <RiSeedlingLine className="h-5 w-5 text-primary" />;
    case "first-work":
      return <RiHammerLine className="h-5 w-5 text-primary" />;
    case "first-support":
      return <RiCoinsLine className="h-5 w-5 text-primary" />;
    default:
      return <RiAwardLine className="h-5 w-5 text-primary" />;
  }
}

function badgeTitle(intl: ReturnType<typeof useIntl>, slug: string) {
  switch (slug) {
    case "genesis":
      return intl.formatMessage({
        id: "app.profile.badges.genesis.title",
        defaultMessage: "Genesis",
      });
    case "first-work":
      return intl.formatMessage({
        id: "app.profile.badges.firstWork.title",
        defaultMessage: "First Work",
      });
    case "first-support":
      return intl.formatMessage({
        id: "app.profile.badges.firstSupport.title",
        defaultMessage: "First Support",
      });
    default:
      return slug;
  }
}

function badgeDescription(intl: ReturnType<typeof useIntl>, slug: string) {
  switch (slug) {
    case "genesis":
      return intl.formatMessage({
        id: "app.profile.badges.genesis.description",
        defaultMessage: "Awarded to early Green Goods protocol members wearing the protocol hat.",
      });
    case "first-work":
      return intl.formatMessage({
        id: "app.profile.badges.firstWork.description",
        defaultMessage: "Awarded after this address proves a valid Green Goods work attestation.",
      });
    case "first-support":
      return intl.formatMessage({
        id: "app.profile.badges.firstSupport.description",
        defaultMessage: "Claimable after this address holds a live garden vault position.",
      });
    default:
      return "";
  }
}

function sortBadges(badges: GreenWillBadgeView[]) {
  return [...badges].sort((left, right) => {
    const leftIndex = BADGE_ORDER.indexOf(left.slug as (typeof BADGE_ORDER)[number]);
    const rightIndex = BADGE_ORDER.indexOf(right.slug as (typeof BADGE_ORDER)[number]);

    return (
      (leftIndex === -1 ? BADGE_ORDER.length : leftIndex) -
      (rightIndex === -1 ? BADGE_ORDER.length : rightIndex)
    );
  });
}

export const ProfileBadges: React.FC = () => {
  const intl = useIntl();
  const primaryAddress = usePrimaryAddress() as Address | null;
  const { data: greenGoodsEnsName } = useGreenGoodsEnsName(primaryAddress);
  const { data: ensName } = useEnsName(primaryAddress);
  const { data: isProtocolMember = false } = useProtocolMemberStatus(primaryAddress ?? undefined);
  const { data: works = [] } = useMyOnlineWorks({ limit: 1 });
  const { deposits = [] } = useMyVaultDeposits(primaryAddress ?? undefined);
  const { badges, earnedBadges, isLoading, isError } = useGreenWillBadges(
    primaryAddress ?? undefined
  );
  const genesisClaim = useClaimGenesisBadge();
  const firstWorkClaim = useClaimFirstWorkBadge();
  const firstSupportClaim = useClaimFirstSupportBadge();

  const preferredEnsName = greenGoodsEnsName || ensName;
  const badgeIdentity = primaryAddress
    ? formatAddress(primaryAddress, { ensName: preferredEnsName ?? undefined })
    : null;
  const firstWorkUid = works[0]?.id as `0x${string}` | undefined;
  const firstSupportPosition = deposits[0] ?? null;

  const earned = useMemo(() => sortBadges(earnedBadges), [earnedBadges]);
  const available = useMemo(
    () => sortBadges(badges.filter((badge) => badge.claimableNow)),
    [badges]
  );
  const hasDisplayableBadges = earned.length > 0 || available.length > 0;

  const renderEmptyState = () => (
    <Card>
      <p className="text-sm text-text-sub-600">
        {intl.formatMessage({
          id: "app.profile.badges.empty",
          defaultMessage: "No badges found.",
        })}
      </p>
    </Card>
  );

  const renderAction = (badge: GreenWillBadgeView) => {
    if (badge.slug === "genesis") {
      if (!isProtocolMember) {
        return (
          <p className="text-xs text-text-sub-600">
            {intl.formatMessage({
              id: "app.profile.badges.notEligible",
              defaultMessage: "Complete the qualifying action to unlock this badge.",
            })}
          </p>
        );
      }

      return (
        <Button
          variant="primary"
          mode="filled"
          size="small"
          label={intl.formatMessage({
            id: "app.profile.badges.claimGenesis",
            defaultMessage: "Claim Genesis",
          })}
          onClick={() => genesisClaim.mutate()}
          disabled={genesisClaim.isPending}
        />
      );
    }

    if (badge.slug === "first-work") {
      if (!firstWorkUid) {
        return (
          <p className="text-xs text-text-sub-600">
            {intl.formatMessage({
              id: "app.profile.badges.notEligible",
              defaultMessage: "Complete the qualifying action to unlock this badge.",
            })}
          </p>
        );
      }

      return (
        <Button
          variant="primary"
          mode="filled"
          size="small"
          label={intl.formatMessage({
            id: "app.profile.badges.claimFirstWork",
            defaultMessage: "Claim First Work",
          })}
          onClick={() => firstWorkClaim.mutate({ uid: firstWorkUid })}
          disabled={firstWorkClaim.isPending}
        />
      );
    }

    if (badge.slug === "first-support") {
      if (!firstSupportPosition) {
        return (
          <p className="text-xs text-text-sub-600">
            {intl.formatMessage({
              id: "app.profile.badges.notEligible",
              defaultMessage: "Complete the qualifying action to unlock this badge.",
            })}
          </p>
        );
      }

      return (
        <Button
          variant="primary"
          mode="filled"
          size="small"
          label={intl.formatMessage({
            id: "app.profile.badges.claimFirstSupport",
            defaultMessage: "Claim First Support",
          })}
          onClick={() =>
            firstSupportClaim.mutate({
              gardenAddress: firstSupportPosition.garden,
              assetAddress: firstSupportPosition.asset,
            })
          }
          disabled={firstSupportClaim.isPending}
        />
      );
    }

    return null;
  };

  if (!primaryAddress) {
    return (
      <Card>
        <p className="text-sm text-text-sub-600">
          {intl.formatMessage({
            id: "app.profile.badges.connect",
            defaultMessage: "Connect an account to view badges.",
          })}
        </p>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card>
        <p className="text-sm text-text-sub-600">
          {intl.formatMessage({
            id: "app.profile.badges.loading",
            defaultMessage: "Loading badges...",
          })}
        </p>
      </Card>
    );
  }

  if (isError || !hasDisplayableBadges) {
    return renderEmptyState();
  }

  return (
    <>
      <h5 className="text-label-md text-text-strong-950">
        {intl.formatMessage({
          id: "app.profile.badges",
          defaultMessage: "Badges",
        })}
      </h5>

      <Card className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
            <RiAwardLine className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wide text-text-sub-600">
              {intl.formatMessage({
                id: "app.profile.badges.identity",
                defaultMessage: "Badge identity",
              })}
            </p>
            <p className="text-sm font-medium text-text-strong-950">
              {intl.formatMessage(
                {
                  id: "app.profile.badges.issuedTo",
                  defaultMessage: "Issued to {identity}",
                },
                { identity: badgeIdentity ?? "Unknown" }
              )}
            </p>
          </div>
        </div>
      </Card>

      {earned.length > 0 && (
        <div className="flex flex-col gap-3">
          <h5 className="text-label-md text-text-strong-950">
            {intl.formatMessage({
              id: "app.profile.badges.earned",
              defaultMessage: "Earned badges",
            })}
          </h5>

          {earned.map((badge) => (
            <Card key={badge.badgeId} className="flex flex-col gap-3">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                  {badgeIcon(badge.slug)}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-text-strong-950">
                    {badgeTitle(intl, badge.slug)}
                  </p>
                  <p className="text-sm text-text-sub-600">{badgeDescription(intl, badge.slug)}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {available.length > 0 && (
        <div className="flex flex-col gap-3">
          <h5 className="text-label-md text-text-strong-950">
            {intl.formatMessage({
              id: "app.profile.badges.claimable",
              defaultMessage: "Claimable badges",
            })}
          </h5>

          {available.map((badge) => (
            <Card key={badge.badgeId} className="flex flex-col gap-3">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                  {badgeIcon(badge.slug)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-text-strong-950">
                    {badgeTitle(intl, badge.slug)}
                  </p>
                  <p className="text-sm text-text-sub-600">{badgeDescription(intl, badge.slug)}</p>
                </div>
              </div>
              <div>{renderAction(badge)}</div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
};
