/**
 * Conviction & Gardens Module ABIs
 *
 * ABIs for HypercertSignalPool (conviction voting) and GardensModule
 * (community pools, weight schemes, power registries).
 */

export const HYPERCERT_SIGNAL_POOL_ABI = [
  {
    type: "function",
    name: "registerHypercert",
    stateMutability: "nonpayable",
    inputs: [{ name: "hypercertId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "deregisterHypercert",
    stateMutability: "nonpayable",
    inputs: [{ name: "hypercertId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "allocateSupport",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "signals",
        type: "tuple[]",
        components: [
          { name: "hypercertId", type: "uint256" },
          { name: "deltaSupport", type: "int256" },
        ],
      },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "calculateConviction",
    stateMutability: "view",
    inputs: [{ name: "hypercertId", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "getConvictionWeights",
    stateMutability: "view",
    inputs: [],
    outputs: [
      { name: "ids", type: "uint256[]" },
      { name: "weights", type: "uint256[]" },
    ],
  },
  {
    type: "function",
    name: "getVoterAllocations",
    stateMutability: "view",
    inputs: [{ name: "voter", type: "address" }],
    outputs: [
      { name: "ids", type: "uint256[]" },
      { name: "amounts", type: "uint256[]" },
    ],
  },
  {
    type: "function",
    name: "getRegisteredHypercerts",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256[]" }],
  },
  {
    type: "function",
    name: "isEligibleVoter",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "voterTotalStake",
    stateMutability: "view",
    inputs: [{ name: "voter", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "pointsPerVoter",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "decay",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "setRoleHatIds",
    stateMutability: "nonpayable",
    inputs: [{ name: "hatIds", type: "uint256[]" }],
    outputs: [],
  },
  {
    type: "function",
    name: "setDecay",
    stateMutability: "nonpayable",
    inputs: [{ name: "newDecay", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "setPointsPerVoter",
    stateMutability: "nonpayable",
    inputs: [{ name: "newPoints", type: "uint256" }],
    outputs: [],
  },
] as const;

export const GARDENS_MODULE_ABI = [
  {
    type: "function",
    name: "getGardenCommunity",
    stateMutability: "view",
    inputs: [{ name: "garden", type: "address" }],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "getGardenSignalPools",
    stateMutability: "view",
    inputs: [{ name: "garden", type: "address" }],
    outputs: [{ name: "", type: "address[]" }],
  },
  {
    type: "function",
    name: "getGardenWeightScheme",
    stateMutability: "view",
    inputs: [{ name: "garden", type: "address" }],
    outputs: [{ name: "", type: "uint8" }],
  },
  {
    type: "function",
    name: "getGardenPowerRegistry",
    stateMutability: "view",
    inputs: [{ name: "garden", type: "address" }],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "goodsToken",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "stakeAmountPerMember",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "createGardenPools",
    stateMutability: "nonpayable",
    inputs: [{ name: "garden", type: "address" }],
    outputs: [{ name: "pools", type: "address[]" }],
  },
] as const;
