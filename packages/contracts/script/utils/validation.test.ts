import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { type ActionConfig, type ActionMetricOutput, metricOutputProblems } from "./validation";

const ACTIONS = JSON.parse(readFileSync(path.join(__dirname, "../../config/actions.json"), "utf8")) as {
  actions: ActionConfig[];
};

const milestone = ACTIONS.actions.find((action) => action.slug === "solar.install_milestone")!;

function withOutputs(action: ActionConfig, metricOutputs: ActionMetricOutput[]): ActionConfig {
  return { ...action, metricOutputs };
}

describe("metric outputs", () => {
  it("counts each number of every configured action in one unit", () => {
    const problems = ACTIONS.actions.flatMap((action) =>
      metricOutputProblems(action).map((problem) => `${action.slug}: ${problem}`),
    );
    expect(problems).toEqual([]);
  });

  it("refuses one milestone number counted as kW, kWh and Mbps whatever its type", () => {
    const unsplit = withOutputs(milestone, [
      { key: "installedCapacityKw", unit: "kW", aggregation: "sum", derivedFrom: ["milestoneValue"] },
      { key: "batteryCapacityKwh", unit: "kWh", aggregation: "sum", derivedFrom: ["milestoneValue"] },
      { key: "internetMbps", unit: "Mbps", aggregation: "latest", derivedFrom: ["milestoneValue"] },
    ]);
    expect(metricOutputProblems(unsplit)).toHaveLength(3);
    expect(metricOutputProblems(unsplit)[0]).toContain("installedCapacityKw (kW) and batteryCapacityKwh (kWh)");
  });

  it("refuses a type condition that overlaps, or names no real option", () => {
    const overlapping = withOutputs(milestone, [
      {
        key: "installedCapacityKw",
        unit: "kW",
        aggregation: "sum",
        derivedFrom: ["milestoneValue"],
        when: { milestoneType: ["Solar kW installed", "Battery kWh added"] },
      },
      {
        key: "batteryCapacityKwh",
        unit: "kWh",
        aggregation: "sum",
        derivedFrom: ["milestoneValue"],
        when: { milestoneType: ["Battery kWh added"] },
      },
    ]);
    expect(metricOutputProblems(overlapping)).toHaveLength(1);

    const misspelt = withOutputs(milestone, [
      {
        key: "installedCapacityKw",
        unit: "kW",
        aggregation: "sum",
        derivedFrom: ["milestoneValue"],
        when: { milestoneType: ["Solar kW"] },
      },
    ]);
    expect(metricOutputProblems(misspelt)).toEqual([
      'installedCapacityKw: "Solar kW" is not an option of "milestoneType"',
    ]);
  });

  it("lets a percentage read the same number as a count", () => {
    const rated = withOutputs(milestone, [
      { key: "participantsTrained", unit: "people", aggregation: "sum", derivedFrom: ["milestoneValue"] },
      { key: "attendanceRate", unit: "%", aggregation: "avg", derivedFrom: ["milestoneValue"] },
    ]);
    expect(metricOutputProblems(rated)).toEqual([]);
  });
});
