import { describe, expect, it } from "vitest";
import {
  buildHubStageModel,
  getHubResultCount,
  resolveHubRouteSelection,
  resolveHubRouteSheet,
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
});
