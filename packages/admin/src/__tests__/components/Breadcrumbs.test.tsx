import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { renderWithProviders, screen } from "../test-utils";

const mockUseGardens = vi.fn();
const mockUseActions = vi.fn();

vi.mock("@green-goods/shared", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@green-goods/shared")>();
  return {
    ...actual,
    useGardens: () => mockUseGardens(),
    useActions: () => mockUseActions(),
  };
});

import { Breadcrumbs } from "@/components/Layout/Breadcrumbs";

describe("Breadcrumbs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseGardens.mockReturnValue({
      data: [{ id: "garden-1", name: "Alpha Garden" }],
    });
    mockUseActions.mockReturnValue({
      data: [],
    });
  });

  it("shows endowments as the parent breadcrumb for vault pages opened from endowments", () => {
    renderWithProviders(
      <MemoryRouter
        initialEntries={[
          {
            pathname: "/gardens/garden-1/vault",
            state: { returnTo: "/endowments", returnLabelId: "app.admin.nav.treasury" },
          },
        ]}
      >
        <Breadcrumbs />
      </MemoryRouter>
    );

    expect(screen.getByRole("link", { name: "Endowments" })).toHaveAttribute(
      "href",
      "/endowments"
    );
    expect(screen.getByText("Vault")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Gardens" })).not.toBeInTheDocument();
  });
});
