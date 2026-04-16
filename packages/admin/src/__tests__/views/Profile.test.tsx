/**
 * Profile View Tests
 * @vitest-environment jsdom
 */

import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen, waitFor } from "../test-utils";

const mockSignOut = vi.fn();
const mockSetTheme = vi.fn();

vi.mock("@green-goods/shared", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@green-goods/shared")>();
  return {
    ...actual,
    useAuth: () => ({
      signOut: mockSignOut,
      eoaAddress: "0x1234567890123456789012345678901234567890",
    }),
    useAuthState: () => ({
      eoaAddress: "0x1234567890123456789012345678901234567890",
    }),
    useAuthActions: () => ({
      signOut: mockSignOut,
    }),
    useEnsAvatar: () => ({ data: null }),
    useEnsName: () => ({ data: null }),
    useRole: () => ({ role: "operator" }),
    useTheme: () => ({
      theme: "dark" as const,
      isDark: true,
      setTheme: mockSetTheme,
      toggleTheme: vi.fn(),
    }),
    DEFAULT_CHAIN_ID: 11155111,
    getChainName: (id: number) => (id === 11155111 ? "Sepolia" : "Unknown"),
  };
});

import ProfileView from "@/views/Profile";

function LocationDisplay() {
  const location = useLocation();
  return <div data-testid="location">{`${location.pathname}${location.search}`}</div>;
}

describe("ProfileView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

  it("renders the profile tab by default on mobile", () => {
    renderWithProviders(
      <MemoryRouter initialEntries={["/profile"]}>
        <Routes>
          <Route
            path="/profile"
            element={
              <>
                <ProfileView />
                <LocationDisplay />
              </>
            }
          />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByRole("tab", { name: "Profile" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("operator")).toBeInTheDocument();
    expect(screen.getByTestId("location")).toHaveTextContent("/profile");
  });

  it("renders the settings tab when requested by query param", () => {
    renderWithProviders(
      <MemoryRouter initialEntries={["/profile?tab=settings"]}>
        <Routes>
          <Route
            path="/profile"
            element={
              <>
                <ProfileView />
                <LocationDisplay />
              </>
            }
          />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByRole("tab", { name: "Settings" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("Theme")).toBeInTheDocument();
    expect(screen.getByTestId("location")).toHaveTextContent("/profile?tab=settings");
  });

  it("switches tabs by rewriting the route search state", async () => {
    const user = userEvent.setup();

    renderWithProviders(
      <MemoryRouter initialEntries={["/profile"]}>
        <Routes>
          <Route
            path="/profile"
            element={
              <>
                <ProfileView />
                <LocationDisplay />
              </>
            }
          />
        </Routes>
      </MemoryRouter>
    );

    await user.click(screen.getByRole("tab", { name: "Settings" }));

    await waitFor(() => {
      expect(screen.getByTestId("location")).toHaveTextContent("/profile?tab=settings");
    });

    await user.click(screen.getByRole("tab", { name: "Profile" }));

    await waitFor(() => {
      expect(screen.getByTestId("location")).toHaveTextContent("/profile");
    });
  });
});
