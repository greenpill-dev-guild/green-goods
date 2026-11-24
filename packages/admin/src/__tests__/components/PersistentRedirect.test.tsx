/**
 * @vitest-environment happy-dom
 *
 * A guard's redirect lands even when the Hub's garden sync rewrites the address while the
 * redirect's route is still loading.
 */
// TEST-QUALITY: allow-small-test-file - surviving the garden sync's rewrite is the one behavior this redirect adds

import { type ReactNode, useEffect } from "react";
import { createMemoryRouter, RouterProvider, useNavigate } from "react-router-dom";
import { describe, expect, it } from "vitest";
import PersistentRedirect from "../../routes/PersistentRedirect";
import { renderWithProviders, screen } from "../test-utils";

/** What the garden sync does as a Hub page arrives: write the garden into the address. */
function GardenSync() {
  const navigate = useNavigate();
  useEffect(() => {
    navigate({ search: "?gardenId=0x1" }, { replace: true });
  }, [navigate]);
  return null;
}

function renderGuardedRoute(redirect: ReactNode) {
  const router = createMemoryRouter(
    [
      {
        path: "/community",
        element: (
          <>
            {redirect}
            <GardenSync />
          </>
        ),
      },
      {
        // Still loading its code when the redirect starts, like the Hub's views on arrival.
        path: "/review",
        lazy: async () => {
          await new Promise((resolve) => setTimeout(resolve, 20));
          return { Component: () => <h1>Review</h1> };
        },
      },
    ],
    { initialEntries: ["/community"] }
  );
  const addresses: string[] = [];
  router.subscribe((state) => addresses.push(state.location.pathname + state.location.search));
  renderWithProviders(<RouterProvider router={router} />);
  return { router, addresses };
}

describe("PersistentRedirect", () => {
  it("lands on its target although the garden sync rewrote the address first", async () => {
    const { router, addresses } = renderGuardedRoute(<PersistentRedirect to="/review" />);

    expect(await screen.findByRole("heading", { name: "Review" })).toBeVisible();
    expect(addresses).toContain("/community?gardenId=0x1");
    expect(router.state.location.pathname).toBe("/review");
  });
});
