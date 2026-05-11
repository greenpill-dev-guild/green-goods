import {
  DialogShell,
  formatAddress,
  type Address,
  type GreenWillBadgeView,
  isGreenWillDeployed,
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
import { useMemo, useState } from "react";
import { useIntl } from "react-intl";
import { Button } from "@/components/Actions";
import { EmptyState } from "@/components/Communication";

const BADGE_ORDER = ["genesis", "first-work", "first-support"] as const;

type ProfileBadgeStatus = "earned" | "claimable";
type ProfileBadgeDisplay = GreenWillBadgeView & { profileStatus: ProfileBadgeStatus };

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
        defaultMessage: "Awarded to founding Green Goods community members.",
      });
    case "first-work":
      return intl.formatMessage({
        id: "app.profile.badges.firstWork.description",
        defaultMessage: "Awarded after your first submitted work.",
      });
    case "first-support":
      return intl.formatMessage({
        id: "app.profile.badges.firstSupport.description",
        defaultMessage: "Awarded after you support a garden.",
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

function badgeStatusLabel(intl: ReturnType<typeof useIntl>, status: ProfileBadgeStatus) {
  if (status === "earned") {
    return intl.formatMessage({
      id: "app.profile.badges.earnedStatus",
      defaultMessage: "Earned",
    });
  }

  return intl.formatMessage({
    id: "app.profile.badges.claimableStatus",
    defaultMessage: "Ready to claim",
  });
}

export const ProfileBadges: React.FC = () => {
  const intl = useIntl();
  const [selectedBadge, setSelectedBadge] = useState<ProfileBadgeDisplay | null>(null);
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
  const firstSupportPosition = deposits.find((deposit) => (deposit.shares ?? 0n) > 0n) ?? null;

  const earned = useMemo(() => sortBadges(earnedBadges), [earnedBadges]);
  const available = useMemo(
    () =>
      sortBadges(
        badges.filter((badge) => {
          if (!badge.claimableNow) return false;
          if (badge.slug === "genesis") return isProtocolMember;
          if (badge.slug === "first-work") return Boolean(firstWorkUid);
          if (badge.slug === "first-support") return Boolean(firstSupportPosition);
          return false;
        })
      ),
    [badges, firstSupportPosition, firstWorkUid, isProtocolMember]
  );
  const displayBadges = useMemo<ProfileBadgeDisplay[]>(
    () => [
      ...earned.map((badge) => ({ ...badge, profileStatus: "earned" as const })),
      ...available.map((badge) => ({ ...badge, profileStatus: "claimable" as const })),
    ],
    [available, earned]
  );
  const hasDisplayableBadges = displayBadges.length > 0;

  const renderBadgeState = (
    title: string,
    description: string,
    tone: "neutral" | "warning" | "error" = "neutral"
  ) => (
    <EmptyState
      icon={<RiAwardLine />}
      title={title}
      description={description}
      tone={tone}
      className="min-h-[18rem]"
    />
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
    return renderBadgeState(
      intl.formatMessage({
        id: "app.profile.badges.connectTitle",
        defaultMessage: "Connect to see badges",
      }),
      intl.formatMessage({
        id: "app.profile.badges.connect",
        defaultMessage: "Connect an account to view badges.",
      })
    );
  }

  if (isLoading) {
    return renderBadgeState(
      intl.formatMessage({
        id: "app.profile.badges.loading",
        defaultMessage: "Loading badges",
      }),
      intl.formatMessage({
        id: "app.profile.badges.loadingDescription",
        defaultMessage: "Checking your Green Goods badge record.",
      })
    );
  }

  if (isError) {
    return renderBadgeState(
      intl.formatMessage({
        id: "app.profile.badges.error",
        defaultMessage: "Badges are not loading right now",
      }),
      intl.formatMessage({
        id: "app.profile.badges.errorDescription",
        defaultMessage:
          "Try again in a little while. Your earned badges are still connected to your account.",
      }),
      "warning"
    );
  }

  if (!hasDisplayableBadges) {
    // Distinguish "no badges issued yet on this chain" from "badges feature
    // not deployed on the active chain" — surfaces the build/env config gap
    // instead of silently looking like an empty record.
    if (!isGreenWillDeployed()) {
      return renderBadgeState(
        intl.formatMessage({
          id: "app.profile.badges.unavailableTitle",
          defaultMessage: "Badges aren't available on this network",
        }),
        intl.formatMessage({
          id: "app.profile.badges.unavailableDescription",
          defaultMessage:
            "Green Goods badges are issued on Arbitrum. Switch networks to view and claim them.",
        }),
        "neutral"
      );
    }

    return renderBadgeState(
      intl.formatMessage({
        id: "app.profile.badges.empty",
        defaultMessage: "No badges yet",
      }),
      intl.formatMessage({
        id: "app.profile.badges.emptyDescription",
        defaultMessage:
          "Badges appear here as you document work, support gardens, and claim Green Goods milestones.",
      })
    );
  }

  return (
    <>
      <div className="flex flex-col gap-1">
        <h5 className="text-label-md text-text-strong-950">
          {intl.formatMessage({
            id: "app.profile.badges",
            defaultMessage: "Badges",
          })}
        </h5>
        <p className="text-xs text-text-sub-600">
          {intl.formatMessage(
            {
              id: "app.profile.badges.issuedTo",
              defaultMessage: "Issued to {identity}",
            },
            { identity: badgeIdentity ?? "Unknown" }
          )}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3" data-testid="profile-badge-grid">
        {displayBadges.map((badge) => {
          const title = badgeTitle(intl, badge.slug);
          const statusLabel = badgeStatusLabel(intl, badge.profileStatus);

          return (
            <button
              key={`${badge.profileStatus}-${badge.badgeId}`}
              type="button"
              onClick={() => setSelectedBadge(badge)}
              className="flex min-h-[9.75rem] flex-col items-start justify-between rounded-2xl border border-stroke-soft-200 bg-bg-white-0 p-3 text-left shadow-xs transition duration-[var(--spring-spatial-fast-duration)] ease-[var(--spring-spatial-fast-easing)] active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
              aria-label={intl.formatMessage(
                {
                  id: "app.profile.badges.viewDetails",
                  defaultMessage: "View {badge} badge",
                },
                { badge: title }
              )}
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-[var(--radius-lg)] bg-primary/10">
                {badgeIcon(badge.slug)}
              </span>
              <span className="mt-3 min-w-0">
                <span className="line-clamp-2 text-sm font-medium leading-snug text-text-strong-950">
                  {title}
                </span>
                <span className="mt-2 inline-flex rounded-full bg-bg-weak-50 px-2 py-1 text-[11px] font-medium text-text-sub-600">
                  {statusLabel}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <DialogShell
        open={selectedBadge !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedBadge(null);
        }}
        title={selectedBadge ? badgeTitle(intl, selectedBadge.slug) : ""}
        description={
          selectedBadge
            ? intl.formatMessage(
                {
                  id: "app.profile.badges.issuedTo",
                  defaultMessage: "Issued to {identity}",
                },
                { identity: badgeIdentity ?? "Unknown" }
              )
            : undefined
        }
        icon={selectedBadge ? badgeIcon(selectedBadge.slug) : <RiAwardLine className="h-5 w-5" />}
        size="md"
      >
        {selectedBadge && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-bg-weak-50 px-2 py-1 text-xs font-medium text-text-sub-600">
                {badgeStatusLabel(intl, selectedBadge.profileStatus)}
              </span>
            </div>
            <p className="text-sm leading-relaxed text-text-sub-600">
              {badgeDescription(intl, selectedBadge.slug)}
            </p>
            {selectedBadge.profileStatus === "claimable" && (
              <div className="pt-1">{renderAction(selectedBadge)}</div>
            )}
          </div>
        )}
      </DialogShell>
    </>
  );
};
