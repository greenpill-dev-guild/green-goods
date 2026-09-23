/**
 * The setup checklist previews the writes before any are planned for real, so
 * its list per flow must be the one the shared planners send, in order.
 */
import {
  campaignSteps,
  firstRunSetupSteps,
  newSeasonSteps,
  openSeasonSteps,
} from "@green-goods/shared/modules/commitment-pooling/pool-setup";
import { describe, expect, it } from "vitest";
import {
  plannedActions,
  previewRows,
  promptNumbers,
} from "@/views/Garden/Pool/SetupFlow/setupWrites";

const SPLIT = {
  allocation: {
    gardeners: 6000,
    treasury: 1500,
    operator: 1000,
    evaluator: 500,
    community: 500,
    funder: 500,
  },
  recognitionPolicy: { equalParticipationBps: 2000, verifiedContributionBps: 8000 },
};
const CYCLE = { cycleType: "SEASON" as const, startTime: 1n, endTime: 2n, metadataCID: "bafy" };

describe("setup checklist writes", () => {
  it("previews exactly the writes each flow sends, in order", () => {
    const actions = (steps: { action: string }[]) => steps.map((step) => step.action);
    expect(plannedActions("first-run")).toEqual(
      actions(firstRunSetupSteps({ poolId: 1n, charterCID: "c", cap: 24n, cycle: CYCLE, ...SPLIT }))
    );
    expect(plannedActions("season")).toEqual(
      actions(newSeasonSteps({ poolId: 1n, cycle: CYCLE, ...SPLIT }))
    );
    expect(plannedActions("campaign")).toEqual(
      actions(campaignSteps({ poolId: 1n, cycle: CYCLE, ...SPLIT }))
    );
    const open = actions(openSeasonSteps({ poolId: 1n, cycleId: 3n, ...SPLIT }));
    expect(plannedActions("open-season")).toEqual(open);
    expect(plannedActions("open-campaign")).toEqual(open);
  });

  it("counts a write the pool already shows as done, not as a prompt", () => {
    const rows = previewRows("season", true);
    expect(rows.map((row) => row.status)).toEqual(["pending", "already", "pending"]);
    expect(promptNumbers(rows, false)).toEqual({ numbers: [1, null, 2], total: 2 });
  });

  it("numbers shared prompts the same when the wallet batches", () => {
    expect(promptNumbers(previewRows("first-run", false), true)).toEqual({
      numbers: [1, 1, 1, 1, 1, 2],
      total: 2,
    });
  });

  // A stop at the second of six writes: during the run the numbers hold, and
  // once it has stopped a retry is counted over the writes still to send.
  const stoppedAtTwo = previewRows("first-run", false).map((row, index) => ({
    ...row,
    status:
      index === 0 ? ("landed" as const) : index === 1 ? ("failed" as const) : ("pending" as const),
  }));
  it.each([
    {
      when: "while it runs",
      stopped: false,
      batching: false,
      numbers: [1, 2, 3, 4, 5, 6],
      total: 6,
    },
    {
      when: "once stopped",
      stopped: true,
      batching: false,
      numbers: [null, 1, 2, 3, 4, 5],
      total: 5,
    },
    {
      when: "once stopped, batching",
      stopped: true,
      batching: true,
      numbers: [null, 1, 1, 1, 1, 2],
      total: 2,
    },
  ])("numbers the writes $when", ({ stopped, batching, numbers, total }) => {
    expect(promptNumbers(stoppedAtTwo, batching, stopped)).toEqual({ numbers, total });
  });
});
