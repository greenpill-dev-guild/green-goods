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
  isCanonicalTransactionHash,
  readDistributionSnapshot,
  readExactDistributionAmounts,
} from "./harvestDistributionHelpers";

export type HarvestDistributionStage =
  | "idle"
  | "harvesting"
  | "checking"
  | "distributing"
  | "submitted"
  | "waiting"
  | "distribution_pending"
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
  | { status: "waiting"; availableAmount: bigint; threshold: bigint; harvested: boolean }
  | {
      status: "distribution_pending";
      harvested: boolean;
      errorCategory: string;
    }
  | {
      status: "distributed";
      hash: Hex;
      amounts: YieldDistributionAmounts | null;
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
    await Promise.all([
      ...invalidations.map((queryKey) => queryClient.invalidateQueries({ queryKey })),
      queryClient.invalidateQueries({ queryKey: ["readContract"] }),
      queryClient.invalidateQueries({ queryKey: ["readContracts"] }),
      queryClient.invalidateQueries({ queryKey: ["balance"] }),
    ]);
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
        if (snapshot.availableAmount < snapshot.threshold) {
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

        const amounts = await readExactDistributionAmounts(
          config,
          chainId,
          yieldSplitter,
          splitResult.hash,
          params.gardenAddress,
          params.assetAddress
        );
        trackHarvestDistributionOutcome({
          ...telemetry,
          outcome: "distributed",
          durationMs: Date.now() - startedAt,
        });
        return { status: "distributed", hash: splitResult.hash, amounts };
      } catch (error) {
        const errorCategory = categorizeError(error).category;
        trackHarvestDistributionOutcome({
          ...telemetry,
          outcome: "failed",
          durationMs: Date.now() - startedAt,
          errorCategory,
        });
        if (!harvested) throw error;
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
        case "distribution_pending":
          setStageIfMounted("distribution_pending");
          toastService.error({
            title: formatMessage({ id: "app.yield.harvestDistribution.pending" }),
          });
          break;
      }
    },
    onError: (error, params, context) => {
      if (context?.toastId) toastService.dismiss(context.toastId);
      setStageIfMounted("error");
      handleError(error, {
        metadata: {
          gardenAddress: params?.gardenAddress,
          assetAddress: params?.assetAddress,
        },
      });
    },
  });

  return { ...mutation, stage };
}
