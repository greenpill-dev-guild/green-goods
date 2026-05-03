/**
 * Yield Splitter & Juicebox ABIs
 *
 * ABIs for yield distribution (split config, pending yield, escrowed fractions)
 * and Juicebox project payments.
 */

export const YIELD_SPLITTER_ABI = [
  {
    type: "function",
    name: "splitYield",
    stateMutability: "nonpayable",
    inputs: [
      { name: "garden", type: "address" },
      { name: "asset", type: "address" },
      { name: "vault", type: "address" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "setSplitRatio",
    stateMutability: "nonpayable",
    inputs: [
      { name: "garden", type: "address" },
      { name: "cookieJarBps", type: "uint256" },
      { name: "fractionsBps", type: "uint256" },
      { name: "juiceboxBps", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "getSplitConfig",
    stateMutability: "view",
    inputs: [{ name: "garden", type: "address" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "cookieJarBps", type: "uint256" },
          { name: "fractionsBps", type: "uint256" },
          { name: "juiceboxBps", type: "uint256" },
        ],
      },
    ],
  },
  {
    type: "function",
    name: "pendingYield",
    stateMutability: "view",
    inputs: [
      { name: "garden", type: "address" },
      { name: "asset", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "gardenHypercertPools",
    stateMutability: "view",
    inputs: [{ name: "garden", type: "address" }],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "gardensModule",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "setGardenHypercertPool",
    stateMutability: "nonpayable",
    inputs: [
      { name: "garden", type: "address" },
      { name: "pool", type: "address" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "minYieldThreshold",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "getEscrowedFractions",
    stateMutability: "view",
    inputs: [
      { name: "garden", type: "address" },
      { name: "asset", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "gardenShares",
    stateMutability: "view",
    inputs: [
      { name: "garden", type: "address" },
      { name: "vault", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "gardenVaults",
    stateMutability: "view",
    inputs: [
      { name: "garden", type: "address" },
      { name: "asset", type: "address" },
    ],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "withdrawEscrowedFractions",
    stateMutability: "nonpayable",
    inputs: [
      { name: "garden", type: "address" },
      { name: "asset", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "to", type: "address" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "rescueTokens",
    stateMutability: "nonpayable",
    inputs: [
      { name: "token", type: "address" },
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
  },
] as const;

export const YIELD_RESOLVER_ABI = YIELD_SPLITTER_ABI;

export const JUICEBOX_ABI = [
  {
    type: "function",
    name: "pay",
    stateMutability: "payable",
    inputs: [
      { name: "projectId", type: "uint256" },
      { name: "token", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "beneficiary", type: "address" },
      { name: "minReturnedTokens", type: "uint256" },
      { name: "memo", type: "string" },
      { name: "metadata", type: "bytes" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "tokenOf",
    stateMutability: "view",
    inputs: [{ name: "projectId", type: "uint256" }],
    outputs: [{ name: "", type: "address" }],
  },
] as const;
