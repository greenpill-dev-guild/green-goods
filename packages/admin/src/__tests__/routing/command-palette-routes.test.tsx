/**
 * Command Palette Routes Tests
 * @vitest-environment jsdom
 *
 * RED phase — verifies that CommandPalette has the correct static
 * routes, handles account sheet actions via custom event, navigates on
 * garden selection, and toggles with Cmd+K.
 */

import React from "react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderWithProviders, screen, fireEvent, waitFor } from "../test-utils";
import userEvent from "@testing-library/user-event";
import { OPEN_ACCOUNT_SHEET_EVENT } from "@green-goods/shared";

// ── Mocks ──────────────────────────────────────────────────────────────────

const mockNavigate = vi.fn();
const mockSetSelectedGarden = vi.fn();
const { CHAKRA_GARDEN_ID, SOLAR_GARDEN_ID, SHARED_GARDEN_TOKEN, mockEligibleGardens } = vi.hoisted(
  () => {
    const chakraGardenId = "0x0000000000000000000000000000000000000aaa";
    const solarGardenId = "0x0000000000000000000000000000000000000bbb";
    const sharedGardenToken = "0x9990000000000000000000000000000000000999";

    return {
      CHAKRA_GARDEN_ID: chakraGardenId,
      SOLAR_GARDEN_ID: solarGardenId,
      SHARED_GARDEN_TOKEN: sharedGardenToken,
      mockEligibleGardens: {
        current: [
          {
            id: chakraGardenId,
            name: "Chakra Farm",
            location: "Quito",
            tokenAddress: sharedGardenToken,
          },
          {
            id: solarGardenId,
            name: "Solar Orchard",
            location: "Lima",
            tokenAddress: sharedGardenToken,
          },
        ],
      },
    };
  }
);

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
    useAdminStore: (
      selector: (state: {
        selectedGarden: null;
        setSelectedGarden: typeof mockSetSelectedGarden;
      }) => unknown
    ) => selector({ selectedGarden: null, setSelectedGarden: mockSetSelectedGarden }),
    useActions: () => ({ data: [] }),
    useAllAssessments: () => ({ data: [] }),
    useEligibleAdminGardens: () => ({
      eligibleGardens: mockEligibleGardens.current,
      resolvedDefaultGarden: mockEligibleGardens.current[0] ?? null,
      persistedGardenId: null,
      scopeKey: "0x123:11155111",
      canCreateGarden: true,
      isLoaded: true,
    }),
    useRole: () => ({ role: "deployer" as const }),
  };
});

import { CommandPalette } from "@/components/Layout/CommandPalette";

// ── Tests ──────────────────────────────────────────────────────────────────

describe("CommandPalette Routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEligibleGardens.current = [
      {
        id: CHAKRA_GARDEN_ID,
        name: "Chakra Farm",
        location: "Quito",
        tokenAddress: SHARED_GARDEN_TOKEN,
      },
      {
        id: SOLAR_GARDEN_ID,
        name: "Solar Orchard",
        location: "Lima",
        tokenAddress: SHARED_GARDEN_TOKEN,
      },
    ];
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  it("STATIC_ROUTES includes canonical admin surfaces", () => {
    renderWithProviders(
      <MemoryRouter>
        <CommandPalette open={true} />
      </MemoryRouter>
    );

    // The palette renders static page items when open with empty query
    expect(screen.getByText("Hub")).toBeInTheDocument();
    expect(screen.getByText("Garden")).toBeInTheDocument();
    expect(screen.getByText("Community")).toBeInTheDocument();
    expect(screen.getByText("Actions")).toBeInTheDocument();
  });

  it("typing 'Profile' navigates to /profile on mobile", async () => {
    const profileHandler = vi.fn();
    window.addEventListener(OPEN_ACCOUNT_SHEET_EVENT, profileHandler as EventListener);

    renderWithProviders(
      <MemoryRouter>
        <CommandPalette open={true} />
      </MemoryRouter>
    );

    const input = screen.getByPlaceholderText(/search/i);
    await userEvent.type(input, "Profile");

    await waitFor(
      () => {
        expect(screen.getByText("Profile")).toBeInTheDocument();
      },
      { timeout: 1000 }
    );

    const profileButton = screen.getByText("Profile").closest("button");
    expect(profileButton).toBeTruthy();
    await userEvent.click(profileButton!);

    expect(profileHandler).not.toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith("/profile");

    window.removeEventListener(OPEN_ACCOUNT_SHEET_EVENT, profileHandler as EventListener);
  });

  it("typing 'Settings' navigates to the settings tab route on mobile", async () => {
    const settingsHandler = vi.fn();
    window.addEventListener(OPEN_ACCOUNT_SHEET_EVENT, settingsHandler as EventListener);

    renderWithProviders(
      <MemoryRouter>
        <CommandPalette open={true} />
      </MemoryRouter>
    );

    const input = screen.getByPlaceholderText(/search/i);
    await userEvent.type(input, "Settings");

    await waitFor(
      () => {
        expect(screen.getByText("Settings")).toBeInTheDocument();
      },
      { timeout: 1000 }
    );

    const settingsButton = screen.getByText("Settings").closest("button");
    expect(settingsButton).toBeTruthy();
    await userEvent.click(settingsButton!);

    expect(settingsHandler).not.toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith("/profile?tab=settings");

    window.removeEventListener(OPEN_ACCOUNT_SHEET_EVENT, settingsHandler as EventListener);
  });

  it("typing 'Profile' opens the account sheet on desktop instead of navigating", async () => {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: query === "(min-width: 600px)",
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });

    const profileHandler = vi.fn();
    window.addEventListener(OPEN_ACCOUNT_SHEET_EVENT, profileHandler as EventListener);

    renderWithProviders(
      <MemoryRouter>
        <CommandPalette open={true} />
      </MemoryRouter>
    );

    const input = screen.getByPlaceholderText(/search/i);
    await userEvent.type(input, "Profile");

    await waitFor(() => {
      expect(screen.getByText("Profile")).toBeInTheDocument();
    });

    const profileButton = screen.getByText("Profile").closest("button");
    expect(profileButton).toBeTruthy();
    await userEvent.click(profileButton!);

    expect(profileHandler).toHaveBeenCalledTimes(1);
    expect(
      (profileHandler.mock.calls[0]?.[0] as CustomEvent<{ tab: "profile" | "settings" }>).detail
    ).toEqual({ tab: "profile" });
    expect(mockNavigate).not.toHaveBeenCalled();

    window.removeEventListener(OPEN_ACCOUNT_SHEET_EVENT, profileHandler as EventListener);
  });

  it("typing 'Settings' opens the settings tab sheet on desktop instead of navigating", async () => {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: query === "(min-width: 600px)",
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });

    const settingsHandler = vi.fn();
    window.addEventListener(OPEN_ACCOUNT_SHEET_EVENT, settingsHandler as EventListener);

    renderWithProviders(
      <MemoryRouter>
        <CommandPalette open={true} />
      </MemoryRouter>
    );

    const input = screen.getByPlaceholderText(/search/i);
    await userEvent.type(input, "Settings");

    await waitFor(() => {
      expect(screen.getByText("Settings")).toBeInTheDocument();
    });

    const settingsButton = screen.getByText("Settings").closest("button");
    expect(settingsButton).toBeTruthy();
    await userEvent.click(settingsButton!);

    expect(settingsHandler).toHaveBeenCalledTimes(1);
    expect(
      (settingsHandler.mock.calls[0]?.[0] as CustomEvent<{ tab: "profile" | "settings" }>).detail
    ).toEqual({ tab: "settings" });
    expect(mockNavigate).not.toHaveBeenCalled();

    window.removeEventListener(OPEN_ACCOUNT_SHEET_EVENT, settingsHandler as EventListener);
  });

  it("selecting a garden preserves the chosen garden context without forcing a share param", async () => {
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

    expect(mockSetSelectedGarden).toHaveBeenCalledWith(
      expect.objectContaining({ id: CHAKRA_GARDEN_ID, tokenAddress: SHARED_GARDEN_TOKEN })
    );
    expect(mockNavigate).toHaveBeenCalledWith(`/garden/overview?gardenAddress=${CHAKRA_GARDEN_ID}`);
  });

  it("does not expose gardens outside the eligible admin set", async () => {
    mockEligibleGardens.current = [
      {
        id: CHAKRA_GARDEN_ID,
        name: "Chakra Farm",
        location: "Quito",
        tokenAddress: SHARED_GARDEN_TOKEN,
      },
    ];

    renderWithProviders(
      <MemoryRouter>
        <CommandPalette open={true} />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Chakra Farm")).toBeInTheDocument();
    });

    expect(screen.queryByText("Solar Orchard")).not.toBeInTheDocument();
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
