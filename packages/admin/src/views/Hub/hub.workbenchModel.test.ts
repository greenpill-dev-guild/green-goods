import { describe, expect, it } from "vitest";
import {
  buildActionTitleMap,
  buildHubStageModel,
  buildHubWorkspaceState,
  getHubResultCount,
  normalizeHubSearch,
  resolveHubRouteSelection,
  resolveHubRouteSheet,
  resolveHubRouteState,
} from "./hub.workbenchModel";

describe("hub.workbenchModel", () => {
  it("builds visible stages and falls back when the requested stage is unavailable", () => {
    const model = buildHubStageModel({
      requestedStage: "work",
      canManage: false,
      canAssess: true,
      canCertify: true,
      canBrowseHistory: true,
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
    expect(model.stages.map((stage) => stage.id)).toEqual(["assess", "certify", "history"]);
  });

  it("keeps history as the fallback when no stage is visible", () => {
    const model = buildHubStageModel({
      requestedStage: "certify",
      canManage: false,
      canAssess: false,
      canCertify: false,
      canBrowseHistory: false,
      works: [],
      assessments: [],
      hypercerts: [],
    });

    expect(model.stage).toBe("history");
    expect(model.stages).toEqual([]);
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
    expect(
      resolveHubRouteSheet({ isSubmitRoute: false, routeHistoryEventId: "history-1" })
    ).toEqual({
      routeSheetContentId: "hub:history:history-1",
      routeSheetSide: "left",
    });
  });

  it("derives route state from router params and active sheet content", () => {
    expect(
      resolveHubRouteState({
        pathname: "/hub/history/allocation%3A0xabc%2F1",
        sortParam: "oldest",
        routedHistoryEventIdParam: "allocation:0xabc/1",
        activeContentId: "hub:work-detail:work-1",
      })
    ).toMatchObject({
      activeCertificationId: null,
      activeWorkDetailId: "work-1",
      isSubmitRoute: false,
      requestedStage: "history",
      routeHistoryEventId: "allocation:0xabc/1",
      routeSheetContentId: "hub:history:allocation:0xabc/1",
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
        routeHistoryEventId: undefined,
        activeWorkDetailId: "active-work",
        activeCertificationId: null,
        isSubmitRoute: false,
        selectedWork: undefined,
        selectedCertification: undefined,
        selectedHistoryEvent: undefined,
      })
    ).toEqual({
      hasOpenHubInspector: false,
      persistedSelectedItem: "active-work",
    });

    expect(
      resolveHubRouteSelection({
        routeWorkId: "route-work",
        routeCertificationId: undefined,
        routeHistoryEventId: undefined,
        activeWorkDetailId: "active-work",
        activeCertificationId: null,
        isSubmitRoute: false,
        selectedWork: { id: "route-work" },
        selectedCertification: undefined,
        selectedHistoryEvent: undefined,
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
        historyEvents: 4,
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
        stage: "history",
        sortDirection: "oldest",
        searchTerm: "allocation",
        persistedSelectedItem: "history-1",
        hasOpenHubInspector: true,
      })
    ).toEqual({
      activeMode: "history",
      filter: "oldest",
      search: "allocation",
      selectedItem: "history-1",
      sheetOpen: true,
    });
  });
});
