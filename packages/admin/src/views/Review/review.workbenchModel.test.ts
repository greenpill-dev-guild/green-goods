import {
  buildActionTitleMap,
  buildReviewStageModel,
  buildReviewWorkspaceState,
  getReviewResultCount,
  normalizeReviewSearch,
  resolveReviewRouteSelection,
  resolveReviewRouteSheet,
  resolveReviewRouteState,
} from "@green-goods/shared/hooks/admin-ui/review/review.workbenchModel";
import { describe, expect, it } from "vitest";

describe("review.workbenchModel", () => {
  it("builds visible stages and falls back when the requested stage is unavailable", () => {
    // An evaluator who is not a steward: no Work tab, and both record tabs.
    const model = buildReviewStageModel({
      requestedStage: "work",
      canManage: false,
      canReview: true,
      works: [{ status: "pending" }, { status: "approved" }, { status: "approved" }],
    });

    expect(model.stage).toBe("assess");
    expect(model.stageCounts).toMatchObject({ work: 1 });
    expect(model.stages.map((stage) => stage.id)).toEqual(["assess", "certify"]);
    // The record tabs list records, not work waiting on someone: no count chip.
    expect(model.stages.map((stage) => stage.count)).toEqual([undefined, undefined]);
  });

  it("keeps work as the fallback when no stage is visible", () => {
    const model = buildReviewStageModel({
      requestedStage: "certify",
      canManage: false,
      canReview: false,
      works: [],
    });

    expect(model.stage).toBe("work");
    expect(model.stages).toEqual([]);
  });

  it("resolves route-backed sheet content ids", () => {
    expect(resolveReviewRouteSheet({ isSubmitRoute: true })).toEqual({
      routeSheetContentId: "review:submit-work",
      routeSheetSide: "left",
    });
    expect(resolveReviewRouteSheet({ isSubmitRoute: false, routeWorkId: "work-1" })).toEqual({
      routeSheetContentId: "review:work-detail:work-1",
      routeSheetSide: "left",
    });
    expect(
      resolveReviewRouteSheet({ isSubmitRoute: false, routeCertificationId: "assessment-1" })
    ).toEqual({
      routeSheetContentId: "review:certify:assessment-1",
      routeSheetSide: "left",
    });
  });

  it("derives route state from router params and active sheet content", () => {
    // An assessment's record opens under the Assessments tab, so the tab behind
    // the open record is Assessments, not Hypercerts.
    expect(
      resolveReviewRouteState({
        pathname: "/review/assess/assessment-1",
        sortParam: "oldest",
        scopeParam: "approved",
        routedAssessmentIdParam: "assessment-1",
        activeContentId: "review:work-detail:work-1",
      })
    ).toMatchObject({
      activeCertificationId: null,
      activeWorkDetailId: "work-1",
      isSubmitRoute: false,
      requestedStage: "assess",
      routeCertificationId: "assessment-1",
      routeSheetContentId: "review:certify:assessment-1",
      routeSheetSide: "left",
      sortDirection: "oldest",
      workScope: "approved",
    });
  });

  it("derives submit routes and falls back to newest sort and the Pending scope for unknown values", () => {
    expect(
      resolveReviewRouteState({
        pathname: "/review/work/submit",
        sortParam: "sideways",
        scopeParam: "rejected",
        activeContentId: null,
      })
    ).toMatchObject({
      isSubmitRoute: true,
      requestedStage: "work",
      routeSheetContentId: "review:submit-work",
      routeSheetSide: "left",
      sortDirection: "newest",
      workScope: "pending",
    });
  });

  it("resolves persisted selected item and inspector state from route and active sheet state", () => {
    expect(
      resolveReviewRouteSelection({
        routeWorkId: undefined,
        routeCertificationId: undefined,
        activeWorkDetailId: "active-work",
        activeCertificationId: null,
        isSubmitRoute: false,
        selectedWork: undefined,
        selectedCertification: undefined,
      })
    ).toEqual({
      hasOpenReviewInspector: false,
      persistedSelectedItem: "active-work",
    });

    expect(
      resolveReviewRouteSelection({
        routeWorkId: "route-work",
        routeCertificationId: undefined,
        activeWorkDetailId: "active-work",
        activeCertificationId: null,
        isSubmitRoute: false,
        selectedWork: { id: "route-work" },
        selectedCertification: undefined,
      })
    ).toEqual({
      hasOpenReviewInspector: true,
      persistedSelectedItem: "route-work",
    });
  });

  it("counts visible rows for the active stage", () => {
    expect(
      getReviewResultCount("certify", {
        works: 1,
        assessments: 2,
        hypercerts: 3,
        confirmQueue: 4,
      })
    ).toBe(3);
  });

  it("normalizes search terms and builds action title maps for queue filters", () => {
    expect(normalizeReviewSearch("  Solar Pump  ")).toBe("solar pump");
    expect(buildActionTitleMap([{ id: "42", title: "Tree Planting" }]).get(42)).toEqual({
      title: "Tree Planting",
    });
  });

  it("builds the persisted workspace payload without route or data dependencies", () => {
    expect(
      buildReviewWorkspaceState({
        stage: "confirm",
        sortDirection: "oldest",
        searchTerm: "allocation",
        persistedSelectedItem: "commitment-1",
        hasOpenReviewInspector: true,
      })
    ).toEqual({
      activeMode: "confirm",
      filter: "oldest",
      search: "allocation",
      selectedItem: "commitment-1",
      sheetOpen: true,
    });
  });
});
