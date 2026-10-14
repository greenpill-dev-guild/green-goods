import type { Abi, Hex } from "viem";

import { LoanRail } from "../../modules/commitment-pooling";
import type { Address } from "../../types/domain";
import { ZERO_ADDRESS } from "../../utils/blockchain/address";

export const CreditRegistryABI = [
  {
    type: "function",
    name: "configurePoolCredit",
    stateMutability: "nonpayable",
    inputs: [
      { name: "poolId", type: "uint256" },
      { name: "token", type: "address" },
      { name: "borrowerCap", type: "uint256" },
      { name: "enabled", type: "bool" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "addExecutor",
    stateMutability: "nonpayable",
    inputs: [
      { name: "poolId", type: "uint256" },
      { name: "executor", type: "address" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "removeExecutor",
    stateMutability: "nonpayable",
    inputs: [
      { name: "poolId", type: "uint256" },
      { name: "executor", type: "address" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "requestLoan",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "params",
        type: "tuple",
        components: [
          { name: "poolId", type: "uint256" },
          { name: "commitmentId", type: "uint256" },
          { name: "token", type: "address" },
          { name: "principal", type: "uint256" },
          { name: "dueDate", type: "uint64" },
          { name: "installmentsTotal", type: "uint32" },
          { name: "termsCID", type: "string" },
          { name: "onBehalfOf", type: "address" },
        ],
      },
    ],
    outputs: [{ name: "loanId", type: "uint256" }],
  },
  {
    type: "function",
    name: "approveLoan",
    stateMutability: "nonpayable",
    inputs: [{ name: "loanId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "recordDisbursed",
    stateMutability: "nonpayable",
    inputs: [
      { name: "loanId", type: "uint256" },
      { name: "rail", type: "uint8" },
      { name: "executionRef", type: "bytes32" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "recordRepayment",
    stateMutability: "nonpayable",
    inputs: [
      { name: "loanId", type: "uint256" },
      { name: "amount", type: "uint256" },
      { name: "executionRef", type: "bytes32" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "markDefaulted",
    stateMutability: "nonpayable",
    inputs: [
      { name: "loanId", type: "uint256" },
      { name: "reasonCID", type: "string" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "cancelLoan",
    stateMutability: "nonpayable",
    inputs: [
      { name: "loanId", type: "uint256" },
      { name: "reasonCID", type: "string" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "setPaused",
    stateMutability: "nonpayable",
    inputs: [{ name: "paused", type: "bool" }],
    outputs: [],
  },
] as const satisfies Abi;

export type CreditMutationInput =
  | {
      action: "configurePoolCredit";
      poolId: bigint;
      token: Address;
      borrowerCap: bigint;
      enabled: boolean;
    }
  | { action: "addExecutor" | "removeExecutor"; poolId: bigint; executor: Address }
  | {
      action: "requestLoan";
      poolId: bigint;
      borrower: Address;
      commitmentId?: bigint;
      token: Address;
      principal: bigint;
      dueDate: bigint;
      installmentsTotal: number;
      termsCID: string;
      onBehalfOf?: Address;
    }
  | {
      action: "approveLoan";
      loanId: bigint;
      poolId?: bigint;
      borrower?: Address;
    }
  | {
      action: "recordDisbursed";
      loanId: bigint;
      poolId?: bigint;
      borrower?: Address;
      rail: LoanRail;
      executionRef: Hex;
    }
  | {
      action: "recordRepayment";
      loanId: bigint;
      poolId?: bigint;
      borrower?: Address;
      rail: LoanRail;
      amount: bigint;
      executionRef: Hex;
    }
  | {
      action: "markDefaulted" | "cancelLoan";
      loanId: bigint;
      poolId?: bigint;
      borrower?: Address;
      reasonCID: string;
    }
  | { action: "setPaused"; paused: boolean };

function railNumber(rail: LoanRail): number {
  return {
    [LoanRail.NONE]: 0,
    [LoanRail.JAR]: 1,
    [LoanRail.TREASURY]: 2,
    [LoanRail.GDOLLAR_SETTLEMENT]: 3,
  }[rail];
}

export function creditArgs(input: CreditMutationInput): readonly unknown[] {
  switch (input.action) {
    case "configurePoolCredit":
      return [input.poolId, input.token, input.borrowerCap, input.enabled];
    case "addExecutor":
    case "removeExecutor":
      return [input.poolId, input.executor];
    case "requestLoan":
      return [
        {
          poolId: input.poolId,
          commitmentId: input.commitmentId ?? 0n,
          token: input.token,
          principal: input.principal,
          dueDate: input.dueDate,
          installmentsTotal: input.installmentsTotal,
          termsCID: input.termsCID,
          onBehalfOf: input.onBehalfOf ?? ZERO_ADDRESS,
        },
      ];
    case "approveLoan":
      return [input.loanId];
    case "recordDisbursed":
      return [input.loanId, railNumber(input.rail), input.executionRef];
    case "recordRepayment":
      return [input.loanId, input.amount, input.executionRef];
    case "markDefaulted":
    case "cancelLoan":
      return [input.loanId, input.reasonCID];
    case "setPaused":
      return [input.paused];
  }
}
