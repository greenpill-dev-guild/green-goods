import {
  getBlock as wagmiGetBlock,
  getTransactionCount as wagmiGetTransactionCount,
  getTransactionReceipt as wagmiGetTransactionReceipt,
  readContract as wagmiReadContract,
  simulateContract as wagmiSimulateContract,
  type Config,
} from "@wagmi/core";
import { decodeEventLog, keccak256, toBytes, type Hex } from "viem";
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
  /**
   * Whether this transaction's receipt holds the module's WorkLinked event for
   * this link, made by this caller's operation key. The event carries the key,
   * so it names the one link, where a row's time or position may not.
   */
  transactionMadeWorkLink?: (
    transactionHash: Hex,
    link: { commitmentId: bigint; workUID: Hex; operationKey: Hex; linker: Address }
  ) => Promise<boolean>;
  /**
   * Whether the account has a transaction the network holds but has not mined:
   * its pending nonce is ahead of its mined one. A send whose answer was lost
   * after the network took it may be that transaction.
   */
  hasPendingTransaction?: (account: Address) => Promise<boolean>;
  /** The chain's time at its latest block, in seconds. */
  readChainTime?: () => Promise<number>;
};

export interface CommitmentChainReadOptions {
  chainId: number;
  moduleAddress: Address;
  readContract?: typeof wagmiReadContract;
  simulateContract?: typeof wagmiSimulateContract;
  getBlock?: typeof wagmiGetBlock;
  getTransactionCount?: typeof wagmiGetTransactionCount;
  getTransactionReceipt?: typeof wagmiGetTransactionReceipt;
  config?: Config;
}

export function createCommitmentChainReads({
  chainId,
  moduleAddress,
  readContract = wagmiReadContract,
  simulateContract = wagmiSimulateContract,
  getBlock = wagmiGetBlock,
  getTransactionCount = wagmiGetTransactionCount,
  getTransactionReceipt = wagmiGetTransactionReceipt,
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
    transactionMadeWorkLink: async (transactionHash, link) => {
      const receipt = await getTransactionReceipt(wagmiConfig, { hash: transactionHash, chainId });
      if (receipt.status !== "success") return false;
      const same = (left: string, right: string) => left.toLowerCase() === right.toLowerCase();
      return receipt.logs.some((log) => {
        if (!same(log.address, moduleAddress)) return false;
        try {
          const event = decodeEventLog({
            abi: CommitmentPoolingModuleABI,
            data: log.data,
            topics: log.topics,
          });
          if (event.eventName !== "WorkLinked") return false;
          const args = event.args as unknown as {
            commitmentId: bigint;
            workUID: Hex;
            operationKey: Hex;
            linker: Address;
          };
          return (
            args.commitmentId === link.commitmentId &&
            same(args.workUID, link.workUID) &&
            same(args.operationKey, link.operationKey) &&
            same(args.linker, link.linker)
          );
        } catch {
          // Another event, or one this ABI cannot read: not this link.
          return false;
        }
      });
    },
    readChainTime: async () => Number((await getBlock(wagmiConfig, { chainId })).timestamp),
    hasPendingTransaction: async (account) => {
      const [pending, mined] = await Promise.all([
        getTransactionCount(wagmiConfig, { address: account, blockTag: "pending", chainId }),
        getTransactionCount(wagmiConfig, { address: account, blockTag: "latest", chainId }),
      ]);
      return pending > mined;
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
