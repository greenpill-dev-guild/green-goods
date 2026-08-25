/**
 * Pool chain reads
 *
 * The default `PoolChainReader`: the module's `getPool` and `getCycle`, the
 * register's `providerOpenCommitmentCapOf`, and the `CycleSeeded` log of a
 * seeding receipt. The setup sequence judges what landed from these, because
 * the indexer trails the fork by a few blocks and a steward waiting on a
 * retry needs the chain's answer, not the index's.
 *
 * @module modules/commitment-pooling/pool-chain-reads
 */

import { getTransactionReceipt, readContract } from "@wagmi/core";
import { type Hex, parseEventLogs } from "viem";

import { getWagmiConfig } from "../../config/appkit";
import {
  CommitmentPoolingModuleABI,
  CommitmentRegistryABI,
  getNetworkContracts,
} from "../../utils/blockchain/contracts";
import type { CommitmentAllocationBps, CommitmentRecognitionPolicyBps } from "./pool-lifecycle";
import type { PoolChainReader } from "./pool-setup";

type RawStruct = Record<string, unknown>;

function asRecord(value: unknown): RawStruct {
  return value && typeof value === "object" ? (value as RawStruct) : {};
}

function bps(value: unknown): number {
  return Number((value as bigint | number | undefined) ?? 0);
}

/** The `AllocationBps` snapshot `openCycle` stored; all zeroes before it. */
function allocationOf(value: unknown): CommitmentAllocationBps {
  const raw = asRecord(value);
  return {
    gardeners: bps(raw.gardeners),
    treasury: bps(raw.treasury),
    steward: bps(raw.steward),
    evaluator: bps(raw.evaluator),
    community: bps(raw.community),
    funder: bps(raw.funder),
  };
}

/** The `RecognitionPolicy` snapshot beside it, read the same way. */
function recognitionPolicyOf(value: unknown): CommitmentRecognitionPolicyBps {
  const raw = asRecord(value);
  return {
    equalParticipationBps: bps(raw.equalParticipationBps),
    verifiedContributionBps: bps(raw.verifiedContributionBps),
  };
}

export function createPoolChainReader(chainId: number): PoolChainReader {
  const { commitmentPoolingModule, commitmentRegistry } = getNetworkContracts(chainId);
  return {
    async readPool(poolId) {
      const pool = asRecord(
        await readContract(getWagmiConfig(), {
          address: commitmentPoolingModule,
          abi: CommitmentPoolingModuleABI,
          functionName: "getPool",
          args: [poolId],
          chainId,
        })
      );
      return {
        state: Number(pool.state ?? 0),
        charterCID: String(pool.charterCID ?? ""),
        openSeasonCycleId: BigInt((pool.openSeasonCycleId as bigint | number | undefined) ?? 0),
        nonTerminalCycleCount: Number(pool.nonTerminalCycleCount ?? 0),
      };
    },
    async readProviderCap(poolId) {
      const cap = await readContract(getWagmiConfig(), {
        address: commitmentRegistry,
        abi: CommitmentRegistryABI,
        functionName: "providerOpenCommitmentCapOf",
        args: [poolId],
        chainId,
      });
      return BigInt((cap as bigint | number | undefined) ?? 0);
    },
    async readCycle(cycleId) {
      const cycle = asRecord(
        await readContract(getWagmiConfig(), {
          address: commitmentPoolingModule,
          abi: CommitmentPoolingModuleABI,
          functionName: "getCycle",
          args: [cycleId],
          chainId,
        })
      );
      return {
        state: Number(cycle.state ?? 0),
        poolId: BigInt((cycle.poolId as bigint | number | undefined) ?? 0),
        allocation: allocationOf(cycle.allocation),
        recognitionPolicy: recognitionPolicyOf(cycle.recognitionPolicy),
      };
    },
    async readSeededCycleId(hash: Hex, poolId) {
      const receipt = await getTransactionReceipt(getWagmiConfig(), { hash, chainId });
      const seeded = parseEventLogs({
        abi: CommitmentPoolingModuleABI,
        logs: receipt.logs,
        eventName: "CycleSeeded",
      });
      for (const log of seeded) {
        const args = asRecord((log as { args?: unknown }).args);
        if (
          log.address.toLowerCase() === commitmentPoolingModule.toLowerCase() &&
          BigInt((args.poolId as bigint | number | undefined) ?? 0) === poolId
        ) {
          return BigInt((args.cycleId as bigint | number | undefined) ?? 0);
        }
      }
      return null;
    },
  };
}
