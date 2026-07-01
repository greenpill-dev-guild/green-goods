import {
  buildCommunityHeaderStats,
  MetaStrip,
  type Address,
  useCommunityWorkspaceController,
  useMediaQuery,
} from "@green-goods/shared";
import { useMemo } from "react";
import { AdminTabRail } from "@/components/AdminTabRail";
import { AdminViewActions } from "@/components/AdminViewActions";
import { CanvasRouteFrame, CanvasRouteHeader } from "@/components/Layout/CanvasRouteFrame";
import { CommunitySheetDescriptor } from "./components/CommunitySheetDescriptor";
import { CommunityWorkspaceContent } from "./components/CommunityWorkspaceContent";
import { useIntl } from "react-intl";

export default function CommunityView() {
  const { formatMessage } = useIntl();
  const community = useCommunityWorkspaceController();
  const isDesktop = useMediaQuery("(min-width: 1024px)");

  // Paid-out magnitudes by asset. The Payouts tab badge is a count, but the
  // header cannot add base units across WETH/USDC/etc. as one token total.
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
        vaultNetDeposited: community.vaultNetDeposited,
        distributedAmounts: community.allocationsLoading ? null : distributedAmountsByAsset,
        formatMessage,
      }),
    [
      community.selectedGarden,
      community.allocationsLoading,
      community.vaultNetDeposited,
      distributedAmountsByAsset,
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
        isVaultRoute={community.isVaultRoute}
        isStrategiesRoute={community.isStrategiesRoute}
        isSignalPoolRoute={community.isSignalPoolRoute}
        poolType={community.poolType}
        gardenAddress={community.selectedGardenAddress}
      />

      <CanvasRouteHeader
        title={formatMessage({ id: "cockpit.community.title", defaultMessage: "Community" })}
        description={formatMessage({
          id: "cockpit.community.description",
          defaultMessage: "Treasury, governance, and payouts for the garden's community.",
        })}
        metadata={
          headerStats.length > 0 ? <MetaStrip items={headerStats} density="inline" /> : undefined
        }
        actions={
          isDesktop && community.desktopActions.length > 0 ? (
            // Stable trio, always visible regardless of mode: Manage members,
            // Deposit / withdraw (owner-gated), New proposal (fixed primary).
            // Payouts stays outlined (its panel owns actions).
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
              id: "treasury",
              label: formatMessage({
                id: "cockpit.community.treasury",
                defaultMessage: "Treasury",
              }),
              count: community.derived.hasVaults ? 1 : undefined,
            },
            {
              id: "governance",
              label: formatMessage({
                id: "cockpit.community.governance",
                defaultMessage: "Governance",
              }),
              count: community.pools.length || undefined,
            },
            {
              id: "payouts",
              label: formatMessage({
                id: "cockpit.community.payouts",
                defaultMessage: "Payouts",
              }),
              count: community.allocations.length || undefined,
            },
          ]}
        />
      </CanvasRouteHeader>

      <CommunityWorkspaceContent workspace={community} />
    </CanvasRouteFrame>
  );
}
