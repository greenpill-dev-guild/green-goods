import {
  readContract as wagmiReadContract,
  simulateContract as wagmiSimulateContract,
  type Config,
} from "@wagmi/core";
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
  | "readWorkLinkCommitmentState"
  | "hasMembership"
> & {
  /**
   * Runs an act's call without sending it. A wallet estimates inside its own
   * send, after the queue records the intent, so a refusal found there would
   * read as a send that may have gone out; asking first keeps it a refusal.
   */
  simulateSend?: (call: {
    address: Address;
    functionName: string;
    args: readonly unknown[];
    account: Address;
    chainId: number;
  }) => Promise<void>;
};

export interface CommitmentChainReadOptions {
  chainId: number;
  moduleAddress: Address;
  readContract?: typeof wagmiReadContract;
  simulateContract?: typeof wagmiSimulateContract;
  config?: Config;
}

export function createCommitmentChainReads({
  chainId,
  moduleAddress,
  readContract = wagmiReadContract,
  simulateContract = wagmiSimulateContract,
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
    readWorkLinkCommitmentState: async (commitmentId) => {
      const value = (await readContract(wagmiConfig, {
        address: moduleAddress,
        abi: CommitmentPoolingModuleABI,
        functionName: "getCommitment",
        args: [commitmentId],
        chainId,
      })) as { state: number; contributorsFrozen: boolean };
      return { state: value.state, contributorsFrozen: value.contributorsFrozen };
    },
    simulateSend: async (call) => {
      await simulateContract(wagmiConfig, {
        address: call.address,
        abi: CommitmentPoolingModuleABI,
        functionName: call.functionName,
        args: call.args,
        account: call.account,
        chainId: call.chainId,
      } as Parameters<typeof wagmiSimulateContract>[1]);
    },
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
            return null;
          }
        })
      );
      if (results.some((result) => result === true)) return true;
      return results.some((result) => result === null) ? null : false;
    },
  };
}
