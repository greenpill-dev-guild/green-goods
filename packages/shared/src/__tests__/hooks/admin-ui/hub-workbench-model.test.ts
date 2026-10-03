/**
 * buildHubStageModel — stage counts and visibility
 *
 * A count on the rail means "waiting on you", so it reads the unfiltered
 * queues: a search never shifts it (#563 review P2). Assessments and Hypercerts
 * list records, which wait on no one, and carry no count (DL-082).
 */

import { describe, expect, it } from "vitest";

import {
  buildHubStageModel,
  hasHubStageDataError,
  resolveHubRouteState,
  resolveHubSheetSelection,
  selectHubStageContent,
} from "../../../hooks/admin-ui/hub/hub.workbenchModel";

const baseInput = {
  requestedStage: "work" as const,
  canManage: true,
  canReview: true,
};

describe("buildHubStageModel stageCounts", () => {
  it.each([
    "work",
    "certify",
  ] as const)("counts pending work only, whichever stage is open (%s)", (requestedStage) => {
    const { stageCounts } = buildHubStageModel({
      ...baseInput,
      requestedStage,
      works: [{ status: "pending" }, { status: "pending" }, { status: "approved" }],
    });

    expect(stageCounts.work).toBe(2);
    // Approved work is a scope of the Work tab, not a queue of its own.
    expect(stageCounts.assess).toBeUndefined();
    expect(stageCounts.certify).toBeUndefined();
  });

  it("counts the Confirm stage from the confirmation queue and shows it only to a steward", () => {
    const steward = buildHubStageModel({
      ...baseInput,
      canConfirm: true,
      confirmCount: 3,
      works: [],
    });
    expect(steward.stageCounts.confirm).toBe(3);
    expect(steward.stageVisibility.confirm).toBe(true);
    expect(steward.stages.map((stage) => stage.id)).toEqual([
      "work",
      "confirm",
      "assess",
      "certify",
    ]);

    const evaluator = buildHubStageModel({
      ...baseInput,
      canManage: false,
      canConfirm: false,
      confirmCount: 3,
      requestedStage: "confirm",
      works: [],
    });
    expect(evaluator.stageVisibility.confirm).toBe(false);
    // A stage the reader cannot see clamps to a visible one, never to an empty Confirm.
    expect(evaluator.stage).not.toBe("confirm");
  });
});

describe("hasHubStageDataError", () => {
  const failed = new Error("read failed");
  const read = {
    gardenError: null,
    worksError: null,
    assessmentsError: null,
    hypercertsError: null,
    hypercertCount: 0,
  };

  // A failed read is not an empty list, and each tab answers for its own read:
  // an outage in one source must not blank a tab whose records loaded.
  it.each([
    ["a garden that could not be read marks every stage", "assess", { gardenError: failed }, true],
    ["a failed work read marks the Work tab", "work", { worksError: failed }, true],
    [
      "a failed work read leaves the Assessments tab alone",
      "assess",
      { worksError: failed },
      false,
    ],
    [
      "a failed work read leaves the Hypercerts tab alone",
      "certify",
      { worksError: failed },
      false,
    ],
    [
      "a failed assessment read marks the Assessments tab",
      "assess",
      { assessmentsError: failed },
      true,
    ],
    [
      "a failed assessment read leaves the Work tab reviewable",
      "work",
      { assessmentsError: failed },
      false,
    ],
    [
      "a failed hypercert read with nothing to show marks the Hypercerts tab",
      "certify",
      { hypercertsError: failed },
      true,
    ],
    [
      "a failed refresh keeps the hypercerts already read",
      "certify",
      { hypercertsError: failed, hypercertCount: 2 },
      false,
    ],
    [
      "a failed hypercert read leaves the Work tab reviewable",
      "work",
      { hypercertsError: failed },
      false,
    ],
    [
      "the Confirm stage answers for its own queue",
      "confirm",
      { worksError: failed, assessmentsError: failed, hypercertsError: failed },
      false,
    ],
  ] as const)("%s", (_label, stage, overrides, expected) => {
    expect(hasHubStageDataError(stage, { ...read, ...overrides })).toBe(expected);
  });
});

describe("Hub workbench routing policy", () => {
  it.each([
    "work",
    "assess",
    "confirm",
    "certify",
  ] as const)("routes the %s stage to its matching queue", (stage) => {
    expect(selectHubStageContent(stage)).toBe(stage);
  });

  it("prioritizes a route-backed work inspector over persisted selection", () => {
    expect(
      resolveHubSheetSelection({
        routeWorkId: "route-work",
        routeCertificationId: "certification",
        activeWorkDetailId: "active-work",
        hasSelectedCertification: true,
      })
    ).toEqual({ kind: "work", id: "route-work" });
  });

  it("closes the inspector after the detail route leaves, despite retained work selection", () => {
    expect(
      resolveHubSheetSelection({
        activeWorkDetailId: "active-work",
        hasSelectedCertification: true,
      })
    ).toBeNull();
  });

  it.each([
    ["certification route", { routeCertificationId: "certification" }, "certification"],
  ] as const)("resolves a %s inspector", (_label, overrides, kind) => {
    expect(
      resolveHubSheetSelection({
        activeWorkDetailId: null,
        hasSelectedCertification: false,
        ...overrides,
      })
    ).toEqual({ kind });
  });

  it("does not reopen an assessment from retained selection after its route closes", () => {
    expect(
      resolveHubSheetSelection({
        activeWorkDetailId: null,
        hasSelectedCertification: true,
      })
    ).toBeNull();
  });

  it("returns no inspector without route or selection state", () => {
    expect(
      resolveHubSheetSelection({
        activeWorkDetailId: null,
        hasSelectedCertification: false,
      })
    ).toBeNull();
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
      canReview: true,
      works: [],
    });
    // stage === requestedStage → the effect's `requestedStage === stage` guard
    // returns early → no redirect. So a permitted steward does NOT hit the
    // stripping mechanism — the two-click cause for them lies elsewhere.
    expect(stage).toBe("assess");
  });

  it("clamps stage to a visible fallback when the viewer cannot assess (a legitimate permission redirect, not the two-click bug)", () => {
    const { stage } = buildHubStageModel({
      requestedStage: "assess",
      canManage: true,
      canReview: false,
      works: [],
    });
    expect(stage).not.toBe("assess");
    expect(stage).toBe("work"); // first visible stage
  });
});
