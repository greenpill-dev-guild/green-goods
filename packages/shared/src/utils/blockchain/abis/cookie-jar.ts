/**
 * Cookie Jar ABIs
 *
 * ABIs for CookieJar (withdrawal/deposit) and CookieJarModule (jar discovery).
 */

export const COOKIE_JAR_ABI = [
  {
    name: "CURRENCY",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }],
  },
  {
    name: "currencyHeldByJar",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "maxWithdrawal",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "withdrawalInterval",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "fixedAmount",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "WITHDRAWAL_OPTION",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint8" }],
  },
  {
    name: "lastWithdrawalTime",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "totalWithdrawn",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "paused",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "bool" }],
  },
  {
    name: "EMERGENCY_WITHDRAWAL_ENABLED",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "bool" }],
  },
  {
    name: "withdraw",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "amount", type: "uint256" },
      { name: "purpose", type: "string" },
    ],
    outputs: [],
  },
  {
    name: "MIN_DEPOSIT",
    type: "function",
    stateMutability: "pure",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "deposit",
    type: "function",
    stateMutability: "payable",
    inputs: [{ name: "amount", type: "uint256" }],
    outputs: [],
  },
  { name: "pause", type: "function", stateMutability: "nonpayable", inputs: [], outputs: [] },
  { name: "unpause", type: "function", stateMutability: "nonpayable", inputs: [], outputs: [] },
  {
    name: "updateMaxWithdrawalAmount",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "_maxWithdrawal", type: "uint256" }],
    outputs: [],
  },
  {
    name: "updateWithdrawalInterval",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "_withdrawalInterval", type: "uint256" }],
    outputs: [],
  },
  {
    name: "emergencyWithdraw",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "token", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
  },
] as const;

export const COOKIE_JAR_MODULE_ABI = [
  {
    name: "getGardenJars",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "garden", type: "address" }],
    outputs: [{ type: "address[]" }],
  },
  {
    name: "getGardenJar",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "garden", type: "address" },
      { name: "asset", type: "address" },
    ],
    outputs: [{ type: "address" }],
  },
  {
    name: "getSupportedAssets",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address[]" }],
  },
] as const;
