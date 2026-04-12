/**
 * AccountSheet Tests
 * @vitest-environment jsdom
 */

import { useState } from "react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen } from "../test-utils";

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

import { AccountSheet } from "@/components/Layout/AccountSheet";

interface AccountSheetHarnessProps {
  initialTab?: "profile" | "settings";
  open?: boolean;
}

function AccountSheetHarness({ initialTab = "profile", open = true }: AccountSheetHarnessProps) {
  const [tab, setTab] = useState(initialTab);

  return <AccountSheet open={open} activeTab={tab} onTabChange={setTab} onClose={() => {}} />;
}

describe("AccountSheet", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the profile tab content by default", () => {
    renderWithProviders(<AccountSheetHarness />);

    expect(screen.getByRole("tab", { name: "Profile" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("operator")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Wallet" })).toBeInTheDocument();
  });

  it("switches to the settings tab and renders preferences content", async () => {
    const user = userEvent.setup();

    renderWithProviders(<AccountSheetHarness />);

    await user.click(screen.getByRole("tab", { name: "Settings" }));

    expect(screen.getByText("Theme")).toBeInTheDocument();
    expect(screen.getByText("Network")).toBeInTheDocument();
    expect(screen.getByText("Sepolia")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /disconnect/i })).toBeInTheDocument();
  });

  it("calls setTheme when a theme option is clicked", async () => {
    const user = userEvent.setup();

    renderWithProviders(<AccountSheetHarness initialTab="settings" />);

    await user.click(screen.getByRole("button", { name: /light/i }));

    expect(mockSetTheme).toHaveBeenCalledWith("light");
  });

  it("calls signOut from the settings tab", async () => {
    const user = userEvent.setup();

    renderWithProviders(<AccountSheetHarness initialTab="settings" />);

    await user.click(screen.getByRole("button", { name: /disconnect/i }));

    expect(mockSignOut).toHaveBeenCalled();
  });

  it("does not render content when closed", () => {
    renderWithProviders(<AccountSheetHarness open={false} />);

    expect(screen.queryByText("Profile")).not.toBeInTheDocument();
    expect(screen.queryByText("Settings")).not.toBeInTheDocument();
  });
});
