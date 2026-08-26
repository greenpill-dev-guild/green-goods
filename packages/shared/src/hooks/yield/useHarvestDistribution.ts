import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useIntl } from "react-intl";
import type { Hex } from "viem";
import { useConfig } from "wagmi";
import { toastService } from "../../components/toast";
import { queryInvalidation } from "../../config/query-keys/invalidation";
import {
  trackHarvestDistributionHarvest,
  trackHarvestDistributionOutcome,
  trackHarvestDistributionStarted,
} from "../../modules/app/harvestDistributionAnalytics";
import { logger } from "../../modules/app/logger";
import type { Address } from "../../types/domain";
import { OCTANT_MODULE_ABI } from "../../utils/blockchain/abis/octant";
import { YIELD_SPLITTER_ABI } from "../../utils/blockchain/abis/yield";
import { getNetworkContracts } from "../../utils/blockchain/contracts";
import { categorizeError } from "../../utils/errors/categorize-error";
import { createMutationErrorHandler } from "../../utils/errors/mutation-error-handler";
import { useCurrentChain } from "../blockchain/useChainConfig";
import { useTransactionSender } from "../blockchain/useTransactionSender";
import type { YieldDistributionAmounts } from "./useYieldStatus";
import {
  HARVEST_FAILURE_ERROR_CATEGORY,
  type HarvestReceiptFailure,
  isCanonicalTransactionHash,
  readDistributionOutcome,
  readDistributionSnapshot,
  readHarvestReceiptFailure,
  readWaitingBalance,
} from "./harvestDistributionHelpers";

export type HarvestDistributionStage =
  | "idle"
  | "harvesting"
  | "checking"
  | "distributing"
  | "submitted"
  | "waiting"
  | "harvest_incomplete"
  | "distribution_pending"
  | "split_unverified"
  | "complete"
  | "error";

export interface HarvestDistributionParams {
  gardenAddress: Address;
  assetAddress: Address;
  vaultAddress: Address;
  assetSymbol: string;
  harvestFirst: boolean;
  hadPendingYield: boolean;
  thresholdMetBefore: boolean;
}

export type HarvestDistributionResult =
  | { status: "harvest_submitted"; hash: Hex }
  | { status: "distribution_submitted"; hash: Hex }
  | { status: "harvest_incomplete"; hash: Hex; failure: HarvestReceiptFailure }
  | { status: "waiting"; availableAmount: bigint; threshold: bigint; harvested: boolean }
  | {
      status: "distribution_pending";
      harvested: boolean;
      errorCategory: string;
    }
  | {
      // The split transaction confirmed but its receipt could not be verified,
      // so the actual outcome (distributed vs accumulated) is unknown. Unlike
      // distribution_pending, the split must NOT be retried from this state.
      status: "split_unverified";
      hash: Hex;
      harvested: boolean;
    }
  | {
      status: "distributed";
      hash: Hex;
      amounts: YieldDistributionAmounts;
    };

export function useHarvestDistribution() {
  const { formatMessage } = useIntl();
  const queryClient = useQueryClient();
  const chainId = useCurrentChain();
  const config = useConfig();
  const sender = useTransactionSender();
  const network = getNetworkContracts(chainId);
  const octantModule = network.octantModule as Address;
  const yieldSplitter = network.yieldSplitter as Address;
  const [stage, setStage] = useState<HarvestDistributionStage>("idle");
  const isMountedRef = useRef(true);
  const handleError = createMutationErrorHandler({
    source: "useHarvestDistribution",
    toastContext: "harvest distribution",
    getFallbackTitle: () => formatMessage({ id: "app.yield.harvestDistribution.errorTitle" }),
    getFallbackMessage: () => formatMessage({ id: "app.yield.harvestDistribution.errorMessage" }),
  });

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const setStageIfMounted = (nextStage: HarvestDistributionStage) => {
    if (isMountedRef.current) setStage(nextStage);
  };

  const invalidateFinancialState = async (params: HarvestDistributionParams) => {
    const invalidations = queryInvalidation.onHarvestDistribution(
      params.gardenAddress,
      params.assetAddress,
      chainId
    );
    await Promise.all(
      [...invalidations, ...queryInvalidation.onchainReads()].map((queryKey) =>
        queryClient.invalidateQueries({ queryKey })
      )
    );
  };

  const mutation = useMutation({
    mutationFn: async (params: HarvestDistributionParams): Promise<HarvestDistributionResult> => {
      if (!sender) throw new Error("TransactionSender not available — auth not initialized");
      const startedAt = Date.now();
      const telemetry = {
        chainId,
        assetSymbol: params.assetSymbol,
        authMode: sender.authMode,
        startedWithHarvest: params.harvestFirst,
        hadPendingYield: params.hadPendingYield,
        thresholdMetBefore: params.thresholdMetBefore,
      };
      trackHarvestDistributionStarted(telemetry);
      let harvested = false;

      if (params.harvestFirst) {
        setStageIfMounted("harvesting");
        try {
          const harvestResult = await sender.sendContractCall({
            address: octantModule,
            abi: OCTANT_MODULE_ABI,
            functionName: "harvest",
            args: [params.gardenAddress, params.assetAddress],
            chainId,
          });
          if (!isCanonicalTransactionHash(harvestResult.hash)) {
            trackHarvestDistributionHarvest({
              ...telemetry,
              outcome: "submitted",
              durationMs: Date.now() - startedAt,
            });
            return { status: "harvest_submitted", hash: harvestResult.hash };
          }
          // Octant.harvest() swallows report/registration reverts into events,
          // so a confirmed receipt must be inspected before trusting the stage.
          const harvestFailure = await readHarvestReceiptFailure(
            config,
            chainId,
            octantModule,
            harvestResult.hash,
            params.gardenAddress,
            params.assetAddress
          );
          if (harvestFailure) {
            trackHarvestDistributionHarvest({
              ...telemetry,
              outcome: "failed",
              durationMs: Date.now() - startedAt,
              errorCategory: HARVEST_FAILURE_ERROR_CATEGORY[harvestFailure],
            });
            return {
              status: "harvest_incomplete",
              hash: harvestResult.hash,
              failure: harvestFailure,
            };
          }
          harvested = true;
          trackHarvestDistributionHarvest({
            ...telemetry,
            outcome: "confirmed",
            durationMs: Date.now() - startedAt,
          });
        } catch (error) {
          const errorCategory = categorizeError(error).category;
          trackHarvestDistributionHarvest({
            ...telemetry,
            outcome: "failed",
            durationMs: Date.now() - startedAt,
            errorCategory,
          });
          throw error;
        }
      }

      try {
        setStageIfMounted("checking");
        const snapshot = await readDistributionSnapshot(config, chainId, yieldSplitter, params);
        // Zero available must never reach splitYield() even under a zero
        // threshold — the resolver reverts with NoVaultShares.
        if (snapshot.availableAmount === 0n || snapshot.availableAmount < snapshot.threshold) {
          trackHarvestDistributionOutcome({
            ...telemetry,
            outcome: "waiting",
            durationMs: Date.now() - startedAt,
          });
          return {
            status: "waiting",
            availableAmount: snapshot.availableAmount,
            threshold: snapshot.threshold,
            harvested,
          };
        }

        setStageIfMounted("distributing");
        const splitResult = await sender.sendContractCall({
          address: yieldSplitter,
          abi: YIELD_SPLITTER_ABI,
          functionName: "splitYield",
          args: [params.gardenAddress, params.assetAddress, params.vaultAddress],
          chainId,
        });
        if (!isCanonicalTransactionHash(splitResult.hash)) {
          trackHarvestDistributionOutcome({
            ...telemetry,
            outcome: "submitted",
            durationMs: Date.now() - startedAt,
          });
          return { status: "distribution_submitted", hash: splitResult.hash };
        }

        // splitYield() succeeds without distributing when the redeemed yield
        // lands below the threshold, so the receipt decides the real outcome.
        const outcome = await readDistributionOutcome(
          config,
          chainId,
          yieldSplitter,
          splitResult.hash,
          params.gardenAddress,
          params.assetAddress
        );
        if (outcome.kind === "accumulated") {
          trackHarvestDistributionOutcome({
            ...telemetry,
            outcome: "waiting",
            durationMs: Date.now() - startedAt,
          });
          const fresh = await readWaitingBalance(config, chainId, yieldSplitter, params, {
            availableAmount: outcome.totalPending,
            threshold: snapshot.threshold,
          });
          return { status: "waiting", ...fresh, harvested };
        }
        if (outcome.kind === "reverted") {
          // Eventless readable receipt = the inner splitYield() never executed
          // (e.g. a reverted UserOperation); a real, retryable failure.
          throw new Error(
            "Distribution transaction confirmed but splitYield did not execute; the inner call reverted"
          );
        }
        if (outcome.kind === "unknown") {
          // The split confirmed on-chain; only the read back failed. Preserve
          // the confirmed submission instead of reporting a retryable failure.
          trackHarvestDistributionOutcome({
            ...telemetry,
            outcome: "unverified",
            durationMs: Date.now() - startedAt,
          });
          return { status: "split_unverified", hash: splitResult.hash, harvested };
        }
        trackHarvestDistributionOutcome({
          ...telemetry,
          outcome: "distributed",
          durationMs: Date.now() - startedAt,
        });
        return { status: "distributed", hash: splitResult.hash, amounts: outcome.amounts };
      } catch (error) {
        const errorCategory = categorizeError(error).category;
        trackHarvestDistributionOutcome({
          ...telemetry,
          outcome: "failed",
          durationMs: Date.now() - startedAt,
          errorCategory,
        });
        if (!harvested) throw error;
        logger.error("Distribution failed after a confirmed harvest", { error, errorCategory });
        return { status: "distribution_pending", harvested, errorCategory };
      }
    },
    onMutate: () => {
      const toastId = toastService.loading({
        title: formatMessage({ id: "app.yield.harvestDistribution.inProgress" }),
      });
      return { toastId };
    },
    onSuccess: async (result, params, context) => {
      if (context?.toastId) toastService.dismiss(context.toastId);
      await invalidateFinancialState(params);
      switch (result.status) {
        case "distributed":
          setStageIfMounted("complete");
          toastService.success({
            title: formatMessage({ id: "app.yield.harvestDistribution.success" }),
          });
          break;
        case "waiting":
          setStageIfMounted("waiting");
          toastService.info({
            title: formatMessage({ id: "app.yield.harvestDistribution.waiting" }),
          });
          break;
        case "harvest_submitted":
        case "distribution_submitted":
          setStageIfMounted("submitted");
          toastService.info({
            title: formatMessage({ id: "app.yield.harvestDistribution.submitted" }),
          });
          break;
        case "harvest_incomplete":
          setStageIfMounted("harvest_incomplete");
          toastService.error({
            title: formatMessage({ id: "app.yield.harvestDistribution.harvestIncomplete" }),
          });
          break;
        case "split_unverified":
          setStageIfMounted("split_unverified");
          toastService.info({
            title: formatMessage({ id: "app.yield.harvestDistribution.unverified" }),
          });
          break;
        case "distribution_pending":
          setStageIfMounted("distribution_pending");
          toastService.error({
            title: formatMessage({ id: "app.yield.harvestDistribution.pending" }),
          });
          break;
      }
    },
    onError: (error, _params, context) => {
      if (context?.toastId) toastService.dismiss(context.toastId);
      setStageIfMounted("error");
      // Workflow telemetry must stay address-free (spec requirement 6): pass
      // only non-identifying context to error tracking.
      handleError(error, { metadata: { chainId } });
    },
  });

  return { ...mutation, stage };
}
