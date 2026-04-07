/**
 * Command Palette Routes Tests
 * @vitest-environment jsdom
 *
 * RED phase — verifies that CommandPalette has the correct static
 * routes, handles Settings action via custom event, navigates on
 * garden selection, and toggles with Cmd+K.
 */

import React from "react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { act, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen, fireEvent, waitFor } from "../test-utils";
import userEvent from "@testing-library/user-event";

// ── Mocks ──────────────────────────────────────────────────────────────────

const mockNavigate = vi.fn();

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock("@green-goods/shared", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    cn: (...args: unknown[]) => args.filter(Boolean).join(" "),
    DEFAULT_CHAIN_ID: 11155111,
    useAdminStore: (selector: (state: { selectedGarden: null }) => unknown) =>
      selector({ selectedGarden: null }),
    useActions: () => ({ data: [] }),
    useAllAssessments: () => ({ data: [] }),
    useGardens: () => ({
      data: [
        { id: "garden-1", name: "Chakra Farm", location: "Quito", tokenAddress: "0xAAA" },
        { id: "garden-2", name: "Solar Orchard", location: "Lima", tokenAddress: "0xBBB" },
      ],
    }),
    useRole: () => ({ role: "deployer" as const }),
  };
});

import { CommandPalette } from "@/components/Layout/CommandPalette";

// ── Tests ──────────────────────────────────────────────────────────────────

describe("CommandPalette Routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("STATIC_ROUTES includes /work, /garden, /community, /actions", () => {
    renderWithProviders(
      <MemoryRouter>
        <CommandPalette open={true} />
      </MemoryRouter>
    );

    // The palette renders static page items when open with empty query
    expect(screen.getByText("Work")).toBeInTheDocument();
    expect(screen.getByText("Garden")).toBeInTheDocument();
    expect(screen.getByText("Community")).toBeInTheDocument();
    expect(screen.getByText("Actions")).toBeInTheDocument();
  });

  it("typing 'Settings' triggers open-settings-sheet custom event", async () => {
    const settingsHandler = vi.fn();
    window.addEventListener("open-settings-sheet", settingsHandler);

    renderWithProviders(
      <MemoryRouter>
        <CommandPalette open={true} />
      </MemoryRouter>
    );

    // Type "Settings" into the search input
    const input = screen.getByPlaceholderText(/search/i);
    await userEvent.type(input, "Settings");

    // Wait for debounce (300ms) + results to filter
    await waitFor(() => {
      expect(screen.getByText("Settings")).toBeInTheDocument();
    }, { timeout: 1000 });

    // Click the Settings result
    const settingsButton = screen.getByText("Settings").closest("button");
    expect(settingsButton).toBeTruthy();
    await userEvent.click(settingsButton!);

    expect(settingsHandler).toHaveBeenCalledTimes(1);

    window.removeEventListener("open-settings-sheet", settingsHandler);
  });

  it("selecting a garden navigates to /garden?garden=:id", async () => {
    renderWithProviders(
      <MemoryRouter>
        <CommandPalette open={true} />
      </MemoryRouter>
    );

    // Gardens should appear in the results
    await waitFor(() => {
      expect(screen.getByText("Chakra Farm")).toBeInTheDocument();
    });

    const gardenButton = screen.getByText("Chakra Farm").closest("button");
    expect(gardenButton).toBeTruthy();
    await userEvent.click(gardenButton!);

    expect(mockNavigate).toHaveBeenCalledWith("/garden?garden=garden-1");
  });

  it("Cmd+K toggles palette open/closed", async () => {
    const onOpenChange = vi.fn();

    renderWithProviders(
      <MemoryRouter>
        <CommandPalette open={false} onOpenChange={onOpenChange} />
      </MemoryRouter>
    );

    // Trigger Cmd+K to open
    await act(async () => {
      fireEvent.keyDown(document, { key: "k", metaKey: true });
    });

    // The component should call onOpenChange(true)
    expect(onOpenChange).toHaveBeenCalledWith(true);
  });
});
