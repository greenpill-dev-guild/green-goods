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
    const model = buildHubStageModel({
      requestedStage: "work",
      canManage: false,
      canAssess: true,
      canCertify: true,
      works: [{ status: "pending" }, { status: "approved" }, { status: "approved" }],
      assessments: [{ id: "assessment-1" }, { id: "assessment-2" }],
      hypercerts: [{ id: "assessment-1" }],
    });

    expect(model.stage).toBe("assess");
    expect(model.stageCounts).toMatchObject({
      work: 1,
      assess: 2,
      certify: 1,
    });
    expect(model.stages.map((stage) => stage.id)).toEqual(["assess", "certify"]);
  });

  it("keeps work as the fallback when no stage is visible", () => {
    const model = buildHubStageModel({
      requestedStage: "certify",
      canManage: false,
      canAssess: false,
      canCertify: false,
      works: [],
      assessments: [],
      hypercerts: [],
    });

    expect(model.stage).toBe("work");
    expect(model.stages).toEqual([]);
  });

  it("leads with the Confirm stage when the reader stewards a garden", () => {
    const model = buildHubStageModel({
      requestedStage: "work",
      canManage: true,
      canAssess: true,
      canCertify: true,
      canConfirm: true,
      confirmCount: 2,
      works: [],
      assessments: [],
      hypercerts: [],
    });

    expect(model.stages.map((stage) => stage.id)).toEqual(["confirm", "work", "assess", "certify"]);
    expect(model.fallbackStage).toBe("confirm");
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
    expect(
      resolveHubRouteState({
        pathname: "/hub/certify/assessment-1",
        sortParam: "oldest",
        routedAssessmentIdParam: "assessment-1",
        activeContentId: "hub:work-detail:work-1",
      })
    ).toMatchObject({
      activeCertificationId: null,
      activeWorkDetailId: "work-1",
      isSubmitRoute: false,
      requestedStage: "certify",
      routeCertificationId: "assessment-1",
      routeSheetContentId: "hub:certify:assessment-1",
      routeSheetSide: "left",
      sortDirection: "oldest",
    });
  });

  it("derives submit routes and falls back to newest sort for unknown values", () => {
    expect(
      resolveHubRouteState({
        pathname: "/hub/work/submit",
        sortParam: "sideways",
        activeContentId: null,
      })
    ).toMatchObject({
      isSubmitRoute: true,
      requestedStage: "work",
      routeSheetContentId: "hub:submit-work",
      routeSheetSide: "left",
      sortDirection: "newest",
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
        pendingWorks: 1,
        assessmentQueue: 2,
        certificationQueue: 3,
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
