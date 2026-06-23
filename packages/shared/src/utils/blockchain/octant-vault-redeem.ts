import type { Address } from "../../types/domain";

export type OctantVaultRedeemCallVariant = "multistrategy" | "tokenized-strategy" | "erc4626";

export interface OctantVaultRedeemCallShape {
  variant: OctantVaultRedeemCallVariant;
  maxRedeemMethod: string;
  maxRedeemArgs: (owner: Address, maxLossBps: bigint) => readonly unknown[];
  redeemMethod: string;
  redeemArgs: (
    shares: bigint,
    receiver: Address,
    owner: Address,
    maxLossBps: bigint
  ) => readonly unknown[];
}

export const OCTANT_VAULT_REDEEM_CALL_SHAPES = [
  {
    variant: "multistrategy",
    maxRedeemMethod:
      "function maxRedeem(address owner, uint256 maxLoss, address[] strategies) view returns (uint256)",
    maxRedeemArgs: (owner: Address, maxLossBps: bigint) => [owner, maxLossBps, []] as const,
    redeemMethod:
      "function redeem(uint256 shares, address receiver, address owner, uint256 maxLoss, address[] strategies) returns (uint256)",
    redeemArgs: (shares: bigint, receiver: Address, owner: Address, maxLossBps: bigint) =>
      [shares, receiver, owner, maxLossBps, []] as const,
  },
  {
    variant: "tokenized-strategy",
    maxRedeemMethod:
      "function maxRedeem(address owner, uint256 maxLoss) view returns (uint256)",
    maxRedeemArgs: (owner: Address, maxLossBps: bigint) => [owner, maxLossBps] as const,
    redeemMethod:
      "function redeem(uint256 shares, address receiver, address owner, uint256 maxLoss) returns (uint256)",
    redeemArgs: (shares: bigint, receiver: Address, owner: Address, maxLossBps: bigint) =>
      [shares, receiver, owner, maxLossBps] as const,
  },
  {
    variant: "erc4626",
    maxRedeemMethod: "function maxRedeem(address owner) view returns (uint256)",
    maxRedeemArgs: (owner: Address) => [owner] as const,
    redeemMethod:
      "function redeem(uint256 shares, address receiver, address owner) returns (uint256)",
    redeemArgs: (shares: bigint, receiver: Address, owner: Address) =>
      [shares, receiver, owner] as const,
  },
] as const satisfies readonly OctantVaultRedeemCallShape[];

export function getOctantVaultRedeemCallShape(
  variant: OctantVaultRedeemCallVariant
): OctantVaultRedeemCallShape {
  return (
    OCTANT_VAULT_REDEEM_CALL_SHAPES.find((shape) => shape.variant === variant) ??
    OCTANT_VAULT_REDEEM_CALL_SHAPES[0]
  );
}
