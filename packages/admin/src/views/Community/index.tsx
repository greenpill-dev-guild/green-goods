import { MetaStrip } from "@green-goods/shared/components/Canvas/MetaStrip";
import { buildCommunityHeaderStats } from "@green-goods/shared/hooks/admin-ui/community/community.utils";
import { useCommunityWorkspaceController } from "@green-goods/shared/hooks/admin-ui/community/useCommunityWorkspaceController";
import { useIsProtocolGarden } from "@green-goods/shared/hooks/commitment-pooling/useProtocolPool";
import { DEFAULT_CHAIN_ID } from "@green-goods/shared/config/default-chain";
import { ZERO_ADDRESS } from "@green-goods/shared/utils/blockchain/address";
import { useMediaQuery } from "@green-goods/shared/hooks/ui/useMediaQuery";
import type { Address } from "@green-goods/shared/types/domain";
import { useMemo } from "react";
import { AdminTabRail } from "@/components/AdminTabRail";
import { AdminViewActions } from "@/components/AdminViewActions";
import { CanvasRouteFrame, CanvasRouteHeader } from "@/components/Layout/CanvasRouteFrame";
import { CommunitySheetDescriptor } from "./components/CommunitySheetDescriptor";
import { CommunityWorkspaceContent } from "./components/CommunityWorkspaceContent";
import { useIntl } from "react-intl";

export default function CommunityView() {
  const { formatMessage, locale } = useIntl();
  const community = useCommunityWorkspaceController();
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const { isProtocolGarden } = useIsProtocolGarden({
    chainId: community.selectedGarden?.chainId ?? DEFAULT_CHAIN_ID,
    gardenId: (community.selectedGardenAddress ?? ZERO_ADDRESS) as Address,
  });
  const showCoordination = Boolean(community.selectedGardenAddress) && isProtocolGarden;

  // Paid-out magnitudes by asset: the header cannot add base units across
  // WETH/USDC/etc. as one token total.
  const distributedAmountsByAsset = useMemo(
    () =>
      Array.from(
        community.allocations
          .reduce((totals, allocation) => {
            const current = totals.get(allocation.assetAddress) ?? 0n;
            totals.set(
              allocation.assetAddress,
              current +
                allocation.cookieJarAmount +
                allocation.fractionsAmount +
                allocation.juiceboxAmount
            );
            return totals;
          }, new Map<Address, bigint>())
          .values()
      ),
    [community.allocations]
  );

  const headerStats = useMemo(
    () =>
      buildCommunityHeaderStats({
        hasSelectedGarden: Boolean(community.selectedGarden),
        endowmentByAsset: community.endowmentByAsset,
        distributedAmounts: community.allocationsLoading ? null : distributedAmountsByAsset,
        locale,
        formatMessage,
      }),
    [
      community.selectedGarden,
      community.allocationsLoading,
      community.endowmentByAsset,
      distributedAmountsByAsset,
      locale,
      formatMessage,
    ]
  );

  return (
    <CanvasRouteFrame
      ref={community.containerRef}
      data-component="CommunityWorkspace"
      data-region="workspace-community"
    >
      <CommunitySheetDescriptor
        isStrategiesRoute={community.isStrategiesRoute}
        isSignalPoolRoute={community.isSignalPoolRoute}
        vaultAction={community.vaultAction}
        poolType={community.poolType}
        gardenAddress={community.selectedGardenAddress}
      />

      <CanvasRouteHeader
        title={formatMessage({ id: "cockpit.community.title", defaultMessage: "Community" })}
        metadata={
          headerStats.length > 0 ? <MetaStrip items={headerStats} density="inline" /> : undefined
        }
        actions={
          isDesktop && community.desktopActions.length > 0 ? (
            <AdminViewActions items={community.desktopActions} />
          ) : undefined
        }
        variant="canvas"
        sticky
      >
        <AdminTabRail
          ariaLabel={formatMessage({
            id: "cockpit.community.viewSwitcher",
            defaultMessage: "Community views",
          })}
          activeId={community.mode}
          onChange={community.handleModeChange}
          tabs={[
            {
              id: "members",
              label: formatMessage({
                id: "cockpit.community.members",
                defaultMessage: "Members",
              }),
              // Only join requests wait on the steward on this rail (DL-134).
              count: community.joinRequestsWaiting,
            },
            ...(showCoordination
              ? [
                  {
                    id: "coordination",
                    label: formatMessage({
                      id: "cockpit.community.coordination",
                      defaultMessage: "Coordination",
                    }),
                  },
                ]
              : []),
            {
              id: "endowment",
              label: formatMessage({
                id: "cockpit.community.endowment",
                defaultMessage: "Endowment",
              }),
            },
            {
              id: "payouts",
              label: formatMessage({
                id: "cockpit.community.payouts",
                defaultMessage: "Payouts",
              }),
            },
          ]}
        />
      </CanvasRouteHeader>

      <CommunityWorkspaceContent workspace={community} />
    </CanvasRouteFrame>
  );
}
