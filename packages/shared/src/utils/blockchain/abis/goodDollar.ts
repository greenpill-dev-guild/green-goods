import { ERC20_BALANCE_ABI } from "./erc20";

export const BOOLEAN_PAUSED_ABI = [
  {
    type: "function",
    name: "paused",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

export const GOOD_DOLLAR_ABI = [
  ...ERC20_BALANCE_ABI,
  ...BOOLEAN_PAUSED_ABI,
  {
    type: "function",
    name: "getFees",
    stateMutability: "view",
    inputs: [
      { name: "amount", type: "uint256" },
      { name: "sender", type: "address" },
      { name: "recipient", type: "address" },
    ],
    outputs: [
      { name: "fee", type: "uint256" },
      { name: "senderPays", type: "bool" },
    ],
  },
] as const;

/**
 * GoodDollar's Mento exchange provider on Celo (`GoodDollarExchangeProvider`):
 * the reserve's current price for an exchange, in the reserve asset per G$
 * with 18 decimals, and whether the reserve is paused.
 */
export const GOOD_DOLLAR_EXCHANGE_PROVIDER_ABI = [
  ...BOOLEAN_PAUSED_ABI,
  {
    type: "function",
    name: "currentPrice",
    stateMutability: "view",
    inputs: [{ name: "exchangeId", type: "bytes32" }],
    outputs: [{ name: "price", type: "uint256" }],
  },
] as const;
