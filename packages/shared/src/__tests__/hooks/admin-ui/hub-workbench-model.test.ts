/**
 * buildHubStageModel — stageCounts source-of-truth test
 *
 * Guards the Hub header "pipeline summary" (#563 review P2): the stage counts
 * that feed both the tab-rail badges and the header MetaStrip are derived from
 * the *unfiltered* works/assessments/hypercerts, independent of any active
 * search term. Reading the search-filtered queue lengths in the header made the
 * two disagree whenever a steward searched; this pins the unfiltered contract.
 */

import { describe, expect, it } from "vitest";

import {
  buildHubStageModel,
  resolveHubRouteState,
} from "../../../hooks/admin-ui/hub/hub.workbenchModel";

const baseInput = {
  requestedStage: "work" as const,
  canManage: true,
  canAssess: true,
  canCertify: true,
  canBrowseHistory: true,
};

describe("buildHubStageModel stageCounts", () => {
  it("derives unfiltered pipeline counts from raw works/assessments/hypercerts", () => {
    const { stageCounts } = buildHubStageModel({
      ...baseInput,
      works: [{ status: "pending" }, { status: "pending" }, { status: "approved" }],
      assessments: [{ id: "a1" }, { id: "a2" }, { id: "a3" }],
      hypercerts: [{ id: "a3" }], // a3 already certified → excluded from the certify queue
    });

    expect(stageCounts.work).toBe(2); // two pending submissions
    expect(stageCounts.assess).toBe(1); // one approved submission awaiting assessment
    expect(stageCounts.certify).toBe(2); // three assessments minus one already certified
    expect(stageCounts.history).toBeUndefined();
  });

  it("reports the full pipeline regardless of which stage is requested", () => {
    // The header summary must report every stage even when the steward is
    // viewing a single one — the counts are not scoped to requestedStage.
    const { stageCounts } = buildHubStageModel({
      ...baseInput,
      requestedStage: "certify",
      works: [{ status: "pending" }, { status: "approved" }, { status: "approved" }],
      assessments: [{ id: "a1" }],
      hypercerts: [],
    });

    expect(stageCounts.work).toBe(1);
    expect(stageCounts.assess).toBe(2);
    expect(stageCounts.certify).toBe(1);
  });

  it("counts the Confirm stage from the confirmation queue and shows it only to a steward", () => {
    const steward = buildHubStageModel({
      ...baseInput,
      canConfirm: true,
      confirmCount: 3,
      works: [],
      assessments: [],
      hypercerts: [],
    });
    expect(steward.stageCounts.confirm).toBe(3);
    expect(steward.stageVisibility.confirm).toBe(true);
    expect(steward.stages.map((stage) => stage.id)).toEqual([
      "work",
      "assess",
      "certify",
      "confirm",
      "history",
    ]);

    const evaluator = buildHubStageModel({
      ...baseInput,
      canManage: false,
      canConfirm: false,
      confirmCount: 3,
      requestedStage: "confirm",
      works: [],
      assessments: [],
      hypercerts: [],
    });
    expect(evaluator.stageVisibility.confirm).toBe(false);
    // A stage the reader cannot see clamps to a visible one, never to an empty Confirm.
    expect(evaluator.stage).not.toBe("confirm");
  });
});

/**
 * Two-click investigation — what does the model do at a full-page create route?
 *
 * Hypothesis under test (Explore agent): navigating to /hub/assess/create makes
 * the stage-sync effect (requestedStage !== stage) replace-navigate to the bare
 * stage, stripping /create and forcing a second click. The effect only fires
 * when stage diverges from requestedStage — so this pins WHEN that happens.
 */
describe("Hub create-route stage resolution (two-click investigation)", () => {
  const routeStateFor = (pathname: string) =>
    resolveHubRouteState({
      pathname,
      sortParam: null,
      routedWorkIdParam: undefined,
      routedAssessmentIdParam: undefined,
      routedHistoryEventIdParam: undefined,
      activeContentId: null,
    });

  it("treats /hub/assess/create as the assess stage with no sheet content", () => {
    const s = routeStateFor("/hub/assess/create");
    expect(s.requestedStage).toBe("assess");
    expect(s.routeSheetContentId).toBeNull();
  });

  it("does NOT diverge stage from requestedStage when the steward can assess (no redirect)", () => {
    const { stage } = buildHubStageModel({
      requestedStage: "assess",
      canManage: true,
      canAssess: true,
      canCertify: true,
      canBrowseHistory: true,
      works: [],
      assessments: [],
      hypercerts: [],
    });
    // stage === requestedStage → the effect's `requestedStage === stage` guard
    // returns early → no redirect. So a permitted steward does NOT hit the
    // stripping mechanism — the two-click cause for them lies elsewhere.
    expect(stage).toBe("assess");
  });

  it("clamps stage to a visible fallback when the steward cannot assess (a legitimate permission redirect, not the two-click bug)", () => {
    const { stage } = buildHubStageModel({
      requestedStage: "assess",
      canManage: true,
      canAssess: false,
      canCertify: true,
      canBrowseHistory: true,
      works: [],
      assessments: [],
      hypercerts: [],
    });
    expect(stage).not.toBe("assess");
    expect(stage).toBe("work"); // first visible stage
  });
});
