import {
  type Config,
  getBlock as wagmiGetBlock,
  getBytecode as wagmiGetBytecode,
  getTransaction as wagmiGetTransaction,
  getTransactionCount as wagmiGetTransactionCount,
  getTransactionReceipt as wagmiGetTransactionReceipt,
  readContract as wagmiReadContract,
  simulateContract as wagmiSimulateContract,
} from "@wagmi/core";
import { decodeEventLog, type Hex, keccak256, toBytes } from "viem";
import { getWagmiConfig } from "../../config/appkit";
import type { Address } from "../../types/domain";
import {
  CommitmentPoolingModuleABI,
  GardenAccountABI,
  getNetworkContracts,
} from "../../utils/blockchain/contracts";
import { GARDEN_ROLE_FUNCTIONS } from "../../utils/blockchain/garden-roles";
import { logger } from "../app/logger";
import type { CommitmentJobExecutionDependencies } from "../commitment-pooling/jobs";
import { createSendChainReads, type SendChainReads } from "./send-chain-reads";

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
  | "readSettlementAccountActive"
  | "hasMembership"
> &
  SendChainReads & {
    /** Verifies the claimant's current reward revision; an unread binding must block a send. */
    assertClaimRewardAgreed: (commitmentId: bigint, claimant: Address) => Promise<void>;
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
     * The block of this transaction when its receipt holds this take-up's own
     * event, its request or its acceptance, matched whole; null otherwise.
     */
    transactionMadeClaim?: (
      transactionHash: Hex,
      claim: {
        commitmentId: bigint;
        claimant: Address;
        requestedBy: Address;
        kind: number;
        gardenContext: Address;
      }
    ) => Promise<bigint | null>;
  };

const sameHex = (left: string, right: string) => left.toLowerCase() === right.toLowerCase();

/** The one settlement read a queued reward needs, so the queue doesn't load the module's ABI. */
const SETTLEMENT_ACCOUNT_ABI = [
  {
    type: "function",
    name: "settlementAccountOf",
    stateMutability: "view",
    inputs: [{ name: "garden", type: "address" }],
    outputs: [
      {
        type: "tuple",
        components: [
          { name: "chainId", type: "uint64" },
          { name: "account", type: "address" },
          { name: "active", type: "bool" },
          { name: "recoveryOwners", type: "address[3]" },
          { name: "rolesModifier", type: "address" },
          { name: "roleKey", type: "bytes32" },
          { name: "allowanceKey", type: "bytes32" },
          { name: "permissionsConfigHash", type: "bytes32" },
          { name: "recoveryConfigHash", type: "bytes32" },
          { name: "recoveryThreshold", type: "uint8" },
        ],
      },
    ],
  },
] as const;

export interface CommitmentChainReadOptions {
  chainId: number;
  moduleAddress: Address;
  readContract?: typeof wagmiReadContract;
  simulateContract?: typeof wagmiSimulateContract;
  getBlock?: typeof wagmiGetBlock;
  getBytecode?: typeof wagmiGetBytecode;
  getTransaction?: typeof wagmiGetTransaction;
  getTransactionCount?: typeof wagmiGetTransactionCount;
  getTransactionReceipt?: typeof wagmiGetTransactionReceipt;
  /** The bundler's status for a UserOperation; the default asks the chain's Pimlico bundler. */
  getUserOperationStatus?: (hash: Hex) => Promise<{ status: string }>;
  config?: Config;
}

export function createCommitmentChainReads({
  chainId,
  moduleAddress,
  readContract = wagmiReadContract,
  simulateContract = wagmiSimulateContract,
  getBlock = wagmiGetBlock,
  getBytecode = wagmiGetBytecode,
  getTransaction = wagmiGetTransaction,
  getTransactionCount = wagmiGetTransactionCount,
  getTransactionReceipt = wagmiGetTransactionReceipt,
  getUserOperationStatus,
  config,
}: CommitmentChainReadOptions): CommitmentChainReads {
  const wagmiConfig = config ?? getWagmiConfig();

  return {
    assertClaimRewardAgreed: async (commitmentId, claimant) => {
      // Claims reach this reader at execution time; keep it out of the queue's startup graph.
      const { assertEarnedRewardAgreed } = await import("../commitment-pooling/earned-agreement");
      await assertEarnedRewardAgreed(
        { chainId, core: moduleAddress, commitmentId, claimant },
        (request) =>
          readContract(wagmiConfig, { ...request, chainId } as Parameters<
            typeof wagmiReadContract
          >[1]),
        "broadcast"
      );
    },
    ...createSendChainReads({
      chainId,
      getBlock,
      getBytecode,
      getTransaction,
      getTransactionCount,
      getUserOperationStatus,
      config: wagmiConfig,
    }),
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
    readSettlementAccountActive: async (garden) => {
      try {
        const account = await readContract(wagmiConfig, {
          address: getNetworkContracts(chainId).settlementModule,
          abi: SETTLEMENT_ACCOUNT_ABI,
          functionName: "settlementAccountOf",
          args: [garden],
          chainId,
        });
        return account.active === true;
      } catch (error) {
        logger.warn("Settlement account read failed closed", {
          chainId,
          errorType: error instanceof Error ? error.name : "UnknownError",
        });
        return null;
      }
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
      return receipt.logs.some((log) => {
        if (!sameHex(log.address, moduleAddress)) return false;
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
            sameHex(args.workUID, link.workUID) &&
            sameHex(args.operationKey, link.operationKey) &&
            sameHex(args.linker, link.linker)
          );
        } catch {
          // Another event, or one this ABI cannot read: not this link.
          return false;
        }
      });
    },
    transactionMadeClaim: async (transactionHash, claim) => {
      const receipt = await getTransactionReceipt(wagmiConfig, { hash: transactionHash, chainId });
      if (receipt.status !== "success") return null;
      const madeIt = receipt.logs.some((log) => {
        if (!sameHex(log.address, moduleAddress)) return false;
        try {
          const event = decodeEventLog({
            abi: CommitmentPoolingModuleABI,
            data: log.data,
            topics: log.topics,
          });
          const args = event.args as unknown as {
            commitmentId: bigint;
            claimant: Address;
            requestedBy?: Address;
            kind: number;
            gardenContext: Address;
          };
          const sameClaim =
            args.commitmentId === claim.commitmentId &&
            sameHex(args.claimant, claim.claimant) &&
            Number(args.kind) === claim.kind &&
            sameHex(args.gardenContext, claim.gardenContext);
          if (event.eventName === "ClaimRequested")
            return sameClaim && sameHex(args.requestedBy ?? "", claim.requestedBy);
          return event.eventName === "CommitmentAccepted" && sameClaim;
        } catch {
          // Another event, or one this ABI cannot read: not this take-up.
          return false;
        }
      });
      return madeIt ? receipt.blockNumber : null;
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
