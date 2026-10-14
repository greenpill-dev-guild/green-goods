/**
 * Settlement chain reads
 *
 * The settlement module's own answer for one commitment, read straight from
 * the chain: the parent pointer `payoutPlanOfCommitment`, the plan behind it,
 * the frozen contributor rows, every child disbursement with its
 * acknowledgement flag, the delivery gate, the pause flag and the two
 * settlement accounts a plan touches. The admin resumes a payout from these
 * rather than from the index, which trails the fork by a few blocks and
 * cannot be allowed to offer "create plan" twice.
 *
 * @module modules/commitment-pooling/data-settlement-chain
 */

import { readContract } from "@wagmi/core";

import { getWagmiConfig } from "../../config/appkit";
import type { Address } from "../../types/domain";
import {
  CommitmentPoolingModuleABI,
  getNetworkContracts,
  SettlementModuleABI,
} from "../../utils/blockchain/contracts";
import {
  addressOrNull,
  asRecord,
  big,
  type CommitmentSettlementChainState,
  DISBURSEMENT_STATES,
  mapAccount,
  mapCommitment,
  mapDisbursement,
  mapPlan,
  mapRow,
  ordinal,
} from "./data-settlement-chain-mappers";
import { hashRecognitionSnapshot, type RecognitionEntryInput } from "./settlement";
import type {
  SettlementChainDisbursement,
  SettlementChainPlan,
  SettlementChainRow,
  SettlementPayoutKind,
} from "./settlement-workflow";

export type {
  CommitmentSettlementChainState,
  SettlementChainAccount,
  SettlementChainCommitment,
} from "./data-settlement-chain-mappers";
export { addressOrNull } from "./data-settlement-chain-mappers";

export interface ReadCommitmentSettlementChainStateInput {
  chainId: number;
  commitmentId: bigint;
  /**
   * The active roster with its indexed recognition weights. Supplied only
   * while no plan exists so the read can ask the module whether that exact
   * vector is the canonical one before "create plan" is ever offered.
   */
  recognitionEntries?: readonly RecognitionEntryInput[];
}

export async function readSettlementFunction(input: {
  chainId: number;
  address: Address;
  abi: typeof SettlementModuleABI;
  functionName: string;
  args?: readonly unknown[];
}): Promise<unknown> {
  return readContract(getWagmiConfig(), {
    address: input.address,
    abi: input.abi,
    functionName: input.functionName,
    args: input.args ?? [],
    chainId: input.chainId,
  });
}

/**
 * Read everything the settlement workflow needs for one commitment. Every
 * independent read runs in parallel; the plan's children are read only once
 * the parent pointer says a plan exists.
 */
export async function readCommitmentSettlementChainState(
  input: ReadCommitmentSettlementChainStateInput
): Promise<CommitmentSettlementChainState> {
  const { chainId, commitmentId } = input;
  const contracts = getNetworkContracts(chainId);
  const settlement = contracts.settlementModule;
  const pooling = contracts.commitmentPoolingModule;
  const settle = (functionName: string, args?: readonly unknown[]) =>
    readSettlementFunction({
      chainId,
      address: settlement,
      abi: SettlementModuleABI,
      functionName,
      args,
    });
  const pool = (functionName: string, args?: readonly unknown[]) =>
    readSettlementFunction({
      chainId,
      address: pooling,
      abi: CommitmentPoolingModuleABI,
      functionName,
      args,
    });

  const [rawCommitment, rawPlanId, rawDelivery, rawPaused] = await Promise.all([
    pool("getCommitment", [commitmentId]),
    settle("payoutPlanOfCommitment", [commitmentId]),
    settle("gardenerDeliveryEnabled"),
    settle("paused"),
  ]);
  const commitment = mapCommitment(rawCommitment);
  const kind: SettlementPayoutKind =
    commitment.direction === "REQUEST" && commitment.counterpartyKind === "GARDEN"
      ? "GARDEN_BENEFICIARY"
      : "CONTRIBUTOR_CONSIDERATION";
  const payoutPlanId = big(rawPlanId);

  const payerAccountPromise = commitment.payerGarden
    ? settle("settlementAccountOf", [commitment.payerGarden]).then(mapAccount)
    : Promise.resolve(null);

  let plan: SettlementChainPlan | null = null;
  let rows: SettlementChainRow[] = [];
  let disbursements: SettlementChainDisbursement[] = [];
  let beneficiaryGarden = kind === "GARDEN_BENEFICIARY" ? commitment.providerGarden : null;

  if (payoutPlanId !== 0n) {
    const [rawPlan, rawStatus, rawContributors] = await Promise.all([
      settle("getPayoutPlan", [payoutPlanId]),
      settle("payoutPlanStatus", [payoutPlanId]),
      settle("payoutContributors", [payoutPlanId]),
    ]);
    plan = mapPlan(payoutPlanId, rawPlan, rawStatus);
    if (plan.beneficiaryGarden) beneficiaryGarden = plan.beneficiaryGarden;
    const contributors = (Array.isArray(rawContributors) ? rawContributors : [])
      .map(addressOrNull)
      .filter((value): value is Address => value !== null);
    rows = await Promise.all(
      contributors.map(async (contributor) =>
        mapRow(contributor, await settle("contributorPayoutOf", [payoutPlanId, contributor]))
      )
    );
    const childIds = [
      ...(plan.beneficiaryDisbursementId ? [plan.beneficiaryDisbursementId] : []),
      ...rows.flatMap((row) => (row.disbursementId ? [row.disbursementId] : [])),
    ];
    disbursements = await Promise.all(
      childIds.map(async (disbursementId) => {
        const raw = await settle("getDisbursement", [disbursementId]);
        const state = ordinal(DISBURSEMENT_STATES, asRecord(raw).state, "UNKNOWN");
        const acknowledgmentPending =
          state === "DISPATCHED"
            ? (await settle("isAcknowledgmentPending", [false, disbursementId])) === true
            : false;
        return mapDisbursement(disbursementId, raw, acknowledgmentPending);
      })
    );
  }

  const [payerAccount, beneficiaryAccount] = await Promise.all([
    payerAccountPromise,
    beneficiaryGarden
      ? settle("settlementAccountOf", [beneficiaryGarden]).then(mapAccount)
      : Promise.resolve(null),
  ]);

  let recognitionReady: boolean | null = null;
  const entries = input.recognitionEntries ?? [];
  if (payoutPlanId === 0n && kind === "CONTRIBUTOR_CONSIDERATION" && entries.length > 0) {
    try {
      await pool("validateRecognitionSnapshot", [
        commitmentId,
        entries.map((entry) => ({
          contributor: entry.contributor,
          recognitionWeightBps: entry.recognitionWeightBps,
        })),
        hashRecognitionSnapshot({ chainId, commitmentId, entries }),
      ]);
      recognitionReady = true;
    } catch {
      // The module names the mismatch (`InvalidAllocation`, `NoEligibleContributors`);
      // the workflow reports it as a blocker instead of sending a call that reverts.
      recognitionReady = false;
    }
  }

  return {
    commitment,
    kind,
    payoutPlanId: payoutPlanId === 0n ? null : payoutPlanId,
    plan,
    rows,
    disbursements,
    gardenerDeliveryEnabled: rawDelivery === true,
    sourcePaused: rawPaused === true,
    payerAccount,
    beneficiaryAccount,
    recognitionReady,
    readAt: Math.floor(Date.now() / 1000),
  };
}
