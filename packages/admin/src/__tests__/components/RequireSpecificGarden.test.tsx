/**
 * RequireSpecificGarden Tests
 * @vitest-environment jsdom
 */

import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen } from "../test-utils";

const mockSetSelectedGarden = vi.fn();

vi.mock("@green-goods/shared", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@green-goods/shared")>();
  return {
    ...actual,
    useAdminStore: (
      selector: (state: {
        selectedGarden: null;
        setSelectedGarden: typeof mockSetSelectedGarden;
      }) => unknown
    ) =>
      selector({
        selectedGarden: null,
        setSelectedGarden: mockSetSelectedGarden,
      }),
    useGardens: () => ({
      data: [{ id: "garden-1", name: "Garden One" }],
    }),
  };
});

import { RequireSpecificGarden } from "@/components/guards/RequireSpecificGarden";

describe("RequireSpecificGarden", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not auto-select the first garden", () => {
    renderWithProviders(
      <MemoryRouter initialEntries={["/community"]}>
        <Routes>
          <Route element={<RequireSpecificGarden />}>
            <Route path="/community" element={<div>Community View</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText("Community View")).toBeInTheDocument();
    expect(mockSetSelectedGarden).not.toHaveBeenCalled();
  });
});
