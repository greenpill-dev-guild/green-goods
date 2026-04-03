/**
 * SettingsSheet Tests
 * @vitest-environment jsdom
 */

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

import { SettingsSheet } from "@/components/Layout/SettingsSheet";
import userEvent from "@testing-library/user-event";

describe("SettingsSheet", () => {
  const onClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the settings title in the side sheet header", () => {
    renderWithProviders(<SettingsSheet open onClose={onClose} />);

    expect(screen.getByText("Settings")).toBeInTheDocument();
  });

  it("renders user profile section with role badge and address", () => {
    renderWithProviders(<SettingsSheet open onClose={onClose} />);

    // Section header
    expect(screen.getByText("Profile")).toBeInTheDocument();
    // Role badge
    expect(screen.getByText("operator")).toBeInTheDocument();
  });

  it("renders theme selector with three options", () => {
    renderWithProviders(<SettingsSheet open onClose={onClose} />);

    expect(screen.getByText("Theme")).toBeInTheDocument();
    expect(screen.getByText("Light")).toBeInTheDocument();
    expect(screen.getByText("Dark")).toBeInTheDocument();
    expect(screen.getByText("System")).toBeInTheDocument();
  });

  it("highlights the active theme option", () => {
    renderWithProviders(<SettingsSheet open onClose={onClose} />);

    const darkButton = screen.getByRole("button", { name: /dark/i });
    expect(darkButton.className).toMatch(/bg-primary-alpha-10/);
  });

  it("calls setTheme when a theme option is clicked", async () => {
    const user = userEvent.setup();
    renderWithProviders(<SettingsSheet open onClose={onClose} />);

    await user.click(screen.getByRole("button", { name: /light/i }));
    expect(mockSetTheme).toHaveBeenCalledWith("light");
  });

  it("renders chain info section with chain name", () => {
    renderWithProviders(<SettingsSheet open onClose={onClose} />);

    expect(screen.getByText("Network")).toBeInTheDocument();
    expect(screen.getByText("Sepolia")).toBeInTheDocument();
  });

  it("renders disconnect button and calls signOut on click", async () => {
    const user = userEvent.setup();
    renderWithProviders(<SettingsSheet open onClose={onClose} />);

    const disconnectButton = screen.getByRole("button", { name: /disconnect/i });
    expect(disconnectButton).toBeInTheDocument();

    await user.click(disconnectButton);
    expect(mockSignOut).toHaveBeenCalled();
  });

  it("does not render content when closed", () => {
    renderWithProviders(<SettingsSheet open={false} onClose={onClose} />);

    expect(screen.queryByText("Settings")).not.toBeInTheDocument();
  });
});
