import { useQuery } from "@tanstack/react-query";

import { STALE_TIME_MEDIUM } from "../../config/query-keys/constants";
import { commitmentPoolingKeys } from "../../config/query-keys/commitment-pooling";
import {
  getCommitmentPayoutPlan,
  getSettlementAccount,
  getSettlementConfigurations,
  getSettlementSubject,
} from "../../modules/commitment-pooling/data";
import {
  deriveSettlementDeliveryState,
  isSuccessfulSettlementExecution,
} from "../../modules/commitment-pooling/settlement";
import type { Address } from "../../types/domain";
import { useCommitmentPoolingAvailability } from "./useCommitmentPoolingAvailability";

export function useSettlementConfigurations(input: { chainId: number }) {
  const availability = useCommitmentPoolingAvailability(input);
  const query = useQuery({
    queryKey: commitmentPoolingKeys.settlementConfiguration(input.chainId),
    queryFn: () => getSettlementConfigurations(input.chainId),
    enabled: availability.status === "available",
    staleTime: STALE_TIME_MEDIUM,
  });
  return { ...query, configurations: query.data ?? [], availability };
}

export function useSettlementAccount(input: { chainId: number; garden: Address }) {
  const availability = useCommitmentPoolingAvailability(input);
  const query = useQuery({
    queryKey: commitmentPoolingKeys.settlementAccount(input.chainId, input.garden),
    queryFn: () => getSettlementAccount(input.chainId, input.garden),
    enabled: availability.status === "available",
    staleTime: STALE_TIME_MEDIUM,
  });
  return { ...query, detail: query.data ?? null, availability };
}

export function useSettlementSubject(input: {
  chainId: number;
  isBatch: boolean;
  subjectId: bigint;
  gardenerDeliveryEnabled?: boolean | null;
  now?: number;
  delayAfterSeconds?: number;
}) {
  const availability = useCommitmentPoolingAvailability(input);
  const query = useQuery({
    queryKey: commitmentPoolingKeys.settlementSubject(
      input.chainId,
      input.isBatch,
      input.subjectId
    ),
    queryFn: () => getSettlementSubject(input.chainId, input.isBatch, input.subjectId),
    enabled: availability.status === "available",
    staleTime: STALE_TIME_MEDIUM,
  });
  const detail = query.data ?? null;
  const now = input.now ?? Math.floor(Date.now() / 1000);
  const deliveryDelayed = Boolean(
    detail?.subject.state === "DISPATCHED" &&
      detail.subject.dispatchedAt &&
      now - detail.subject.dispatchedAt > (input.delayAfterSeconds ?? 30 * 60)
  );
  const executionSucceeded = isSuccessfulSettlementExecution(detail?.execution?.status);
  return {
    ...query,
    detail,
    delivery: deriveSettlementDeliveryState({
      state: detail?.subject.state ?? null,
      cancelledFromState: detail?.subject.cancelledFromState,
      ...(detail?.subject.failureCode === null || detail?.subject.failureCode === undefined
        ? {}
        : { failureCode: detail.subject.failureCode }),
      executed: executionSucceeded,
      acknowledgmentPending: Boolean(
        executionSucceeded && detail?.execution && !detail.execution.acknowledgmentSent
      ),
      deliveryDelayed,
      gardenerDeliveryEnabled: input.gardenerDeliveryEnabled,
    }),
    availability,
  };
}

export function useCommitmentPayoutPlan(input: { chainId: number; payoutPlanId: bigint }) {
  const availability = useCommitmentPoolingAvailability(input);
  const query = useQuery({
    queryKey: commitmentPoolingKeys.payoutPlan(input.chainId, input.payoutPlanId),
    queryFn: () => getCommitmentPayoutPlan(input.chainId, input.payoutPlanId),
    enabled: availability.status === "available",
    staleTime: STALE_TIME_MEDIUM,
  });
  return {
    ...query,
    detail: query.data ?? null,
    payoutPlan: query.data?.plan ?? null,
    availability,
  };
}
