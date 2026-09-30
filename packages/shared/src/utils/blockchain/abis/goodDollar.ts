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
