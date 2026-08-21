import { useQuery } from "@tanstack/react-query";

import { DEFAULT_CHAIN_ID } from "../../config/blockchain";
import { queryKeys } from "../../config/query-keys";
import { STALE_TIME_RARE } from "../../config/query-keys/constants";
import {
  getPublicGardenPool,
  type PublicCommitmentCycleRecord,
  type PublicCommitmentPoolRecord,
} from "../../modules/commitment-pooling/data-public-pools";
import { logger } from "../../modules/app/logger";
import type { CommitmentUnitSummaryRecord } from "../../modules/commitment-pooling/types";
import type { Address } from "../../types/domain";

export interface PublicGardenPoolUnavailableSources {
  commitmentPool: boolean;
}

export interface PublicGardenPoolData {
  pool: PublicCommitmentPoolRecord | null;
  openSeason: PublicCommitmentCycleRecord | null;
  openCampaigns: PublicCommitmentCycleRecord[];
  finishedCycles: PublicCommitmentCycleRecord[];
  poolUnitSummaries: CommitmentUnitSummaryRecord[];
  cycleUnitSummaries: CommitmentUnitSummaryRecord[];
  partialData: boolean;
  unavailableSources: PublicGardenPoolUnavailableSources;
}

export interface UsePublicGardenPoolOptions {
  chainId?: number;
}

function emptyPublicGardenPool(unavailable: boolean): PublicGardenPoolData {
  return {
    pool: null,
    openSeason: null,
    openCampaigns: [],
    finishedCycles: [],
    poolUnitSummaries: [],
    cycleUnitSummaries: [],
    partialData: unavailable,
    unavailableSources: { commitmentPool: unavailable },
  };
}

export function usePublicGardenPool(
  gardenAddress: Address | undefined,
  options: UsePublicGardenPoolOptions = {}
) {
  const chainId = options.chainId ?? DEFAULT_CHAIN_ID;
  const lookup = gardenAddress?.toLowerCase();

  return useQuery({
    queryKey: queryKeys.public.gardenDetail(`commitment-pool:${lookup ?? "none"}`, chainId),
    enabled: lookup !== undefined,
    queryFn: async (): Promise<PublicGardenPoolData> => {
      if (!gardenAddress) return emptyPublicGardenPool(false);
      try {
        const record = await getPublicGardenPool(chainId, gardenAddress);
        if (!record) return emptyPublicGardenPool(false);
        return {
          ...record,
          partialData: false,
          unavailableSources: { commitmentPool: false },
        };
      } catch (error) {
        logger.warn("[usePublicGardenPool] Envio read failed", {
          error,
          garden: gardenAddress,
        });
        return emptyPublicGardenPool(true);
      }
    },
    staleTime: STALE_TIME_RARE,
  });
}
