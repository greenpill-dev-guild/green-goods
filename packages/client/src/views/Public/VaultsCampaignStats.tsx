import { useOctantVaultHarvestableYield } from "@green-goods/shared/hooks/vault/useOctantVaultHarvestableYield";
import { useOctantVaultStats } from "@green-goods/shared/hooks/vault/useOctantVaultStats";
import { useOctantVaultStrategyApy } from "@green-goods/shared/hooks/vault/useOctantVaultStrategyApy";
import { getOctantVaultAssetDisplayPolicy } from "@green-goods/shared/modules/vault-crowdfunding/copy";
import type { OctantVaultCampaignManifest } from "@green-goods/shared/modules/vault-crowdfunding/manifest";
import { selectPublicSurfaceState } from "@green-goods/shared/public";
import { formatApy } from "@green-goods/shared/utils/blockchain/aave";
import { formatUsdCents } from "@green-goods/shared/utils/blockchain/price-feeds";
import { formatTokenAmount } from "@green-goods/shared/utils/blockchain/vaults";
import type { ReactNode } from "react";
import { useIntl } from "react-intl";
import { EditorialStatSkeleton } from "@/components/Public/atoms";
import { PublicSurfaceState } from "@/components/Public/PublicSurfaceState";

/*
 * A campaign card's live numbers on /vaults: what the vault holds, the yield it
 * has generated for the campaign, and its current rate.
 */

export function CampaignVaultStats({ campaign }: { campaign: OctantVaultCampaignManifest }) {
  const { formatMessage } = useIntl();
  const decimals = campaign.vault?.asset?.decimals ?? 18;
  const donorSymbol = getOctantVaultAssetDisplayPolicy(campaign.vault?.asset?.symbol).donorSymbol;
  const stats = useOctantVaultStats({
    vaultAddress: campaign.vault?.vaultAddress,
    chainId: campaign.vault?.chainId,
    decimals,
  });

  if (!campaign.vault?.vaultAddress || stats.isError) return null;

  const tokenAmount = formatTokenAmount(stats.totalAssets, decimals, 4, undefined, true);
  const usd = stats.usdCents !== null ? formatUsdCents(stats.usdCents) : null;
  const surfaceState = selectPublicSurfaceState({
    isLoading: stats.isLoading,
    isError: false,
    itemCount: stats.totalAssets > 0n ? 1 : 0,
  });

  return (
    <dl
      className="border-y border-stroke-soft-200 py-4"
      data-testid={`vault-campaign-stats-${campaign.slug}`}
    >
      <dt className="font-mono text-[10px] uppercase tracking-[0.16em] text-text-soft-400">
        {formatMessage({
          id: "public.vaults.card.inVault",
          defaultMessage: "Backed so far",
        })}
      </dt>
      <PublicSurfaceState
        state={surfaceState}
        container="dd"
        loading={<EditorialStatSkeleton className="mt-1 h-8 w-28" />}
        error={null}
        empty={
          <span className="mt-1 block font-serif text-xl leading-none text-text-soft-400">
            {formatMessage({
              id: "public.vaults.card.justLaunched",
              defaultMessage: "Just launched. Be the first to endow.",
            })}
          </span>
        }
      >
        <dd className="mt-1 flex items-baseline gap-2">
          <span className="font-serif text-3xl leading-none text-text-strong-950">
            {usd ?? `${tokenAmount} ${donorSymbol}`}
          </span>
          {usd ? (
            <span className="text-sm text-text-soft-400">
              {tokenAmount} {donorSymbol}
            </span>
          ) : null}
        </dd>
      </PublicSurfaceState>
    </dl>
  );
}

export function CampaignYieldRow({ campaign }: { campaign: OctantVaultCampaignManifest }) {
  const { formatMessage } = useIntl();
  const assetSymbol = campaign.vault?.asset?.symbol ?? "WETH";
  const assetDecimals = campaign.vault?.asset?.decimals ?? 18;
  const metric = useOctantVaultHarvestableYield({
    vaultAddress: campaign.vault?.vaultAddress,
    chainId: campaign.vault?.chainId,
    asset: campaign.vault?.asset,
    yieldSource: campaign.vault?.yieldSource,
    yieldStrategy: campaign.vault?.yieldStrategy,
  });
  const apy = useOctantVaultStrategyApy({
    vaultAddress: campaign.vault?.vaultAddress,
    chainId: campaign.vault?.chainId,
    yieldSource: campaign.vault?.yieldSource,
  });

  let generatedYieldValue: ReactNode;
  if (metric.isLoading) {
    generatedYieldValue = <EditorialStatSkeleton className="h-5 w-24" />;
  } else if (metric.status === "unavailable") {
    generatedYieldValue = formatMessage({
      id: "public.vaults.card.generatedYieldUnavailable",
      defaultMessage: "Not available yet",
    });
  } else if (metric.status === "zero") {
    generatedYieldValue = formatMessage({
      id: "public.vaults.card.noYieldYet",
      defaultMessage: "No yield yet",
    });
  } else {
    generatedYieldValue = `${formatTokenAmount(
      metric.harvestableAssets,
      assetDecimals,
      4,
      undefined,
      true
    )} ${assetSymbol}`;
  }

  let fundingRateValue: ReactNode;
  if (apy.isLoading) {
    fundingRateValue = <EditorialStatSkeleton className="h-5 w-16" />;
  } else if (apy.status === "unavailable") {
    fundingRateValue = formatMessage({
      id: "public.vaults.card.fundingRateUnavailable",
      defaultMessage: "Not available yet",
    });
  } else {
    fundingRateValue = formatApy(apy.apy ?? 0);
  }

  return (
    <dl
      className="grid grid-cols-2 gap-3 border-b border-stroke-soft-200 py-4"
      data-testid={`vault-campaign-yield-row-${campaign.slug}`}
    >
      <div>
        <dt className="font-mono text-[10px] uppercase tracking-[0.16em] text-text-soft-400">
          {formatMessage({
            id: "public.vaults.card.generatedYield",
            defaultMessage: "Generated for the campaign",
          })}
        </dt>
        <dd className="mt-1 font-serif text-lg leading-none text-text-strong-950">
          {generatedYieldValue}
        </dd>
      </div>
      <div>
        <dt className="font-mono text-[10px] uppercase tracking-[0.16em] text-text-soft-400">
          {formatMessage({
            id: "public.vaults.card.fundingRate",
            defaultMessage: "Current yield rate",
          })}
        </dt>
        <dd className="mt-1 font-serif text-lg leading-none text-text-strong-950">
          {fundingRateValue}
        </dd>
      </div>
    </dl>
  );
}
