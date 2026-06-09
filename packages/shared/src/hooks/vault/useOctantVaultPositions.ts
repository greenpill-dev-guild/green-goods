/**
 * Read an owner's active Octant V2 campaign-vault positions for the `/vaults`
 * management surface (`/vaults?manage=positions`).
 *
 * Like {@link useOctantVaultStats}, these reads go through a read-only viem public
 * client (`createPublicClientForChain`) rather than a connected wallet, so the same
 * hook serves BOTH owner sources the management surface supports:
 *   1. the connected wallet, and
 *   2. a card/recovered email wallet (read by its cached address).
 *
 * It is deliberately owner-agnostic — pass any address. For each campaign vault it
 * reads `balanceOf(owner)`, and for vaults the owner actually holds, the live
 * `convertToAssets(shares)` position value, `maxRedeem(owner, maxLoss, [])`, and
 * `convertToAssets(redeemableShares)` estimated WETH proceeds. Only **active**
 * positions (shares > 0) are returned; the surface
 * shows current holdings, not historical activity.
 *
 * The `maxLoss` used here is the canonical {@link DEFAULT_WITHDRAW_MAX_LOSS_BPS}
 * (1%), the SAME value the connected-wallet and card-wallet redeem paths pass to
 * redeem pre-check — so the "redeemable" shares shown are the shares those paths
 * will accept.
 *
 * @module hooks/vault/useOctantVaultPositions
 */

import { useQuery } from "@tanstack/react-query";
import { createPublicClientForChain } from "../../config/pimlico";
import { queryKeys } from "../../config/query-keys";
import { STALE_TIME_FAST } from "../../config/query-keys/constants";
import { logger } from "../../modules/app/logger";
import {
  getOctantVaultCampaigns,
  type OctantVaultCampaignManifest,
} from "../../modules/vault-crowdfunding";
import type { Address } from "../../types/domain";
import { OCTANT_VAULT_ABI } from "../../utils/blockchain/abis";
import { DEFAULT_WITHDRAW_MAX_LOSS_BPS } from "../../utils/blockchain/vaults";

/** One active campaign-vault position held by an owner address. */
export interface OctantVaultPosition {
  campaignSlug: string;
  displayName: string;
  communityName: string;
  vaultAddress: Address;
  chainId: number;
  assetAddress: Address;
  /** Vault asset technical symbol (e.g. "WETH"). */
  assetSymbol: string;
  assetDecimals: number;
  /** Vault shares the owner holds (`balanceOf`). */
  shares: bigint;
  /** Vault share decimals. Octant/Yearn V3 tokenized strategies use 18. */
  shareDecimals: number;
  /** Current value of those shares in asset base units (`convertToAssets`). */
  positionValue: bigint;
  /** Redeemable shares now (`maxRedeem` at the 1% default maxLoss). */
  redeemableShares: bigint;
  /** Estimated returned assets for `redeemableShares` (`convertToAssets`), or null when preview is unavailable. */
  estimatedRedeemAssets: bigint | null;
  explorerLink?: string;
}

export interface UseOctantVaultPositionsResult {
  positions: OctantVaultPosition[];
  hasPositions: boolean;
  isLoading: boolean;
  isError: boolean;
  isFetching: boolean;
  refetch: () => Promise<unknown>;
}

interface UseOctantVaultPositionsOptions {
  /** Campaign set to read. Defaults to the full Octant vault manifest. */
  campaigns?: OctantVaultCampaignManifest[];
  enabled?: boolean;
}

interface ReadableVault {
  campaign: OctantVaultCampaignManifest;
  chainId: number;
  vaultAddress: Address;
  assetAddress: Address;
  assetSymbol: string;
  assetDecimals: number;
  shareDecimals: number;
}

/** Campaigns whose manifest is complete enough to read positions from. */
function toReadableVaults(campaigns: OctantVaultCampaignManifest[]): ReadableVault[] {
  const readable: ReadableVault[] = [];
  for (const campaign of campaigns) {
    const vault = campaign.vault;
    const asset = vault?.asset;
    if (
      !vault?.chainId ||
      !vault.vaultAddress ||
      !asset?.address ||
      !asset.symbol ||
      typeof asset.decimals !== "number"
    ) {
      continue;
    }
    readable.push({
      campaign,
      chainId: vault.chainId,
      vaultAddress: vault.vaultAddress,
      assetAddress: asset.address,
      assetSymbol: asset.symbol,
      assetDecimals: asset.decimals,
      shareDecimals: vault.vaultDecimals ?? 18,
    });
  }
  return readable;
}

async function readVaultPosition(
  vault: ReadableVault,
  owner: Address
): Promise<OctantVaultPosition | null> {
  const publicClient = createPublicClientForChain(vault.chainId);

  const sharesResult = await publicClient.readContract({
    address: vault.vaultAddress,
    abi: OCTANT_VAULT_ABI,
    functionName: "balanceOf",
    args: [owner],
  });
  const shares = typeof sharesResult === "bigint" ? sharesResult : 0n;
  if (shares <= 0n) return null;

  // Secondary reads are nice-to-have: flaky conversion / maxRedeem reads must not
  // hide a position the owner provably holds. Fall back to 0 (redeem stays
  // unavailable, value shows as unavailable) rather than dropping the row.
  const [valueResult, redeemableSharesResult] = await Promise.all([
    publicClient
      .readContract({
        address: vault.vaultAddress,
        abi: OCTANT_VAULT_ABI,
        functionName: "convertToAssets",
        args: [shares],
      })
      .catch((error) => {
        logger.error("[useOctantVaultPositions] convertToAssets read failed", {
          error,
          chainId: vault.chainId,
          vaultAddress: vault.vaultAddress,
          owner,
        });
        return 0n;
      }),
    publicClient
      .readContract({
        address: vault.vaultAddress,
        abi: OCTANT_VAULT_ABI,
        functionName: "maxRedeem",
        args: [owner, DEFAULT_WITHDRAW_MAX_LOSS_BPS, []],
      })
      .catch((error) => {
        logger.error("[useOctantVaultPositions] maxWithdraw read failed", {
          error,
          chainId: vault.chainId,
          vaultAddress: vault.vaultAddress,
          owner,
        });
        return 0n;
      }),
  ]);
  const redeemableShares = typeof redeemableSharesResult === "bigint" ? redeemableSharesResult : 0n;
  let estimatedRedeemAssets: bigint | null = 0n;
  if (redeemableShares > 0n) {
    const estimatedRedeemAssetsResult = await publicClient
      .readContract({
        address: vault.vaultAddress,
        abi: OCTANT_VAULT_ABI,
        functionName: "convertToAssets",
        args: [redeemableShares],
      })
      .catch(() => null);
    estimatedRedeemAssets =
      typeof estimatedRedeemAssetsResult === "bigint" ? estimatedRedeemAssetsResult : null;
  }

  return {
    campaignSlug: vault.campaign.slug,
    displayName: vault.campaign.displayName,
    communityName: vault.campaign.communityName,
    vaultAddress: vault.vaultAddress,
    chainId: vault.chainId,
    assetAddress: vault.assetAddress,
    assetSymbol: vault.assetSymbol,
    assetDecimals: vault.assetDecimals,
    shareDecimals: vault.shareDecimals,
    shares,
    positionValue: typeof valueResult === "bigint" ? valueResult : 0n,
    redeemableShares,
    estimatedRedeemAssets,
  };
}

export function useOctantVaultPositions(
  owner?: Address | null,
  options: UseOctantVaultPositionsOptions = {}
): UseOctantVaultPositionsResult {
  const campaigns = options.campaigns ?? getOctantVaultCampaigns();
  const readableVaults = toReadableVaults(campaigns);
  const ownerKey = owner ? (owner.toLowerCase() as Address) : undefined;
  // Pilot campaigns share one chain; key on it plus a campaign signature so a
  // changed manifest set never serves a stale cache entry.
  const primaryChainId = readableVaults[0]?.chainId ?? 0;
  const campaignSignature = readableVaults
    .map((vault) => `${vault.chainId}:${vault.vaultAddress.toLowerCase()}`)
    .sort()
    .join(",");
  const enabled = (options.enabled ?? true) && Boolean(owner) && readableVaults.length > 0;

  const query = useQuery({
    queryKey: ownerKey
      ? ([
          ...queryKeys.vaults.octantPositions(ownerKey, primaryChainId),
          campaignSignature,
        ] as const)
      : ([
          "greengoods",
          "vaults",
          "octantPositions",
          "disabled",
          primaryChainId,
          campaignSignature,
        ] as const),
    enabled,
    staleTime: STALE_TIME_FAST,
    queryFn: async () => {
      if (!owner) return [] as OctantVaultPosition[];

      const settled = await Promise.allSettled(
        readableVaults.map((vault) => readVaultPosition(vault, owner))
      );

      const positions: OctantVaultPosition[] = [];
      let failures = 0;
      for (const result of settled) {
        if (result.status === "fulfilled") {
          if (result.value) positions.push(result.value);
        } else {
          failures += 1;
        }
      }

      // Total failure (every vault read threw) is an honest error so the surface
      // shows a retry state. A partial failure still renders what loaded.
      if (failures > 0 && failures === readableVaults.length) {
        throw new Error("Octant vault positions could not be read");
      }

      return positions;
    },
  });

  const positions = query.data ?? [];
  return {
    positions,
    hasPositions: positions.length > 0,
    isLoading: query.isLoading,
    isError: query.isError,
    isFetching: query.isFetching,
    refetch: query.refetch,
  };
}
