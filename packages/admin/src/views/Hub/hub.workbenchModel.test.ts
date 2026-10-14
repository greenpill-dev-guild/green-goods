import {
  buildActionTitleMap,
  buildHubStageModel,
  buildHubWorkspaceState,
  getHubResultCount,
  normalizeHubSearch,
  resolveHubRouteSelection,
  resolveHubRouteSheet,
  resolveHubRouteState,
} from "@green-goods/shared/hooks/admin-ui/hub/hub.workbenchModel";
import { describe, expect, it } from "vitest";

describe("hub.workbenchModel", () => {
  it("builds visible stages and falls back when the requested stage is unavailable", () => {
    // An evaluator who is not a steward: no Work tab, and both record tabs.
    const model = buildHubStageModel({
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
    const model = buildHubStageModel({
      requestedStage: "certify",
      canManage: false,
      canReview: false,
      works: [],
    });

    expect(model.stage).toBe("work");
    expect(model.stages).toEqual([]);
  });

  it("leads with the Confirm stage when the reader stewards a garden", () => {
    const model = buildHubStageModel({
      requestedStage: "work",
      canManage: true,
      canReview: true,
      canConfirm: true,
      confirmCount: 2,
      works: [],
    });

    expect(model.stages.map((stage) => stage.id)).toEqual(["work", "confirm", "assess", "certify"]);
    expect(model.fallbackStage).toBe("work");
    expect(model.stageCounts.confirm).toBe(2);
  });

  it("resolves route-backed sheet content ids", () => {
    expect(resolveHubRouteSheet({ isSubmitRoute: true })).toEqual({
      routeSheetContentId: "hub:submit-work",
      routeSheetSide: "left",
    });
    expect(resolveHubRouteSheet({ isSubmitRoute: false, routeWorkId: "work-1" })).toEqual({
      routeSheetContentId: "hub:work-detail:work-1",
      routeSheetSide: "left",
    });
    expect(
      resolveHubRouteSheet({ isSubmitRoute: false, routeCertificationId: "assessment-1" })
    ).toEqual({
      routeSheetContentId: "hub:certify:assessment-1",
      routeSheetSide: "left",
    });
  });

  it("derives route state from router params and active sheet content", () => {
    // An assessment's record opens under the Assessments tab, so the tab behind
    // the open record is Assessments, not Hypercerts.
    expect(
      resolveHubRouteState({
        pathname: "/hub/assess/assessment-1",
        sortParam: "oldest",
        scopeParam: "approved",
        routedAssessmentIdParam: "assessment-1",
        activeContentId: "hub:work-detail:work-1",
      })
    ).toMatchObject({
      activeCertificationId: null,
      activeWorkDetailId: "work-1",
      isSubmitRoute: false,
      requestedStage: "assess",
      routeCertificationId: "assessment-1",
      routeSheetContentId: "hub:certify:assessment-1",
      routeSheetSide: "left",
      sortDirection: "oldest",
      workScope: "approved",
    });
  });

  it("derives submit routes and falls back to newest sort and the Pending scope for unknown values", () => {
    expect(
      resolveHubRouteState({
        pathname: "/hub/work/submit",
        sortParam: "sideways",
        scopeParam: "rejected",
        activeContentId: null,
      })
    ).toMatchObject({
      isSubmitRoute: true,
      requestedStage: "work",
      routeSheetContentId: "hub:submit-work",
      routeSheetSide: "left",
      sortDirection: "newest",
      workScope: "pending",
    });
  });

  it("resolves persisted selected item and inspector state from route and active sheet state", () => {
    expect(
      resolveHubRouteSelection({
        routeWorkId: undefined,
        routeCertificationId: undefined,
        activeWorkDetailId: "active-work",
        activeCertificationId: null,
        isSubmitRoute: false,
        selectedWork: undefined,
        selectedCertification: undefined,
      })
    ).toEqual({
      hasOpenHubInspector: false,
      persistedSelectedItem: "active-work",
    });

    expect(
      resolveHubRouteSelection({
        routeWorkId: "route-work",
        routeCertificationId: undefined,
        activeWorkDetailId: "active-work",
        activeCertificationId: null,
        isSubmitRoute: false,
        selectedWork: { id: "route-work" },
        selectedCertification: undefined,
      })
    ).toEqual({
      hasOpenHubInspector: true,
      persistedSelectedItem: "route-work",
    });
  });

  it("counts visible rows for the active stage", () => {
    expect(
      getHubResultCount("certify", {
        works: 1,
        assessments: 2,
        hypercerts: 3,
        confirmQueue: 4,
      })
    ).toBe(3);
  });

  it("normalizes search terms and builds action title maps for queue filters", () => {
    expect(normalizeHubSearch("  Solar Pump  ")).toBe("solar pump");
    expect(buildActionTitleMap([{ id: "42", title: "Tree Planting" }]).get(42)).toEqual({
      title: "Tree Planting",
    });
  });

  it("builds the persisted workspace payload without route or data dependencies", () => {
    expect(
      buildHubWorkspaceState({
        stage: "confirm",
        sortDirection: "oldest",
        searchTerm: "allocation",
        persistedSelectedItem: "commitment-1",
        hasOpenHubInspector: true,
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
