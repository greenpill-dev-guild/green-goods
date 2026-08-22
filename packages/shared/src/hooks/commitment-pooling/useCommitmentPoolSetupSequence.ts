/**
 * useCommitmentPoolSetupSequence Hook
 *
 * Runs an ordered chain of pool writes and tells the steward what landed.
 *
 * First-run setup is six writes, opening a seeded season is two, a campaign
 * is two (`pool-setup.ts` plans them). Each step is judged from the module
 * before it is sent and again after: a step the chain already shows is
 * recorded as landed and skipped, a step that reverts stops the run with the
 * landed list up to it, and `retry()` walks the same steps again, so only the
 * unlanded call goes out. Nothing already recorded is written twice.
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

import { queryKeys } from "../../config/query-keys";
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
import type { Address } from "../../types/domain";
import { CommitmentPoolingModuleABI } from "../../utils/blockchain/contracts";
import { parseContractError } from "../../utils/errors/contract-errors";
import { createMutationErrorHandler } from "../../utils/errors/mutation-error-handler";
import { useCurrentChain } from "../blockchain/useChainConfig";
import { useTransactionSender } from "../blockchain/useTransactionSender";
import { resolveCommitmentPoolingModule } from "./useCommitmentPoolMutations";

export type PoolSetupStepStatus = "pending" | "sending" | "landed" | "failed";

export interface PoolSetupStepState {
  action: PoolSetupAction;
  status: PoolSetupStepStatus;
}

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
  const handleError = useMemo(
    () =>
      createMutationErrorHandler({
        source: "useCommitmentPoolSetupSequence",
        toastContext: "pool setup",
      }),
    []
  );
  const [state, setState] = useState<PoolSetupSequenceState>(IDLE);
  const stepsRef = useRef<PoolSetupStep[]>([]);
  // The seeded id survives across retries within one sequence: the receipt
  // named it once and the chain still holds the cycle.
  const cycleIdRef = useRef<bigint | null>(null);
  // Set when a `seedCycle` went out and this sequence could not learn whether
  // it landed. It also survives retries: the ambiguity does not clear by
  // asking again, and only `reset()` (a fresh open of the flow, after the
  // console has refetched the pool) lifts it.
  const seedUnconfirmedRef = useRef(false);

  const run = useCallback(
    async (steps: PoolSetupStep[]): Promise<PoolSetupOutcome> => {
      stepsRef.current = steps;
      if (cycleIdRef.current === null) cycleIdRef.current = knownCycleId(steps);
      const stepStates: PoolSetupStepState[] = steps.map((step) => ({
        action: step.action,
        status: "pending",
      }));
      const landed: PoolSetupAction[] = [];
      const context: PoolSetupRunContext = { cycleId: cycleIdRef.current };
      const publish = (patch: Partial<PoolSetupSequenceState>) =>
        setState((previous) => ({
          ...previous,
          steps: stepStates.map((step) => ({ ...step })),
          landed: [...landed],
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
          landed: [...landed],
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
          queryKey: queryKeys.commitmentPooling.all(chainId),
        });
        const poolIds = new Set(steps.map((step) => step.poolId.toString()));
        for (const poolId of poolIds) {
          await queryClient.invalidateQueries({
            queryKey: queryKeys.commitmentPooling.pool(chainId, poolId),
          });
        }
        if (context.cycleId !== null) {
          await queryClient.invalidateQueries({
            queryKey: queryKeys.commitmentPooling.cycle(chainId, context.cycleId),
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

      try {
        for (let index = 0; index < steps.length; index += 1) {
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
            stepState.status = "landed";
            landed.push(step.action);
            publish({});
            continue;
          }
          if (before.refused) {
            stepState.status = "failed";
            return fail(before.refused, step.action, null);
          }
          const call = stepToCall(step, context);
          if (!call) {
            stepState.status = "failed";
            return fail("cycle-id-unknown", step.action, null);
          }
          stepState.status = "sending";
          publish({});
          let hash: Hex;
          try {
            const result = await sender.sendContractCall({
              address: moduleAddress,
              abi: CommitmentPoolingModuleABI,
              functionName: call.action,
              args: commitmentPoolCallArgs(call),
              chainId,
            });
            hash = result.hash;
          } catch (error) {
            stepState.status = "failed";
            const parsed = parseContractError(error);
            handleError(error, {
              metadata: { action: step.action, chainId, parsedErrorName: parsed.name },
            });
            // A rejected send says nothing about the chain unless the wallet
            // reports the steward refusing it, which means nothing was signed.
            // Any other rejection may still have been mined, and a mined
            // `seedCycle` this run cannot name is a cycle a second seed would
            // orphan, so the run stops instead of offering to repeat it.
            if (step.action === "seedCycle" && parsed.name !== "UserRejected") {
              seedUnconfirmedRef.current = true;
              return fail("seed-unconfirmed", step.action, error);
            }
            return fail("send-failed", step.action, error);
          }
          if (step.action === "seedCycle") {
            // The seed is mined by now; only its receipt names the cycle. With
            // no id there is nothing to open and nothing safe to send again.
            let seededId: bigint | null;
            try {
              seededId = await reader.readSeededCycleId(hash, step.poolId);
            } catch (error) {
              seedUnconfirmedRef.current = true;
              stepState.status = "failed";
              return fail("seed-unconfirmed", step.action, error);
            }
            if (seededId === null) {
              seedUnconfirmedRef.current = true;
              stepState.status = "failed";
              return fail("seed-unconfirmed", step.action, null);
            }
            context.cycleId = seededId;
            cycleIdRef.current = seededId;
          }
          let after: PoolStepVerdict;
          try {
            after = await judgeStep(step, reader, context);
          } catch (error) {
            return readFailed(step, stepState, error);
          }
          if (!after.landed) {
            stepState.status = "failed";
            return fail("not-confirmed", step.action, null);
          }
          stepState.status = "landed";
          landed.push(step.action);
          publish({});
        }
      } finally {
        await invalidate();
      }
      const outcome: PoolSetupOutcome = {
        status: "complete",
        landed: [...landed],
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

  return { state, run, retry, reset };
}
