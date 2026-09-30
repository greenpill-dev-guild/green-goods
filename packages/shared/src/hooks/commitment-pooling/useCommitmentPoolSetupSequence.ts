/**
 * useCommitmentPoolSetupSequence Hook
 *
 * Runs an ordered chain of pool writes and tells the steward, write by write,
 * where the run is: waiting for the wallet, confirming on chain, done.
 *
 * First-run setup is six writes, opening a seeded season is two, a campaign
 * is two, edited settings one or two (`pool-setup.ts` plans them). Each step is judged from the module
 * before it is sent and again after: a step the chain already shows is
 * recorded as already done and skipped, a step that reverts stops the run with
 * the landed list up to it, and `retry()` walks the same steps again, so only
 * the unlanded call goes out. Nothing already recorded is written twice.
 *
 * When the connected wallet can run several calls as one transaction
 * (`canSendAtomicBatch`), the writes before a cycle opening go to the wallet
 * together (`walletPrompts`): one prompt, one transaction, all or none. The
 * opening follows on its own, because it needs the id the seeding receipt names.
 *
 * The sequence holds the seeded cycle id from the seeding receipt for the
 * `openCycle` that follows; every other judgement is a fresh read. A read that
 * throws stops the run like any other failure rather than escaping, so the
 * console never sits stuck on `running`. Seeding is the exception to the retry
 * rule: no later read can tell this run's cycle from any other, so once a
 * `seedCycle` outcome is unknown the run fails closed instead of seeding again.
 * The indexer keys are invalidated when the run ends, whichever way it ended.
 *
 * @module hooks/commitment-pooling/useCommitmentPoolSetupSequence
 */

import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useRef, useState } from "react";
import type { Hex } from "viem";

import { commitmentPoolingKeys } from "../../config/query-keys/commitment-pooling";
import { createPoolChainReader } from "../../modules/commitment-pooling/pool-chain-reads";
import {
  assertCycleSplit,
  commitmentPoolCallArgs,
} from "../../modules/commitment-pooling/pool-lifecycle";
import {
  judgeStep,
  type PoolChainReader,
  type PoolSetupAction,
  type PoolSetupFailure,
  type PoolSetupRunContext,
  type PoolSetupStep,
  type PoolStepVerdict,
  stepToCall,
} from "../../modules/commitment-pooling/pool-setup";
import { TransactionRevertedError, type ContractCall } from "../../modules/transactions/types";
import type { Address } from "../../types/domain";
import { CommitmentPoolingModuleABI } from "../../utils/blockchain/contracts";
import { parseContractError } from "../../utils/errors/contract-errors";
import { createMutationErrorHandler } from "../../utils/errors/mutation-error-handler";
import { useCurrentChain } from "../blockchain/useChainConfig";
import { useTransactionSender } from "../blockchain/useTransactionSender";
import { useAsyncEffect } from "../utils/useAsyncEffect";
import { resolveCommitmentPoolingModule } from "./useCommitmentPoolMutations";

/**
 * - `pending`: not reached yet.
 * - `signing`: waiting for the steward to approve it in the wallet.
 * - `confirming`: approved; waiting for the chain.
 * - `landed`: this run wrote it and the chain shows it.
 * - `already`: the chain showed it before this run asked, so it was skipped.
 * - `failed`: the run stopped here.
 */
export type PoolSetupStepStatus =
  | "pending"
  | "signing"
  | "confirming"
  | "landed"
  | "already"
  | "failed";

export interface PoolSetupStepState {
  action: PoolSetupAction;
  status: PoolSetupStepStatus;
  /** The transaction that carried it, once the wallet has returned one. */
  hash: Hex | null;
  /** Sent together with its neighbours in one wallet prompt. */
  batched: boolean;
}

/** Whether the wallet can take the setup writes as one approval, as last asked. */
export type PoolSetupBatching = "checking" | "available" | "unavailable";

export interface PoolSetupSequenceState {
  status: "idle" | "running" | "complete" | "failed";
  steps: PoolSetupStepState[];
  /** What the chain shows as done, in step order. */
  landed: PoolSetupAction[];
  failedStep: PoolSetupAction | null;
  failure: PoolSetupFailure | null;
  error: unknown;
  /** The cycle this run seeded or opened, once known. */
  cycleId: bigint | null;
}

export interface PoolSetupOutcome {
  status: "complete" | "failed";
  landed: PoolSetupAction[];
  failedStep: PoolSetupAction | null;
  failure: PoolSetupFailure | null;
  error: unknown;
  cycleId: bigint | null;
}

const IDLE: PoolSetupSequenceState = {
  status: "idle",
  steps: [],
  landed: [],
  failedStep: null,
  failure: null,
  error: null,
  cycleId: null,
};

function knownCycleId(steps: PoolSetupStep[]): bigint | null {
  for (const step of steps) {
    if (step.action === "openCycle" && step.cycleId !== "seeded") return step.cycleId;
  }
  return null;
}

export function useCommitmentPoolSetupSequence(
  options: {
    chainId?: number;
    /** Injected by tests; the default reads the module through wagmi. */
    reader?: PoolChainReader;
    /** What a failure toast calls the run; setup unless the caller says otherwise. */
    toastContext?: string;
  } = {}
) {
  const currentChainId = useCurrentChain();
  const chainId = options.chainId ?? currentChainId;
  const sender = useTransactionSender();
  const queryClient = useQueryClient();
  const reader = useMemo(
    () => options.reader ?? createPoolChainReader(chainId),
    [options.reader, chainId]
  );
  const toastContext = options.toastContext ?? "pool setup";
  const handleError = useMemo(
    () =>
      createMutationErrorHandler({
        source: "useCommitmentPoolSetupSequence",
        toastContext,
      }),
    [toastContext]
  );
  const [state, setState] = useState<PoolSetupSequenceState>(IDLE);
  const [batching, setBatching] = useState<PoolSetupBatching>("checking");
  const stepsRef = useRef<PoolSetupStep[]>([]);
  // The seeded id survives across retries within one sequence: the receipt
  // named it once and the chain still holds the cycle.
  const cycleIdRef = useRef<bigint | null>(null);
  // Set when a `seedCycle` went out and this sequence could not learn whether
  // it landed. It also survives retries: the ambiguity does not clear by
  // asking again, and only `reset()` (a fresh open of the flow, after the
  // console has refetched the pool) lifts it.
  const seedUnconfirmedRef = useRef(false);

  // Asked before the run so the flow can say up front how many times the
  // wallet will ask. Asking never prompts; a wallet that cannot answer counts
  // as one that cannot batch.
  useAsyncEffect(
    async ({ isMounted }) => {
      setBatching("checking");
      const able = sender?.canSendAtomicBatch
        ? await sender.canSendAtomicBatch(chainId).catch(() => false)
        : false;
      if (isMounted()) setBatching(able ? "available" : "unavailable");
    },
    [sender, chainId]
  );

  const run = useCallback(
    async (steps: PoolSetupStep[]): Promise<PoolSetupOutcome> => {
      stepsRef.current = steps;
      if (cycleIdRef.current === null) cycleIdRef.current = knownCycleId(steps);
      const stepStates: PoolSetupStepState[] = steps.map((step) => ({
        action: step.action,
        status: "pending",
        hash: null,
        batched: false,
      }));
      // What the chain shows as done, in step order, read from the step states
      // so a write found already done inside a batch is never left out.
      const landedActions = (): PoolSetupAction[] =>
        stepStates
          .filter((entry) => entry.status === "landed" || entry.status === "already")
          .map((entry) => entry.action);
      const context: PoolSetupRunContext = { cycleId: cycleIdRef.current };
      const publish = (patch: Partial<PoolSetupSequenceState>) =>
        setState((previous) => ({
          ...previous,
          steps: stepStates.map((step) => ({ ...step })),
          landed: landedActions(),
          cycleId: context.cycleId,
          ...patch,
        }));
      const fail = (
        failure: PoolSetupFailure,
        failedStep: PoolSetupAction | null,
        error: unknown
      ): PoolSetupOutcome => {
        const outcome: PoolSetupOutcome = {
          status: "failed",
          landed: landedActions(),
          failedStep,
          failure,
          error,
          cycleId: context.cycleId,
        };
        publish({ status: "failed", failedStep, failure, error });
        return outcome;
      };
      /**
       * A chain read that threw stops the run like any other failure. Letting
       * it escape would leave the sequence `running`, which in the console
       * disables every control and blocks the close, even where earlier writes
       * already landed. Nothing was sent, so the landed list still stands and
       * the run is safe to repeat.
       */
      const readFailed = (
        step: PoolSetupStep,
        stepState: PoolSetupStepState,
        error: unknown
      ): PoolSetupOutcome => {
        stepState.status = "failed";
        handleError(error, {
          metadata: {
            action: step.action,
            chainId,
            parsedErrorName: parseContractError(error).name,
          },
        });
        return fail("read-failed", step.action, error);
      };
      const invalidate = async () => {
        await queryClient.invalidateQueries({
          queryKey: commitmentPoolingKeys.all(chainId),
        });
        const poolIds = new Set(steps.map((step) => step.poolId.toString()));
        for (const poolId of poolIds) {
          await queryClient.invalidateQueries({
            queryKey: commitmentPoolingKeys.pool(chainId, poolId),
          });
        }
        if (context.cycleId !== null) {
          await queryClient.invalidateQueries({
            queryKey: commitmentPoolingKeys.cycle(chainId, context.cycleId),
          });
        }
      };

      publish({ status: "running", failedStep: null, failure: null, error: null });

      // Refusals that need no chain: a split the contract would reject, a
      // chain that does not serve pooling, no wallet to send from.
      for (const step of steps) {
        if (step.action !== "openCycle") continue;
        try {
          assertCycleSplit(step);
        } catch (error) {
          return fail("invalid-split", "openCycle", error);
        }
      }
      let moduleAddress: Address;
      try {
        moduleAddress = resolveCommitmentPoolingModule(chainId);
      } catch (error) {
        return fail("unavailable", null, error);
      }
      if (!sender) return fail("no-sender", null, new Error("Transaction sender is unavailable"));
      const canBatch = sender.sendAtomicBatch
        ? await (sender.canSendAtomicBatch?.(chainId) ?? Promise.resolve(false)).catch(() => false)
        : false;

      const toCall = (step: PoolSetupStep): ContractCall | null => {
        const call = stepToCall(step, context);
        if (!call) return null;
        return {
          address: moduleAddress,
          abi: CommitmentPoolingModuleABI,
          functionName: call.action,
          args: commitmentPoolCallArgs(call),
          chainId,
        };
      };
      /** A send the wallet refused, or a batch the chain proved reverted, wrote nothing. */
      const wroteNothing = (error: unknown, batch: boolean) =>
        parseContractError(error).name === "UserRejected" ||
        (batch && error instanceof TransactionRevertedError);
      /** The seeding receipt names the cycle; without it nothing is safe to send again. */
      const learnSeededCycle = async (
        hash: Hex,
        seedStep: PoolSetupStep,
        stepState: PoolSetupStepState
      ): Promise<PoolSetupOutcome | null> => {
        let seededId: bigint | null;
        try {
          seededId = await reader.readSeededCycleId(hash, seedStep.poolId);
        } catch (error) {
          seedUnconfirmedRef.current = true;
          stepState.status = "failed";
          return fail("seed-unconfirmed", "seedCycle", error);
        }
        if (seededId === null) {
          seedUnconfirmedRef.current = true;
          stepState.status = "failed";
          return fail("seed-unconfirmed", "seedCycle", null);
        }
        context.cycleId = seededId;
        cycleIdRef.current = seededId;
        return null;
      };

      try {
        let index = 0;
        while (index < steps.length) {
          const step = steps[index]!;
          const stepState = stepStates[index]!;
          // A seed whose outcome this sequence never learned is terminal:
          // walking the step again would seed a second cycle beside the one
          // that may already be there.
          if (
            step.action === "seedCycle" &&
            seedUnconfirmedRef.current &&
            context.cycleId === null
          ) {
            stepState.status = "failed";
            return fail("seed-unconfirmed", step.action, null);
          }
          let before: PoolStepVerdict;
          try {
            before = await judgeStep(step, reader, context);
          } catch (error) {
            return readFailed(step, stepState, error);
          }
          if (before.landed) {
            stepState.status = "already";
            publish({});
            index += 1;
            continue;
          }
          if (before.refused) {
            stepState.status = "failed";
            return fail(before.refused, step.action, null);
          }

          // The group this write rides in: itself, plus every following write
          // up to the cycle opening, when the wallet can take them as one.
          const group = [index];
          let next = index + 1;
          if (canBatch && step.action !== "openCycle") {
            while (next < steps.length && steps[next]!.action !== "openCycle") {
              if (
                steps[next]!.action === "seedCycle" &&
                seedUnconfirmedRef.current &&
                context.cycleId === null
              ) {
                stepStates[next]!.status = "failed";
                return fail("seed-unconfirmed", "seedCycle", null);
              }
              let verdict: PoolStepVerdict;
              try {
                verdict = await judgeStep(steps[next]!, reader, context);
              } catch (error) {
                return readFailed(steps[next]!, stepStates[next]!, error);
              }
              if (verdict.refused) {
                stepStates[next]!.status = "failed";
                return fail(verdict.refused, steps[next]!.action, null);
              }
              if (verdict.landed) {
                stepStates[next]!.status = "already";
              } else {
                group.push(next);
              }
              next += 1;
            }
          }
          const batch = group.length > 1;
          const calls: ContractCall[] = [];
          for (const member of group) {
            const call = toCall(steps[member]!);
            if (!call) {
              stepStates[member]!.status = "failed";
              return fail("cycle-id-unknown", steps[member]!.action, null);
            }
            calls.push(call);
            stepStates[member]!.status = "signing";
            stepStates[member]!.batched = batch;
          }
          publish({});
          const markConfirming = async (hash: Hex | null) => {
            for (const member of group) {
              stepStates[member]!.status = "confirming";
              if (hash) stepStates[member]!.hash = hash;
            }
            publish({});
          };

          let hash: Hex;
          try {
            const result = batch
              ? await sender.sendAtomicBatch!(calls, { onAccepted: () => markConfirming(null) })
              : await sender.sendContractCall(calls[0]!, { onBroadcast: markConfirming });
            hash = result.hash;
          } catch (error) {
            for (const member of group) stepStates[member]!.status = "failed";
            const parsed = parseContractError(error);
            handleError(error, {
              metadata: { action: step.action, chainId, parsedErrorName: parsed.name },
            });
            // A rejected send says nothing about the chain unless the wallet
            // reports the steward refusing it (or an atomic batch proved it
            // reverted), which means nothing was written. Any other failure may
            // still have been mined, and a mined `seedCycle` this run cannot
            // name is a cycle a second seed would orphan, so the run stops
            // instead of offering to repeat it.
            const seeding = group.some((member) => steps[member]!.action === "seedCycle");
            if (seeding && !wroteNothing(error, batch)) {
              seedUnconfirmedRef.current = true;
              return fail("seed-unconfirmed", "seedCycle", error);
            }
            return fail("send-failed", step.action, error);
          }

          const seedMember = group.find((member) => steps[member]!.action === "seedCycle");
          if (seedMember !== undefined) {
            // The seed is mined by now; only its receipt names the cycle. With
            // no id there is nothing to open and nothing safe to send again.
            const stopped = await learnSeededCycle(
              hash,
              steps[seedMember]!,
              stepStates[seedMember]!
            );
            if (stopped) return stopped;
          }
          for (const member of group) {
            let after: PoolStepVerdict;
            try {
              after = await judgeStep(steps[member]!, reader, context);
            } catch (error) {
              return readFailed(steps[member]!, stepStates[member]!, error);
            }
            if (!after.landed) {
              stepStates[member]!.status = "failed";
              return fail("not-confirmed", steps[member]!.action, null);
            }
            stepStates[member]!.status = "landed";
            stepStates[member]!.hash = hash;
          }
          publish({});
          index = next;
        }
      } finally {
        await invalidate();
      }
      const outcome: PoolSetupOutcome = {
        status: "complete",
        landed: landedActions(),
        failedStep: null,
        failure: null,
        error: null,
        cycleId: context.cycleId,
      };
      publish({ status: "complete", failedStep: null, failure: null, error: null });
      return outcome;
    },
    [chainId, handleError, queryClient, reader, sender]
  );

  /** Walk the same steps again; what the chain already shows is skipped. */
  const retry = useCallback(() => run(stepsRef.current), [run]);

  const reset = useCallback(() => {
    stepsRef.current = [];
    cycleIdRef.current = null;
    seedUnconfirmedRef.current = false;
    setState(IDLE);
  }, []);

  return { state, run, retry, reset, batching };
}
