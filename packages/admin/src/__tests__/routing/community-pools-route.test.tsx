/**
 * @vitest-environment jsdom
 */

import {
  adminRoutes,
  getAdminWorkspaceForPath,
} from "@green-goods/shared/utils/navigation/admin-routes";
import { describe, expect, it, vi } from "vitest";
import { waitFor } from "../test-utils";
import { findRoute, renderAdminCanvasRoute } from "./pooling-route-harness";

vi.mock("@/routes/RequireRole", async () => {
  const { Outlet } = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { default: () => <Outlet /> };
});

describe("/community/pools", () => {
  it("is a retired Community mode: the route redirects into Coordination", () => {
    // The Pools tab folded into Coordination (2026-08-25 AD-5); the W12
    // surface renders there and the old path stays a redirect, never a 404.
    const pools = findRoute(["community", "pools"]);
    expect(pools).toBeDefined();
    expect(findRoute(["pools"])).toBeUndefined();
    expect(getAdminWorkspaceForPath("/community/pools")).toBe("community");
    expect(adminRoutes.communityCoordination({ gardenId: "0xAAA" })).toBe(
      "/community/coordination?gardenId=0xAAA"
    );
  });

  it("lands saved deep links on Coordination", async () => {
    const router = renderAdminCanvasRoute("/community/pools?gardenId=0xAAA");
    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/community/coordination");
    });
  });
});
