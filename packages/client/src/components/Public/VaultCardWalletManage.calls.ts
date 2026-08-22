import {
  type Address,
  DEFAULT_WITHDRAW_MAX_LOSS_BPS,
  OCTANT_VAULT_REDEEM_CALL_SHAPES,
  type OctantVaultRedeemCallVariant,
} from "@green-goods/shared";
import { getContract, prepareContractCall, readContract } from "thirdweb";

type VaultContract = ReturnType<typeof getContract>;

function readMaxRedeemVariant(
  contract: VaultContract,
  owner: Address,
  variant: OctantVaultRedeemCallVariant
) {
  if (variant === "multistrategy") {
    return readContract({
      contract,
      method:
        "function maxRedeem(address owner, uint256 maxLoss, address[] strategies) view returns (uint256)",
      params: [owner, DEFAULT_WITHDRAW_MAX_LOSS_BPS, []] as const,
    });
  }
  if (variant === "tokenized-strategy") {
    return readContract({
      contract,
      method: "function maxRedeem(address owner, uint256 maxLoss) view returns (uint256)",
      params: [owner, DEFAULT_WITHDRAW_MAX_LOSS_BPS] as const,
    });
  }
  return readContract({
    contract,
    method: "function maxRedeem(address owner) view returns (uint256)",
    params: [owner] as const,
  });
}

export async function readCardWalletMaxRedeemable({
  contract,
  owner,
}: {
  contract: VaultContract;
  owner: Address;
}): Promise<{ shares: bigint; variant: OctantVaultRedeemCallVariant }> {
  for (const shape of OCTANT_VAULT_REDEEM_CALL_SHAPES) {
    try {
      const result = await readMaxRedeemVariant(contract, owner, shape.variant);
      return { shares: typeof result === "bigint" ? result : 0n, variant: shape.variant };
    } catch {
      // Try the next Octant V2 / ERC-4626-compatible redeem shape.
    }
  }
  return { shares: 0n, variant: "multistrategy" };
}

export function prepareCardWalletRedeem(
  contract: VaultContract,
  shares: bigint,
  owner: Address,
  variant: OctantVaultRedeemCallVariant
) {
  if (variant === "multistrategy") {
    return prepareContractCall({
      contract,
      method:
        "function redeem(uint256 shares, address receiver, address owner, uint256 maxLoss, address[] strategies) returns (uint256)",
      params: [shares, owner, owner, DEFAULT_WITHDRAW_MAX_LOSS_BPS, []] as const,
    });
  }
  if (variant === "tokenized-strategy") {
    return prepareContractCall({
      contract,
      method:
        "function redeem(uint256 shares, address receiver, address owner, uint256 maxLoss) returns (uint256)",
      params: [shares, owner, owner, DEFAULT_WITHDRAW_MAX_LOSS_BPS] as const,
    });
  }
  return prepareContractCall({
    contract,
    method: "function redeem(uint256 shares, address receiver, address owner) returns (uint256)",
    params: [shares, owner, owner] as const,
  });
}
