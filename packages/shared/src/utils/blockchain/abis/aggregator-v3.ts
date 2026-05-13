/**
 * Chainlink AggregatorV3Interface — minimal ABI for reading the latest price.
 *
 * Used by useEthUsdPrice (and any future price-feed reads) to convert USD
 * input into native-token wei amounts on the public Fund card. Aggregator
 * addresses live in `../price-feeds.ts`.
 *
 * Reference: https://docs.chain.link/data-feeds/api-reference#latestrounddata
 */
export const AGGREGATOR_V3_ABI = [
  {
    type: "function",
    name: "latestRoundData",
    stateMutability: "view",
    inputs: [],
    outputs: [
      { name: "roundId", type: "uint80" },
      { name: "answer", type: "int256" },
      { name: "startedAt", type: "uint256" },
      { name: "updatedAt", type: "uint256" },
      { name: "answeredInRound", type: "uint80" },
    ],
  },
  {
    type: "function",
    name: "decimals",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
  },
] as const;
