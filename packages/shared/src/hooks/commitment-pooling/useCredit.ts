import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { STALE_TIME_MEDIUM } from "../../config/query-keys/constants";
import { creditInvalidationKeys, creditKeys } from "../../config/query-keys/credit";
import {
  getCreditLoan,
  getCreditLoansForSubject,
  getCreditPoolStats,
  getLoanPrincipalRelationship,
} from "../../modules/commitment-pooling/data";
import {
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
import { CreditRegistryABI, creditArgs, type CreditMutationInput } from "./credit-mutation-config";

export { CreditRegistryABI, type CreditMutationInput } from "./credit-mutation-config";

export function useCreditLoan(input: {
  chainId: number;
  loanId: bigint;
  viewer?: Address;
  isCurrentSteward: boolean;
}) {
  const viewer = input.viewer ?? ZERO_ADDRESS;
  const { data: rawLoan, ...query } = useQuery({
    queryKey: creditKeys.loan(input.chainId, input.loanId, viewer),
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
    queryKey: creditKeys.subjectLoans(input.chainId, input.poolId, input.subject, viewer),
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
    queryKey: creditKeys.poolStats(input.chainId, input.poolId),
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
    queryKey: creditKeys.settlementRelationship(input.chainId, disbursementId),
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
