import {
  type CommitmentCycleRecord,
  campaignSteps,
  firstRunSetupSteps,
  isPoolDocumentPinError,
  newSeasonSteps,
  openSeasonSteps,
  type PoolConsoleController,
  type PoolSetupStep,
  pinCycleMetadata,
  pinPoolCharter,
} from "@green-goods/shared";
import {
  type AllocationPercent,
  type RecognitionPercent,
  toAllocationBps,
  toRecognitionBps,
} from "./AllocationEditor";
import type { PoolSetupIntent } from "./setupFlowModel";

export interface PlanSetupStepsInput {
  intent: PoolSetupIntent;
  isCampaign: boolean;
  poolId: PoolConsoleController["poolId"];
  garden: PoolConsoleController["garden"];
  cycle?: CommitmentCycleRecord | null;
  allocation: AllocationPercent;
  recognition: RecognitionPercent;
  start: bigint | null;
  end: bigint | null;
  name: string;
  purpose: string;
  capValue: bigint | null;
  /** Names the document whose pin failed, so the step can keep the words on screen. */
  onPinFailure: (which: "charter" | "cycle" | null) => void;
}

/**
 * The ordered writes this intent needs, with the charter and the cycle name
 * pinned first. Nothing is sent here: a pin failure throws before the chain
 * starts, after naming which document could not be stored.
 */
export async function planSetupSteps({
  intent,
  isCampaign,
  poolId,
  garden,
  cycle,
  allocation,
  recognition,
  start,
  end,
  name,
  purpose,
  capValue,
  onPinFailure,
}: PlanSetupStepsInput): Promise<PoolSetupStep[]> {
  if (poolId === undefined) throw new Error("This garden has no commitment pool");
  const allocationBps = toAllocationBps(allocation);
  const recognitionBps = toRecognitionBps(recognition);
  if (intent === "open-season" || intent === "open-campaign") {
    if (!cycle) throw new Error("No cycle to open");
    return openSeasonSteps({
      poolId,
      cycleId: cycle.cycleId,
      allocation: allocationBps,
      recognitionPolicy: recognitionBps,
    });
  }
  if (start === null || end === null) throw new Error("Dates are not set");
  onPinFailure(null);
  let metadataCID: string;
  try {
    metadataCID = await pinCycleMetadata({ name, gardenAddress: garden });
  } catch (error) {
    if (isPoolDocumentPinError(error)) onPinFailure("cycle");
    throw error;
  }
  const cycleInput = {
    cycleType: isCampaign ? ("CAMPAIGN" as const) : ("SEASON" as const),
    startTime: start,
    endTime: end,
    metadataCID,
  };
  if (intent === "campaign") {
    return campaignSteps({
      poolId,
      cycle: cycleInput,
      allocation: allocationBps,
      recognitionPolicy: recognitionBps,
    });
  }
  if (intent === "season") {
    return newSeasonSteps({
      poolId,
      cycle: cycleInput,
      allocation: allocationBps,
      recognitionPolicy: recognitionBps,
    });
  }
  let charterCID: string;
  try {
    charterCID = await pinPoolCharter({ purpose, gardenAddress: garden });
  } catch (error) {
    if (isPoolDocumentPinError(error)) onPinFailure("charter");
    throw error;
  }
  return firstRunSetupSteps({
    poolId,
    charterCID,
    cap: capValue ?? 0n,
    cycle: cycleInput,
    allocation: allocationBps,
    recognitionPolicy: recognitionBps,
  });
}
