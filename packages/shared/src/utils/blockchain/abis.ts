/**
 * Minimal ABIs for Garden roles and Hats module interactions.
 *
 * These are intentionally small to avoid relying on stale generated ABIs
 * from contracts/out when new functions are added.
 */

export const GARDEN_ACCOUNT_ROLE_ABI = [
  {
    type: "function",
    name: "isGardener",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "isEvaluator",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "isOperator",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "isOwner",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "isFunder",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "isCommunity",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

export const GARDEN_ACCOUNT_TOKEN_ABI = [
  {
    type: "function",
    name: "token",
    stateMutability: "view",
    inputs: [],
    outputs: [
      { name: "chainId", type: "uint256" },
      { name: "tokenContract", type: "address" },
      { name: "tokenId", type: "uint256" },
    ],
  },
] as const;

export const GARDEN_TOKEN_MODULES_ABI = [
  {
    type: "function",
    name: "gardenHatsModule",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "karmaGAPModule",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
] as const;

export const GARDEN_HATS_MODULE_ABI = [
  {
    type: "function",
    name: "grantRole",
    stateMutability: "nonpayable",
    inputs: [
      { name: "garden", type: "address" },
      { name: "account", type: "address" },
      { name: "role", type: "uint8" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "revokeRole",
    stateMutability: "nonpayable",
    inputs: [
      { name: "garden", type: "address" },
      { name: "account", type: "address" },
      { name: "role", type: "uint8" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "isConfigured",
    stateMutability: "view",
    inputs: [{ name: "garden", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;
