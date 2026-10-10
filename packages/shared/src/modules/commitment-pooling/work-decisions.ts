import { readContract as wagmiReadContract, type Config } from "@wagmi/core";
import { isHex, type Hex } from "viem";

import { getWagmiConfig } from "../../config/appkit";
import type { EASWorkApproval } from "../../types/eas-responses";
import { getWorkApprovalsForWork } from "../data/eas";
import { MAX_LINKED_WORKS_PER_COMMITMENT } from "./acts";
import type { CommitmentWorkAttributionRecord } from "./types-relations";
import { getNetworkContracts } from "../../utils/blockchain/contracts";

export type WorkLinkDecisionState =
  | "awaitingApproval"
  | "readyToReconcile"
  | "needsFreshReview"
  | "counted"
  | "unavailable";

export interface CommitmentWorkDecision {
  workUID: Hex;
  attribution: CommitmentWorkAttributionRecord;
  state: WorkLinkDecisionState;
  currentDecisionUID: Hex | null;
  currentDecisionSequence: bigint | null;
}

const WorkDecisionSequenceResolverABI = [
  {
    type: "function",
    name: "latestDecisionSequence",
    stateMutability: "view",
    inputs: [{ name: "workUID", type: "bytes32" }],
    outputs: [{ name: "", type: "uint64" }],
  },
  {
    type: "function",
    name: "decisionSequenceByUID",
    stateMutability: "view",
    inputs: [{ name: "decisionUID", type: "bytes32" }],
    outputs: [{ name: "", type: "uint64" }],
  },
] as const;

export interface CommitmentWorkDecisionDependencies {
  getApprovals(workUID: Hex, chainId: number): Promise<EASWorkApproval[]>;
  readLatestSequence(workUID: Hex): Promise<bigint>;
  readDecisionSequence(decisionUID: Hex): Promise<bigint>;
}

function unavailable(attribution: CommitmentWorkAttributionRecord): CommitmentWorkDecision {
  return {
    workUID: attribution.workUID as Hex,
    attribution,
    state: "unavailable",
    currentDecisionUID: null,
    currentDecisionSequence: null,
  };
}

/**
 * Classifies linked Work using the resolver's execution order, never EAS time.
 * The EAS query is garden-bounded and this selector exact-matches every UID;
 * a missing current decision is unavailable (possible index lag), not approval.
 */
export async function selectCommitmentWorkDecisions(input: {
  chainId: number;
  garden: string;
  attributions: readonly CommitmentWorkAttributionRecord[];
  dependencies?: Partial<CommitmentWorkDecisionDependencies>;
}): Promise<CommitmentWorkDecision[]> {
  const linked = input.attributions.filter((row) => row.linked);
  if (linked.length === 0) return [];

  if (linked.length > MAX_LINKED_WORKS_PER_COMMITMENT) return linked.map(unavailable);

  const resolver = getNetworkContracts(input.chainId).workApprovalResolver;
  const defaultRead = async (
    functionName: "latestDecisionSequence" | "decisionSequenceByUID",
    uid: Hex
  ) => {
    const config = getWagmiConfig();
    return (await wagmiReadContract(config as Config, {
      address: resolver,
      abi: WorkDecisionSequenceResolverABI,
      functionName,
      args: [uid],
      chainId: input.chainId,
    })) as bigint;
  };
  const readLatestSequence =
    input.dependencies?.readLatestSequence ??
    ((workUID: Hex) => defaultRead("latestDecisionSequence", workUID));
  const readDecisionSequence =
    input.dependencies?.readDecisionSequence ??
    ((decisionUID: Hex) => defaultRead("decisionSequenceByUID", decisionUID));

  return Promise.all(
    linked.map(async (attribution): Promise<CommitmentWorkDecision> => {
      try {
        const workUID = attribution.workUID.toLowerCase() as Hex;
        if (!isHex(workUID, { strict: true }) || workUID.length !== 66)
          return unavailable(attribution);
        const approvals = await (input.dependencies?.getApprovals ?? getWorkApprovalsForWork)(
          workUID,
          input.chainId
        );
        const exact = approvals.filter(
          (approval) => approval.workUID.toLowerCase() === workUID && isHex(approval.id)
        );
        const latest = await readLatestSequence(workUID);
        const sequenced = await Promise.all(
          exact.map(async (approval) => ({
            approval,
            sequence: await readDecisionSequence(approval.id as Hex),
          }))
        );
        const current = sequenced.filter(({ sequence }) => sequence === latest);

        if (latest === 0n) {
          return {
            workUID,
            attribution,
            state: sequenced.length > 0 ? "needsFreshReview" : "awaitingApproval",
            currentDecisionUID: null,
            currentDecisionSequence: 0n,
          };
        }
        if (current.length !== 1) return unavailable(attribution);
        const decision = current[0];
        if (decision.approval.gardenerAddress.toLowerCase() !== input.garden.toLowerCase()) {
          return {
            workUID,
            attribution,
            state: "needsFreshReview",
            currentDecisionUID: null,
            currentDecisionSequence: null,
          };
        }
        const state: WorkLinkDecisionState = !decision.approval.approved
          ? "needsFreshReview"
          : attribution.creditActive
            ? "counted"
            : "readyToReconcile";
        return {
          workUID,
          attribution,
          state,
          currentDecisionUID: decision.approval.id as Hex,
          currentDecisionSequence: decision.sequence,
        };
      } catch {
        return unavailable(attribution);
      }
    })
  );
}
