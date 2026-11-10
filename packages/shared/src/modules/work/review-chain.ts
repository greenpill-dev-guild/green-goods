import { getTransactionReceipt, readContract } from "@wagmi/core";
import { type Hex, parseAbi, parseEventLogs, zeroAddress } from "viem";
import { getWagmiConfig } from "../../config/appkit";
import { getEASConfig } from "../../config/blockchain";
import type { Address } from "../../types/domain";
import { EASABI, getNetworkContracts } from "../../utils/blockchain/contracts";
import { simulateTransaction } from "../../utils/blockchain/simulation";
import { getWorkApprovalsForWork } from "../data/eas";
import type { BatchRail } from "../transactions/batch-enablement";
import type { BatchBudget } from "../transactions/batch-types";
import type { ContractCall } from "../transactions/types";

/** A decision attestation a transaction made. */
export interface ReviewAttestation {
  uid: Hex;
  attester: Address;
  recipient: Address;
  data: Hex;
}

/** How a send of reviews reads the chain. */
export interface ReviewChain {
  /**
   * Why the chain would refuse this call from `account`, or null when it would go through. Throws
   * when it cannot tell, and nothing is signed on it.
   */
  refusal(call: ContractCall, account: Address): Promise<string | null>;
  /**
   * Whether anyone has decided this work. The resolver counts a decision the moment it lands;
   * EAS's index runs minutes behind, so it answers only for a work the count can't speak for.
   */
  isDecided(workUID: string): Promise<boolean>;
  attestationsIn(transactionHash: Hex): Promise<readonly ReviewAttestation[]>;
}

const ATTESTED = parseAbi([
  "event Attested(address indexed recipient, address indexed attester, bytes32 uid, bytes32 indexed schemaUID)",
]);

const DECISION_COUNT = parseAbi([
  "function latestDecisionSequence(bytes32 workUID) view returns (uint64)",
  "function commitmentModule() view returns (address)",
]);

/**
 * When the work approval resolver began counting decisions, by chain: the block time of the call
 * that first set its commitment module. It counts only while a module is set, so every decision
 * since has a count and none before has. Unsetting the module and setting it again would leave
 * uncounted decisions in between: this time then moves to the later call.
 */
const DECISIONS_COUNTED_SINCE: Partial<Record<number, bigint>> = {
  42161: 1_786_591_367n, // 2026-08-13 03:22:47 UTC, block 493978911
};

const same = (left: string, right: string) => left.toLowerCase() === right.toLowerCase();

export function createReviewChain(chainId: number): ReviewChain {
  const eas = getEASConfig(chainId);
  const easAddress = eas.EAS.address as Hex;
  const countedSince = DECISIONS_COUNTED_SINCE[chainId];
  return {
    refusal: async ({ address, functionName, args }, account) => {
      const { success, error } = await simulateTransaction(
        address,
        EASABI,
        functionName,
        [...(args ?? [])],
        account,
        chainId
      );
      if (success) return null;
      // Only a revert is the chain refusing. Any other failure, such as an RPC's error page, says
      // nothing about the call: the check fails, and nothing is signed on it.
      if (!error?.reverted) throw new Error(error?.message ?? "Transaction simulation failed");
      // The raw revert, so whoever shows it can still name the contract's error.
      return error.raw;
    },
    isDecided: async (workUID) => {
      if (countedSince !== undefined) {
        const config = getWagmiConfig();
        const resolver = getNetworkContracts(chainId).workApprovalResolver;
        const uid = workUID as Hex;
        const [count, module, work] = await Promise.all([
          readContract(config, {
            address: resolver,
            abi: DECISION_COUNT,
            functionName: "latestDecisionSequence",
            args: [uid],
            chainId,
          }),
          readContract(config, {
            address: resolver,
            abi: DECISION_COUNT,
            functionName: "commitmentModule",
            chainId,
          }),
          readContract(config, {
            address: easAddress,
            abi: EASABI,
            functionName: "getAttestation",
            args: [uid],
            chainId,
          }) as Promise<{ time: bigint }>,
        ]);
        if (count > 0n) return true;
        // With a module set, every decision on a work made since counting began is counted.
        if (!same(module, zeroAddress) && work.time > countedSince) return false;
      }
      // An uncounted decision is in EAS's index alone: one from before counting began, or any while
      // no module is set.
      return (await getWorkApprovalsForWork(workUID, chainId)).length > 0;
    },
    attestationsIn: async (hash) => {
      const config = getWagmiConfig();
      const { logs } = await getTransactionReceipt(config, { hash, chainId });
      // The resolver makes its own attestations in the same transaction, under other schemas.
      const events = parseEventLogs({ abi: ATTESTED, logs: [...logs] }).filter(
        (log) => same(log.address, easAddress) && same(log.args.schemaUID, eas.WORK_APPROVAL.uid)
      );
      return Promise.all(
        events.map(async ({ args: { uid, attester, recipient } }) => {
          const { data } = (await readContract(config, {
            address: easAddress,
            abi: EASABI,
            functionName: "getAttestation",
            args: [uid],
            chainId,
          })) as { data: Hex };
          return { uid, attester, recipient, data };
        })
      );
    },
  };
}

/** The most decisions one signature carries. Past it, the list takes another signature. */
export const MAX_REVIEWS_PER_SIGNATURE = 5;

export const signaturesForReviews = (count: number) => Math.ceil(count / MAX_REVIEWS_PER_SIGNATURE);

const ARBITRUM_CEILINGS = {
  maxCalls: 1,
  maxCalldataBytes: 8_192,
  maxFeePerGas: "1000000000",
  maxFee: "2000000000000000",
};

/**
 * Ceilings for one signature, on the chains they were sized for, checked against the gas each rail
 * asks for. On a fork of Arbitrum on 10 November 2026, five decisions in one `multiAttest` used
 * 9.7M gas with the live Karma module, whose Project Update grows by about 2,900 gas for each
 * character of a work's description. A wallet asks for the node's estimate plus
 * `APPROVAL_GAS_HEADROOM_PERCENT`, about 15M for those five, under 20M. A passkey asks for the
 * bundler's call gas plus the same, and a Green Goods passkey UserOperation adds about 730k: 15.7M
 * at open-source Alto's estimate, 17.2M with the margin Pimlico's hosted bundler added. Alto's
 * default limit for one operation is 16M and the hosted bundler's is unconfirmed, so a passkey
 * group stops at 16M. One past it is turned away before the prompt, rather than by the bundler
 * after the signature. Past its ceiling a list goes one review at a time. The first live batch on
 * each rail confirms them before it is listed.
 */
const REVIEW_BUDGETS: Partial<Record<number, Record<BatchRail, BatchBudget>>> = {
  42161: {
    passkey: { ...ARBITRUM_CEILINGS, maxGas: "16000000", sponsorship: "required" },
    wallet: { ...ARBITRUM_CEILINGS, maxGas: "20000000", sponsorship: "wallet" },
  },
};

export function reviewBudget(rail: BatchRail, chainId: number): BatchBudget | null {
  return REVIEW_BUDGETS[chainId]?.[rail] ?? null;
}
