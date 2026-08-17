import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Abi, Hex } from "viem";

import { creditInvalidationKeys, queryKeys, STALE_TIME_MEDIUM } from "../../config/query-keys";
import {
  getCreditLoan,
  getCreditLoansForSubject,
  getCreditPoolStats,
  getLoanPrincipalRelationship,
} from "../../modules/commitment-pooling/data";
import {
  LoanRail,
  resolveCreditLoanDisclosure,
  selectCreditMutationPolicy,
  type CreditMutationAction,
  type Loan,
} from "../../modules/commitment-pooling";
import type { Address } from "../../types/domain";
import { isZeroAddress, ZERO_ADDRESS } from "../../utils/blockchain/address";
import { parseContractError } from "../../utils/errors/contract-errors";
import { createMutationErrorHandler } from "../../utils/errors/mutation-error-handler";
import { useCurrentChain } from "../blockchain/useChainConfig";
import { useTransactionSender } from "../blockchain/useTransactionSender";

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

function creditArgs(input: CreditMutationInput): readonly unknown[] {
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

export function useCreditLoan(input: {
  chainId: number;
  loanId: bigint;
  viewer?: Address;
  isCurrentSteward: boolean;
}) {
  const { data: rawLoan, ...query } = useQuery({
    queryKey: queryKeys.credit.loan(input.chainId, input.loanId),
    queryFn: () => getCreditLoan(input.chainId, input.loanId),
    enabled: Boolean(input.viewer),
    staleTime: STALE_TIME_MEDIUM,
  });
  const disclosure = resolveCreditLoanDisclosure({
    viewer: input.viewer,
    loan: rawLoan,
    isCurrentSteward: input.isCurrentSteward,
  });
  return { ...query, disclosure, loan: disclosure.status === "visible" ? disclosure.loan : null };
}

export function useCreditSubjectLoans(input: {
  chainId: number;
  poolId: bigint;
  subject: Address;
  viewer?: Address;
  isCurrentSteward: boolean;
}) {
  const viewerIsSubject = input.viewer?.toLowerCase() === input.subject.toLowerCase();
  const authorized = Boolean(input.viewer && (viewerIsSubject || input.isCurrentSteward));
  const viewer = input.viewer ?? ZERO_ADDRESS;
  const { data: rawLoans, ...query } = useQuery({
    queryKey: queryKeys.credit.subjectLoans(input.chainId, input.poolId, input.subject, viewer),
    queryFn: () => getCreditLoansForSubject(input.chainId, input.poolId, input.subject),
    enabled: authorized,
    staleTime: STALE_TIME_MEDIUM,
  });
  const loans = authorized
    ? (rawLoans ?? []).filter(
        (loan): loan is Loan =>
          resolveCreditLoanDisclosure({
            viewer: input.viewer,
            loan,
            isCurrentSteward: input.isCurrentSteward,
          }).status === "visible"
      )
    : [];
  return {
    ...query,
    loans,
    disclosureStatus: !input.viewer ? "unauthenticated" : authorized ? "visible" : "hidden",
  } as const;
}

export function useCreditPoolStats(input: { chainId: number; poolId: bigint }) {
  const query = useQuery({
    queryKey: queryKeys.credit.poolStats(input.chainId, input.poolId),
    queryFn: () => getCreditPoolStats(input.chainId, input.poolId),
    staleTime: STALE_TIME_MEDIUM,
  });
  return { ...query, stats: query.data ?? null };
}

export function useLoanPrincipalRelationship(input: {
  chainId: number;
  disbursementId?: bigint | null;
}) {
  const disbursementId = input.disbursementId ?? 0n;
  const query = useQuery({
    queryKey: queryKeys.credit.settlementRelationship(input.chainId, disbursementId),
    queryFn: () => getLoanPrincipalRelationship(input.chainId, disbursementId),
    enabled: disbursementId !== 0n,
    staleTime: STALE_TIME_MEDIUM,
  });
  return { ...query, relationship: query.data ?? null };
}

export function useCreditMutation(options: { creditRegistry: Address; chainId?: number }) {
  const currentChainId = useCurrentChain();
  const chainId = options.chainId ?? currentChainId;
  const sender = useTransactionSender();
  const queryClient = useQueryClient();
  const handleError = createMutationErrorHandler({
    source: "useCreditMutation",
    toastContext: "credit update",
  });

  return useMutation({
    mutationFn: async (input: CreditMutationInput) => {
      if (!sender) throw new Error("Transaction sender is unavailable");
      if (isZeroAddress(options.creditRegistry)) {
        throw new Error("Credit Registry is not deployed on this chain");
      }
      const policy = selectCreditMutationPolicy({
        action: input.action as CreditMutationAction,
        ...(input.action === "recordDisbursed" || input.action === "recordRepayment"
          ? { rail: input.rail }
          : {}),
      });
      if (!policy.available) throw new Error("G$ repayment is disabled");
      const result = await sender.sendContractCall({
        address: options.creditRegistry,
        abi: CreditRegistryABI,
        functionName: input.action,
        args: creditArgs(input),
        chainId,
      });
      return result.hash;
    },
    onSuccess: async (_hash, input) => {
      for (const queryKey of creditInvalidationKeys({
        chainId,
        ...("loanId" in input ? { loanId: input.loanId } : {}),
        ...(input.action !== "setPaused" && "poolId" in input && input.poolId !== undefined
          ? { poolId: input.poolId }
          : {}),
      })) {
        await queryClient.invalidateQueries({ queryKey });
      }
    },
    onError: (error, input) => {
      const parsed = parseContractError(error);
      handleError(error, {
        metadata: { action: input.action, chainId, parsedErrorName: parsed.name },
      });
    },
  });
}
