import { useMemo } from "react";
import { useReadContracts } from "wagmi";
import type { Address } from "../../types/domain";
import type { VaultPreview } from "../../types/vaults";
import { OCTANT_VAULT_ABI } from "../../utils/blockchain/abis";
import { VAULT_MAX_BPS, ZERO_ADDRESS } from "../../utils/blockchain/vaults";

interface UseVaultPreviewOptions {
  vaultAddress?: Address;
  amount?: bigint;
  shares?: bigint;
  userAddress?: Address;
  chainId?: number;
  enabled?: boolean;
}

export function useVaultPreview(options: UseVaultPreviewOptions = {}) {
  const enabled = options.enabled ?? true;
  const vaultAddress = options.vaultAddress;
  const amount = options.amount ?? 0n;
  const shares = options.shares ?? 0n;
  const userAddress = options.userAddress ?? (ZERO_ADDRESS as Address);

  const contracts = useMemo(() => {
    if (!vaultAddress) return [];
    const base = { address: vaultAddress, abi: OCTANT_VAULT_ABI } as const;
    return [
      { ...base, functionName: "previewDeposit", args: [amount] },
      { ...base, functionName: "convertToAssets", args: [shares] },
      { ...base, functionName: "maxDeposit", args: [userAddress] },
      { ...base, functionName: "balanceOf", args: [userAddress] },
      { ...base, functionName: "totalAssets", args: [] },
      { ...base, functionName: "maxWithdraw", args: [userAddress, VAULT_MAX_BPS, []] },
      { ...base, functionName: "previewWithdraw", args: [amount] },
    ] as const;
  }, [vaultAddress, amount, shares, userAddress]);

  const query = useReadContracts({
    contracts: contracts as any,
    query: {
      enabled: enabled && Boolean(vaultAddress) && contracts.length > 0,
    },
  });

  const preview = useMemo((): VaultPreview | undefined => {
    if (!query.data) return undefined;

    const [
      previewShares,
      previewAssets,
      maxDeposit,
      shareBalance,
      totalAssets,
      maxWithdrawResult,
      previewWithdrawShares,
    ] = query.data;

    return {
      previewShares: previewShares.status === "success" ? (previewShares.result as bigint) : 0n,
      previewAssets: previewAssets.status === "success" ? (previewAssets.result as bigint) : 0n,
      maxDeposit: maxDeposit.status === "success" ? (maxDeposit.result as bigint) : 0n,
      shareBalance: shareBalance.status === "success" ? (shareBalance.result as bigint) : 0n,
      totalAssets: totalAssets.status === "success" ? (totalAssets.result as bigint) : 0n,
      maxWithdraw:
        maxWithdrawResult.status === "success" ? (maxWithdrawResult.result as bigint) : 0n,
      previewWithdrawShares:
        previewWithdrawShares.status === "success" ? (previewWithdrawShares.result as bigint) : 0n,
    };
  }, [query.data]);

  return {
    ...query,
    preview,
  };
}
