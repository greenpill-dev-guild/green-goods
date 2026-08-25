/**
 * @vitest-environment jsdom
 */

import {
  PIPELINE_STAGE_CONFIG,
  resolvePipelineStageFromPath,
} from "@green-goods/shared/hooks/admin-ui/hub/hub.utils";
import {
  adminRoutes,
  getAdminWorkspaceForPath,
} from "@green-goods/shared/utils/navigation/admin-routes";
import { describe, expect, it, vi } from "vitest";
import { waitFor } from "../test-utils";
import { findRoute, lazyOf, renderAdminCanvasRoute } from "./pooling-route-harness";

vi.mock("@/routes/RequireRole", async () => {
  const { Outlet } = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { default: () => <Outlet /> };
});

describe("/hub/confirm", () => {
  it("is a Hub stage between Certify and History, served by the Hub view", () => {
    const confirm = findRoute(["hub", "confirm"]);
    expect(confirm).toBeDefined();
    expect(lazyOf(confirm)).toBe(lazyOf(findRoute(["hub", "work"])));
    expect(confirm?.children?.map((route) => (route.index ? "index" : route.path))).toEqual([
      "index",
      ":commitmentId",
    ]);
    expect(PIPELINE_STAGE_CONFIG.map((stage) => stage.id)).toEqual([
      "work",
      "assess",
      "certify",
      "confirm",
      "history",
    ]);
    expect(resolvePipelineStageFromPath("/hub/confirm")).toBe("confirm");
    expect(resolvePipelineStageFromPath("/hub/confirm/9")).toBe("confirm");
  });

  it("builds its hrefs from the shared hub mode helper", () => {
    expect(adminRoutes.hubConfirm({ gardenId: "0xAAA" })).toBe("/hub/confirm?gardenId=0xAAA");
    expect(adminRoutes.hubConfirmDetail("9", { gardenId: "0xAAA" })).toBe(
      "/hub/confirm/9?gardenId=0xAAA"
    );
    expect(getAdminWorkspaceForPath("/hub/confirm")).toBe("hub");
  });

  it("renders in place under the Hub workspace", async () => {
    for (const path of ["/hub/confirm", "/hub/confirm/9"]) {
      const router = renderAdminCanvasRoute(`${path}?gardenId=0xAAA`);
      await waitFor(() => {
        expect(router.state.location.pathname).toBe(path);
      });
      expect(router.state.location.search).toBe("?gardenId=0xAAA");
    }
  });
});
