import { readContract as wagmiReadContract, type Config } from "@wagmi/core";
import { keccak256, toBytes, type Hex } from "viem";
import { getWagmiConfig } from "../../config/appkit";
import type { CommitmentJobExecutionDependencies } from "../commitment-pooling/jobs";
import type { Address } from "../../types/domain";
import { CommitmentPoolingModuleABI, GardenAccountABI } from "../../utils/blockchain/contracts";
import { GARDEN_ROLE_FUNCTIONS } from "../../utils/blockchain/garden-roles";
import { logger } from "../app/logger";

export type CommitmentChainReads = Pick<
  CommitmentJobExecutionDependencies,
  | "readSeriesId"
  | "readSeries"
  | "readPoolGarden"
  | "readCommitmentId"
  | "readCommitment"
  | "readEvidenceAttached"
  | "readWorkLinkPayloadHash"
  | "hasMembership"
>;

export interface CommitmentChainReadOptions {
  chainId: number;
  moduleAddress: Address;
  readContract?: typeof wagmiReadContract;
  config?: Config;
}

export function createCommitmentChainReads({
  chainId,
  moduleAddress,
  readContract = wagmiReadContract,
  config,
}: CommitmentChainReadOptions): CommitmentChainReads {
  const wagmiConfig = config ?? getWagmiConfig();

  return {
    readSeriesId: async (holder, key) =>
      (await readContract(wagmiConfig, {
        address: moduleAddress,
        abi: CommitmentPoolingModuleABI,
        functionName: "getCommitmentSeriesIdByCreationRequest",
        args: [holder, key],
        chainId,
      })) as bigint,
    readSeries: async (seriesId) =>
      (await readContract(wagmiConfig, {
        address: moduleAddress,
        abi: CommitmentPoolingModuleABI,
        functionName: "getCommitmentSeries",
        args: [seriesId],
        chainId,
      })) as {
        poolId: bigint;
        createdBy: Address;
        metadataCID: string;
        creationPayloadHash: Hex;
      },
    readPoolGarden: async (poolId) => {
      const value = (await readContract(wagmiConfig, {
        address: moduleAddress,
        abi: CommitmentPoolingModuleABI,
        functionName: "getPool",
        args: [poolId],
        chainId,
      })) as { garden: Address };
      return value.garden;
    },
    readCommitmentId: async (creator, key) =>
      (await readContract(wagmiConfig, {
        address: moduleAddress,
        abi: CommitmentPoolingModuleABI,
        functionName: "getCommitmentIdByCreationRequest",
        args: [creator, key],
        chainId,
      })) as bigint,
    readCommitment: async (commitmentId) =>
      (await readContract(wagmiConfig, {
        address: moduleAddress,
        abi: CommitmentPoolingModuleABI,
        functionName: "getCommitment",
        args: [commitmentId],
        chainId,
      })) as { creationPayloadHash: Hex; poolId: bigint; creator: Address },
    readEvidenceAttached: async (commitmentId, cid) =>
      (await readContract(wagmiConfig, {
        address: moduleAddress,
        abi: CommitmentPoolingModuleABI,
        functionName: "isEvidenceAttached",
        args: [commitmentId, keccak256(toBytes(cid))],
        chainId,
      })) as boolean,
    readWorkLinkPayloadHash: async (caller, key) =>
      (await readContract(wagmiConfig, {
        address: moduleAddress,
        abi: CommitmentPoolingModuleABI,
        functionName: "getWorkLinkOperationPayloadHash",
        args: [caller, key],
        chainId,
      })) as Hex,
    hasMembership: async (garden, account) => {
      const results = await Promise.all(
        Object.values(GARDEN_ROLE_FUNCTIONS).map(async (functionName) => {
          try {
            return Boolean(
              await readContract(wagmiConfig, {
                address: garden,
                abi: GardenAccountABI,
                functionName,
                args: [account],
                chainId,
              })
            );
          } catch (error) {
            logger.warn("Garden membership probe failed closed", {
              chainId,
              functionName,
              errorType: error instanceof Error ? error.name : "UnknownError",
            });
            return false;
          }
        })
      );
      return results.some(Boolean);
    },
  };
}
