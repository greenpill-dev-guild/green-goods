/**
 * @vitest-environment jsdom
 */

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

describe("/community/pools", () => {
  it("is a Community mode, not a top-level Pools route", () => {
    const pools = findRoute(["community", "pools"]);
    expect(pools).toBeDefined();
    expect(lazyOf(pools)).toBe(lazyOf(findRoute(["community", "members"])));
    expect(findRoute(["pools"])).toBeUndefined();
    expect(getAdminWorkspaceForPath("/community/pools")).toBe("community");
  });

  it("builds its href from the shared community mode helper", () => {
    expect(adminRoutes.communityPools({ gardenId: "0xAAA" })).toBe(
      "/community/pools?gardenId=0xAAA"
    );
    expect(adminRoutes.communityMode("pools")).toBe("/community/pools");
  });

  it("renders in place under the Community workspace", async () => {
    const router = renderAdminCanvasRoute("/community/pools?gardenId=0xAAA");
    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/community/pools");
    });
    expect(router.state.location.search).toBe("?gardenId=0xAAA");
  });
});
