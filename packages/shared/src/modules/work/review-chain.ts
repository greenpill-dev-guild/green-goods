import { getTransactionReceipt, readContract } from "@wagmi/core";
import { type Hex, parseAbi, parseEventLogs } from "viem";
import { getWagmiConfig } from "../../config/appkit";
import { getEASConfig } from "../../config/blockchain";
import type { Address } from "../../types/domain";
import { EASABI } from "../../utils/blockchain/contracts";
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
  /** Why the chain would refuse this call from `account`, or null when it would go through. */
  refusal(call: ContractCall, account: Address): Promise<string | null>;
  /** Whether anyone has decided this work. EAS's index can be a moment behind, so it's a precheck. */
  isDecided(workUID: string): Promise<boolean>;
  attestationsIn(transactionHash: Hex): Promise<readonly ReviewAttestation[]>;
}

const ATTESTED = parseAbi([
  "event Attested(address indexed recipient, address indexed attester, bytes32 uid, bytes32 indexed schemaUID)",
]);

const same = (left: string, right: string) => left.toLowerCase() === right.toLowerCase();

export function createReviewChain(chainId: number): ReviewChain {
  const eas = getEASConfig(chainId);
  const easAddress = eas.EAS.address as Hex;
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
      // The raw revert, so whoever shows it can still name the contract's error.
      return success ? null : (error?.raw ?? "Transaction simulation failed");
    },
    isDecided: async (workUID) => (await getWorkApprovalsForWork(workUID, chainId)).length > 0,
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
 * Ceilings for one signature, on the chains they were sized for. Sized from Arbitrum receipts, not
 * a fork run: a decision used 1.25M to 1.34M gas with its resolver's Karma and commitment hooks, so
 * five come to about 6.7M, and a Green Goods passkey UserOperation adds about 730k. Past them a list
 * goes one review at a time. The first live batch on each rail confirms them before it is listed.
 */
const REVIEW_BUDGETS: Partial<Record<number, Record<BatchRail, BatchBudget>>> = {
  42161: {
    passkey: { ...ARBITRUM_CEILINGS, maxGas: "9000000", sponsorship: "required" },
    wallet: { ...ARBITRUM_CEILINGS, maxGas: "8000000", sponsorship: "wallet" },
  },
};

export function reviewBudget(rail: BatchRail, chainId: number): BatchBudget | null {
  return REVIEW_BUDGETS[chainId]?.[rail] ?? null;
}
