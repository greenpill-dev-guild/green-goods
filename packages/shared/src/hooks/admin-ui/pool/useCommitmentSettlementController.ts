/**
 * useCommitmentSettlementController Hook
 *
 * The G$ payout for one fulfilled, priced commitment, run through the
 * settlement module's own sequence: create the payout plan, finalize it,
 * prepare the child disbursement, dispatch it, wait for the Celo
 * acknowledgement. The controller reads the chain before and after every
 * step, so a steward who refreshes mid-way resumes from what the module
 * holds, and a plan the module already recorded is never created twice.
 *
 * Authority follows the contract: the payer garden's stewards and owners run
 * the plan (PlanLib `_requireSteward`); the executor garden's stewards and
 * the exact dispatcher move disbursements (LifecycleLib). Module ownership
 * alone never grants dispatch, retry, requeue, or cancellation here.
 *
 * @module hooks/admin-ui/pool/useCommitmentSettlementController
 */

import { useQuery } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";
import type {
  CommitmentSettlementActs,
  CommitmentSettlementController,
  SettlementActKind,
  SettlementActStatus,
} from "./controller.types";

import { STALE_TIME_MEDIUM } from "../../../config/query-keys/constants";
import { commitmentPoolingKeys } from "../../../config/query-keys/commitment-pooling";
import { readCommitmentSettlementChainState } from "../../../modules/commitment-pooling/data-settlement-chain";
import { pinCommitmentReason } from "../../../modules/commitment-pooling/reasons";
import {
  hashRecognitionSnapshot,
  type RecognitionEntryInput,
} from "../../../modules/commitment-pooling/settlement";
import {
  selectSettlementEligibility,
  selectSettlementWorkflow,
} from "../../../modules/commitment-pooling/settlement-workflow";
import { isPoolSteward } from "../../../modules/commitment-pooling/steward-selectors";
import type {
  CommitmentReadModel,
  HexString,
} from "../../../modules/commitment-pooling/types-core";
import type { CommitmentDetail } from "../../../modules/commitment-pooling/types-relations";
import type { Address } from "../../../types/domain";
import { isZeroAddress } from "../../../utils/blockchain/address";
import { useOnlineStatus } from "../../app/useOnlineStatus";
import { usePrimaryAddress } from "../../auth/usePrimaryAddress";
import { useCommitmentPoolingAvailability } from "../../commitment-pooling/useCommitmentPoolingAvailability";
import { usePoolFunding } from "../../commitment-pooling/usePoolFunding";
import { useProtocolPool } from "../../commitment-pooling/useProtocolPool";
import {
  type SettlementMutationInput,
  useSettlementMutation,
  useSettlementOperationsCapabilities,
} from "../../commitment-pooling/useSettlement";
import { useGardenRoles } from "../../roles/useGardenRoles";

const ZERO_HASH = `0x${"0".repeat(64)}` as HexString;
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as Address;

/**
 * The active roster with its indexed recognition weights, in ascending
 * contributor order — the order the module persists and validates.
 */
function selectRecognitionEntries(detail: CommitmentDetail | null): RecognitionEntryInput[] {
  return (detail?.contributors ?? [])
    .filter((row) => row.active && row.recognitionWeightBps !== null)
    .map((row) => ({
      contributor: row.contributor.toLowerCase() as Address,
      recognitionWeightBps: row.recognitionWeightBps as number,
    }))
    .sort((left, right) => (left.contributor < right.contributor ? -1 : 1));
}

export function useCommitmentSettlementController(input: {
  chainId: number;
  commitment: CommitmentReadModel | null;
  detail: CommitmentDetail | null;
}): CommitmentSettlementController {
  const { chainId, commitment, detail } = input;
  const commitmentId = commitment?.commitmentId ?? 0n;
  const viewer = usePrimaryAddress() ?? undefined;
  const isOnline = useOnlineStatus();
  const availability = useCommitmentPoolingAvailability({ chainId });
  const eligibility = selectSettlementEligibility({ commitment, availability });
  const payerGarden =
    commitment?.payerGarden && !isZeroAddress(commitment.payerGarden)
      ? commitment.payerGarden
      : null;

  const recognitionEntries = useMemo(() => selectRecognitionEntries(detail), [detail]);
  const chainQuery = useQuery({
    queryKey: commitmentPoolingKeys.settlementChain(chainId, commitmentId),
    queryFn: () =>
      readCommitmentSettlementChainState({ chainId, commitmentId, recognitionEntries }),
    enabled: eligibility.eligible && commitmentId !== 0n,
    staleTime: STALE_TIME_MEDIUM,
  });
  const chain = chainQuery.data ?? null;

  const payerRoles = useGardenRoles(payerGarden, viewer, chainId);
  const protocolPool = useProtocolPool({ chainId });
  const capabilities = useSettlementOperationsCapabilities({
    chainId,
    account: viewer,
    protocolGarden: protocolPool.rootGarden,
    executorGarden: payerGarden,
    isDeployer: false,
  });
  const fundingQuery = usePoolFunding(
    { chainId, garden: payerGarden ?? ZERO_ADDRESS },
    { enabled: eligibility.eligible && payerGarden !== null }
  );
  const mutation = useSettlementMutation({ chainId });
  const [lastAct, setLastAct] = useState<SettlementActStatus | null>(null);

  const refetch = useCallback(
    () => Promise.all([chainQuery.refetch(), fundingQuery.refetch()]),
    [chainQuery, fundingQuery]
  );

  const run = useCallback(
    async (kind: SettlementActKind, call: SettlementMutationInput): Promise<HexString> => {
      setLastAct({ kind, phase: "signing" });
      try {
        const hash = (await mutation.mutateAsync(call)) as HexString;
        setLastAct({ kind, phase: "confirmed", hash });
        await refetch();
        return hash;
      } catch (error) {
        setLastAct({ kind, phase: "failed", error });
        // A rejected or reverted call changes nothing on chain; the read that
        // follows is what the panel renders from, never the attempt itself.
        await refetch().catch(() => undefined);
        throw error;
      }
    },
    [mutation, refetch]
  );

  const acts = useMemo<CommitmentSettlementActs>(
    () => ({
      createPlan: async () => {
        // The parent pointer is read fresh right before the call: a plan the
        // module already holds is resumed, never recreated.
        const { data: latest } = await chainQuery.refetch();
        if (latest?.payoutPlanId) {
          throw new Error(`A payout plan already exists (#${latest.payoutPlanId.toString()})`);
        }
        const beneficiaryShape = (latest?.kind ?? eligibility.kind) === "GARDEN_BENEFICIARY";
        const entries = beneficiaryShape ? [] : recognitionEntries;
        return run("create-plan", {
          action: "createCommitmentPayoutPlan",
          commitmentId,
          recognitionEntries: entries,
          recognitionSnapshotHash: beneficiaryShape
            ? ZERO_HASH
            : hashRecognitionSnapshot({ chainId, commitmentId, entries }),
        });
      },
      finalizePlan: () => {
        if (!chain?.payoutPlanId) throw new Error("No payout plan to finalize");
        return run("finalize-plan", {
          action: "finalizeCommitmentPayoutPlan",
          payoutPlanId: chain.payoutPlanId,
        });
      },
      prepareBeneficiary: () => {
        if (!chain?.payoutPlanId) throw new Error("No payout plan to prepare");
        return run("prepare-beneficiary", {
          action: "prepareGardenBeneficiaryPayout",
          payoutPlanId: chain.payoutPlanId,
        });
      },
      prepareContributor: (contributor: Address) => {
        if (!chain?.payoutPlanId) throw new Error("No payout plan to prepare");
        return run("prepare-contributor", {
          action: "prepareContributorPayout",
          payoutPlanId: chain.payoutPlanId,
          contributor,
        });
      },
      dispatch: (disbursementId: bigint) =>
        run("dispatch", { action: "dispatchDisbursement", disbursementId }),
      retry: (disbursementId: bigint) => run("retry", { action: "retryCommand", disbursementId }),
      requeue: (disbursementId: bigint) => run("requeue", { action: "requeue", disbursementId }),
      cancel: async (disbursementId: bigint, reason: string) => {
        const reasonCID = await pinCommitmentReason({
          reason,
          gardenAddress: payerGarden,
          source: "cancelDisbursement",
        });
        return run("cancel", { action: "cancelDisbursement", disbursementId, reasonCID });
      },
    }),
    [
      chain,
      chainId,
      chainQuery,
      commitmentId,
      eligibility.kind,
      payerGarden,
      recognitionEntries,
      run,
    ]
  );

  const kind = chain?.kind ?? eligibility.kind;
  const isPayerSteward = isPoolSteward(payerRoles.roles);
  const chainRead: CommitmentSettlementController["chainRead"] = !eligibility.eligible
    ? "ready"
    : chainQuery.isError
      ? "failed"
      : chain
        ? "ready"
        : "pending";
  const workflow = selectSettlementWorkflow({
    kind: kind ?? "CONTRIBUTOR_CONSIDERATION",
    plan: chain?.plan ?? null,
    rows: chain?.rows ?? [],
    disbursements: chain?.disbursements ?? [],
    gardenerDeliveryEnabled: chain ? chain.gardenerDeliveryEnabled : null,
    sourcePaused: chain ? chain.sourcePaused : null,
    payerAccountActive: chain ? chain.payerAccount?.active === true : null,
    beneficiaryAccountActive:
      chain && kind === "GARDEN_BENEFICIARY" ? chain.beneficiaryAccount?.active === true : null,
    recognitionReady: chain?.recognitionReady ?? null,
    authority: {
      viewer,
      isPayerSteward,
      canDispatchOrRetry: capabilities.canDispatchOrRetry,
      canRequeueOrCancel: capabilities.canRequeueOrCancel,
    },
    isOnline,
    chainRead,
    isActing: mutation.isPending,
  });

  const funding = useMemo(
    () => ({
      snapshot: fundingQuery.snapshot,
      isLoading: fundingQuery.isLoading,
      isFetching: fundingQuery.isFetching,
      isRefetching: fundingQuery.isRefetching,
      isError: fundingQuery.isError,
      hasStaleBalance: fundingQuery.hasStaleBalance,
      lastReadAt: fundingQuery.lastReadAt,
      ledgerReadAt: fundingQuery.ledgerReadAt,
      refetch: fundingQuery.refetch,
    }),
    [
      fundingQuery.snapshot,
      fundingQuery.isLoading,
      fundingQuery.isFetching,
      fundingQuery.isRefetching,
      fundingQuery.isError,
      fundingQuery.hasStaleBalance,
      fundingQuery.lastReadAt,
      fundingQuery.ledgerReadAt,
      fundingQuery.refetch,
    ]
  );

  return {
    chainId,
    commitmentId,
    viewer,
    isOnline,
    availability,
    eligibility,
    kind,
    payerGarden,
    payerAccount: chain?.payerAccount ?? null,
    beneficiaryGarden:
      chain?.plan?.beneficiaryGarden ??
      (kind === "GARDEN_BENEFICIARY" ? (commitment?.providerGarden ?? null) : null),
    beneficiaryAccount: chain?.beneficiaryAccount ?? null,
    declaredAmount: chain?.plan?.declaredAmount ?? commitment?.considerationAmount ?? null,
    token: chain?.plan?.token ?? fundingQuery.snapshot?.token ?? null,
    chain,
    chainRead,
    plan: chain?.plan ?? null,
    rows: chain?.rows ?? [],
    workflow,
    funding,
    authority: {
      isPayerSteward,
      canDispatchOrRetry: capabilities.canDispatchOrRetry,
      canRequeueOrCancel: capabilities.canRequeueOrCancel,
      resolved: !payerRoles.isLoading && !capabilities.isLoading,
    },
    acts,
    lastAct,
    isActing: mutation.isPending,
    refetch,
  };
}
