/**
 * Octant Module & Vault ABIs
 *
 * ABIs for the Octant yield module, ERC-4626 vault, and AAVE V3 strategy.
 */

export const OCTANT_MODULE_ABI = [
  {
    type: "function",
    name: "harvest",
    stateMutability: "nonpayable",
    inputs: [
      { name: "garden", type: "address" },
      { name: "asset", type: "address" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "emergencyPause",
    stateMutability: "nonpayable",
    inputs: [
      { name: "garden", type: "address" },
      { name: "asset", type: "address" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "setDonationAddress",
    stateMutability: "nonpayable",
    inputs: [
      { name: "garden", type: "address" },
      { name: "donationAddress", type: "address" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "getVaultForAsset",
    stateMutability: "view",
    inputs: [
      { name: "garden", type: "address" },
      { name: "asset", type: "address" },
    ],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "gardenDonationAddresses",
    stateMutability: "view",
    inputs: [{ name: "garden", type: "address" }],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "getSupportedAssets",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address[]" }],
  },
  {
    type: "function",
    name: "configureVaultRoles",
    stateMutability: "nonpayable",
    inputs: [
      { name: "garden", type: "address" },
      { name: "asset", type: "address" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "enableAutoAllocate",
    stateMutability: "nonpayable",
    inputs: [
      { name: "garden", type: "address" },
      { name: "asset", type: "address" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "owner",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "vaultStrategies",
    stateMutability: "view",
    inputs: [{ name: "vault", type: "address" }],
    outputs: [{ name: "", type: "address" }],
  },
] as const;

export const OCTANT_VAULT_ABI = [
  {
    type: "function",
    name: "deposit",
    stateMutability: "nonpayable",
    inputs: [
      { name: "assets", type: "uint256" },
      { name: "receiver", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "redeem",
    stateMutability: "nonpayable",
    inputs: [
      { name: "shares", type: "uint256" },
      { name: "receiver", type: "address" },
      { name: "owner", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "convertToAssets",
    stateMutability: "view",
    inputs: [{ name: "shares", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "convertToShares",
    stateMutability: "view",
    inputs: [{ name: "assets", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "previewDeposit",
    stateMutability: "view",
    inputs: [{ name: "assets", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "previewWithdraw",
    stateMutability: "view",
    inputs: [{ name: "assets", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "maxDeposit",
    stateMutability: "view",
    inputs: [{ name: "receiver", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "withdraw",
    stateMutability: "nonpayable",
    inputs: [
      { name: "assets", type: "uint256" },
      { name: "receiver", type: "address" },
      { name: "owner", type: "address" },
      { name: "maxLoss", type: "uint256" },
      { name: "strategies", type: "address[]" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "maxWithdraw",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "maxLoss", type: "uint256" },
      { name: "strategies", type: "address[]" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "dragonRouter",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "totalAssets",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "depositLimit",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "isShutdown",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "maxRedeem",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "maxLoss", type: "uint256" },
      { name: "strategies", type: "address[]" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "totalSupply",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "asset",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "totalDebt",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

/** Minimal ABI for the AaveV3ERC4626 strategy — `totalAssets()` reflects the live aToken balance. */
export const STRATEGY_ABI = [
  {
    type: "function",
    name: "totalAssets",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;
