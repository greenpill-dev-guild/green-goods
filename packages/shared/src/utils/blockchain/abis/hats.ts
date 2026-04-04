/**
 * Hats Module ABIs
 *
 * ABIs for Hats Protocol role management and conviction strategy configuration.
 */

export const HATS_MODULE_ABI = [
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
    name: "grantRoles",
    stateMutability: "nonpayable",
    inputs: [
      { name: "garden", type: "address" },
      { name: "accounts", type: "address[]" },
      { name: "roles", type: "uint8[]" },
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

export const HATS_MODULE_CONVICTION_ABI = [
  {
    type: "function",
    name: "setConvictionStrategies",
    stateMutability: "nonpayable",
    inputs: [
      { name: "garden", type: "address" },
      { name: "strategies", type: "address[]" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "getConvictionStrategies",
    stateMutability: "view",
    inputs: [{ name: "garden", type: "address" }],
    outputs: [{ name: "", type: "address[]" }],
  },
] as const;
