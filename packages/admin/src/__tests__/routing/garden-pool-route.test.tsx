/**
 * @vitest-environment jsdom
 */

import { adminRoutes, getAdminWorkspaceForPath } from "@green-goods/shared";
import { describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "../test-utils";
import { findRoute, lazyOf, renderAdminCanvasRoute } from "./pooling-route-harness";

vi.mock("@/routes/RequireRole", async () => {
  const { Outlet } = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { default: () => <Outlet /> };
});

describe("/garden/pool", () => {
  it("is mounted in the Garden branch with its seed and commitment inspectors", () => {
    const pool = findRoute(["garden", "pool"]);
    expect(pool).toBeDefined();
    expect(lazyOf(pool)).toBeTypeOf("function");
    expect(pool?.children?.map((route) => (route.index ? "index" : route.path))).toEqual([
      "index",
      "seed",
      ":commitmentId",
    ]);
    // Every pool route renders through the Garden workspace view, the way the
    // hypercert inspector does, so the Pool tab and its dialogs share one shell.
    const gardenLazy = lazyOf(findRoute(["garden", "health"]));
    expect(lazyOf(pool)).toBe(gardenLazy);
    expect(findRoute(["garden", "pool", "seed"])?.lazy).toBe(gardenLazy);
    expect(findRoute(["garden", "pool", ":commitmentId"])?.lazy).toBe(gardenLazy);
  });

  it("builds its hrefs from the shared route helpers with the garden context", () => {
    expect(adminRoutes.gardenPool({ gardenId: "0xAAA" })).toBe("/garden/pool?gardenId=0xAAA");
    expect(adminRoutes.gardenPoolSeed({ gardenId: "0xAAA" })).toBe(
      "/garden/pool/seed?gardenId=0xAAA"
    );
    expect(adminRoutes.gardenPoolCommitment("9", { gardenId: "0xAAA" })).toBe(
      "/garden/pool/9?gardenId=0xAAA"
    );
    expect(getAdminWorkspaceForPath("/garden/pool/9")).toBe("garden");
  });

  it("serves the pool console and its inspectors in place, keeping the garden context", async () => {
    for (const path of ["/garden/pool", "/garden/pool/seed", "/garden/pool/9"]) {
      const router = renderAdminCanvasRoute(`${path}?gardenId=0xAAA`);
      await waitFor(() => {
        expect(router.state.location.pathname).toBe(path);
      });
      expect(router.state.location.search).toBe("?gardenId=0xAAA");
    }
    expect(screen.getAllByTestId("route-target").length).toBeGreaterThan(0);
  });
});
