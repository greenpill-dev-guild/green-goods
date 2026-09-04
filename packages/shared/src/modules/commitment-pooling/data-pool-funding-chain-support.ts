import type { Address } from "../../types/domain";
import { ERC20_BALANCE_ABI } from "../../utils/blockchain/abis/erc20";
import { address, integer } from "./data-core";
import type { ZodiacAllowance } from "./pool-funding";

export interface PoolFundingLiveRoute {
  safe: Address;
  rolesModifier: Address;
  allowanceKey: `0x${string}`;
  active: boolean;
}

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

export const EXECUTOR_ABI = [
  ...BOOLEAN_PAUSED_ABI,
  {
    type: "function",
    name: "gardenRouteOf",
    stateMutability: "view",
    inputs: [{ name: "garden", type: "address" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "safe", type: "address" },
          { name: "rolesModifier", type: "address" },
          { name: "roleKey", type: "bytes32" },
          { name: "allowanceKey", type: "bytes32" },
          { name: "permissionsConfigHash", type: "bytes32" },
          { name: "active", type: "bool" },
        ],
      },
    ],
  },
  {
    type: "function",
    name: "gardenPeriodSpend",
    stateMutability: "view",
    inputs: [{ name: "garden", type: "address" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "periodStartedAt", type: "uint64" },
          { name: "amount", type: "uint256" },
        ],
      },
    ],
  },
  {
    type: "function",
    name: "maxTransferAmount",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "maxBatchAmount",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "maxBatchSize",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint16" }],
  },
  {
    type: "function",
    name: "maxFeeBps",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint16" }],
  },
  {
    type: "function",
    name: "maxFeeAmount",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "periodDuration",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint64" }],
  },
  {
    type: "function",
    name: "maxPeriodAmount",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "nativeFeeBalance",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "isAcknowledgmentFeeReserveLow",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

export const ROLES_ALLOWANCE_ABI = [
  {
    type: "function",
    name: "allowances",
    stateMutability: "view",
    inputs: [{ name: "key", type: "bytes32" }],
    outputs: [
      { name: "refill", type: "uint128" },
      { name: "maxRefill", type: "uint128" },
      { name: "period", type: "uint64" },
      { name: "balance", type: "uint128" },
      { name: "timestamp", type: "uint64" },
    ],
  },
] as const;

export function routeTuple(value: unknown): PoolFundingLiveRoute | null {
  if (!value || (typeof value !== "object" && !Array.isArray(value))) return null;
  const tuple = value as {
    safe?: unknown;
    rolesModifier?: unknown;
    allowanceKey?: unknown;
    active?: unknown;
    0?: unknown;
    1?: unknown;
    3?: unknown;
    5?: unknown;
  };
  const safe = address(tuple.safe ?? tuple[0]);
  const rolesModifier = address(tuple.rolesModifier ?? tuple[1]);
  const allowanceKey = tuple.allowanceKey ?? tuple[3];
  if (!safe || !rolesModifier || typeof allowanceKey !== "string") return null;
  return {
    safe,
    rolesModifier,
    allowanceKey: allowanceKey.toLowerCase() as `0x${string}`,
    active: (tuple.active ?? tuple[5]) === true,
  };
}

export function allowanceTuple(value: unknown): ZodiacAllowance | null {
  if (!value || (!Array.isArray(value) && typeof value !== "object")) return null;
  const row = value as {
    0?: unknown;
    1?: unknown;
    2?: unknown;
    3?: unknown;
    4?: unknown;
    refill?: unknown;
    maxRefill?: unknown;
    period?: unknown;
    timestamp?: unknown;
    balance?: unknown;
  };
  return {
    refill: integer(row.refill ?? row[0]),
    maxRefill: integer(row.maxRefill ?? row[1]),
    period: integer(row.period ?? row[2]),
    balance: integer(row.balance ?? row[3]),
    timestamp: integer(row.timestamp ?? row[4]),
  };
}

export function periodSpendTuple(
  value: unknown
): { periodStartedAt: bigint; amount: bigint } | null {
  if (!value || (!Array.isArray(value) && typeof value !== "object")) return null;
  const row = value as { 0?: unknown; 1?: unknown; periodStartedAt?: unknown; amount?: unknown };
  return {
    periodStartedAt: integer(row.periodStartedAt ?? row[0]),
    amount: integer(row.amount ?? row[1]),
  };
}

export async function settledRead<T>(read: Promise<T>): Promise<T | null> {
  try {
    return await read;
  } catch {
    return null;
  }
}
