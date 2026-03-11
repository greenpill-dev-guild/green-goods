/**
 * AccountInfo passkey persistence warning tests
 * @vitest-environment jsdom
 */

import { cleanup, render, screen } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { IntlProvider } from "react-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let mockAuthMode: "passkey" | "wallet" | "embedded" | null = "passkey";
const mockSignOut = vi.fn();

vi.mock("@green-goods/shared", () => ({
  useAuth: () => ({
    authMode: mockAuthMode,
    signOut: mockSignOut,
    smartAccountAddress: "0x1234567890123456789012345678901234567890",
    walletAddress: null,
    credential: { id: "test-cred" },
  }),
  useEnsName: () => ({ data: null }),
  debugError: vi.fn(),
  hapticLight: vi.fn(),
  toastService: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("react-router-dom", () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock("@/components/Actions", () => ({
  Button: ({ label }: { label: string }) => createElement("button", null, label),
}));

vi.mock("@/components/Cards", () => ({
  Card: ({ children }: { children: ReactNode }) => createElement("div", null, children),
}));

vi.mock("@/components/Display", () => ({
  Avatar: ({ children }: { children: ReactNode }) => createElement("div", null, children),
}));

vi.mock("@/components/Inputs", () => ({
  AddressCopy: () => createElement("span", null, "address-copy"),
}));

import messages from "../../../../shared/src/i18n/en.json";
import { AccountInfo } from "../../views/Profile/AccountInfo";

function renderAccountInfo() {
  return render(
    createElement(IntlProvider, { locale: "en", messages }, createElement(AccountInfo))
  );
}

describe("AccountInfo passkey warning", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthMode = "passkey";
  });

  afterEach(() => {
    cleanup();
  });

  it("shows passkey persistence warning when authMode is passkey", () => {
    renderAccountInfo();

    expect(screen.getByText("Passkey stored locally")).toBeInTheDocument();
    expect(screen.getByText(/Your passkey is stored on this device/)).toBeInTheDocument();
    expect(screen.getByText(/For persistent access across devices/)).toBeInTheDocument();
  });

  it("does not show passkey warning when authMode is wallet", () => {
    mockAuthMode = "wallet";
    renderAccountInfo();

    expect(screen.queryByText("Passkey stored locally")).not.toBeInTheDocument();
  });

  it("does not show passkey warning when authMode is null", () => {
    mockAuthMode = null;
    renderAccountInfo();

    expect(screen.queryByText("Passkey stored locally")).not.toBeInTheDocument();
  });

  it("places the warning before the logout button", () => {
    renderAccountInfo();

    const warning = screen.getByText("Passkey stored locally");
    const logoutButton = screen.getByText("Logout");

    // Warning should appear before logout in DOM order
    const allElements = document.body.querySelectorAll("*");
    let warningIndex = -1;
    let logoutIndex = -1;
    allElements.forEach((el, i) => {
      if (el === warning) warningIndex = i;
      if (el === logoutButton) logoutIndex = i;
    });

    expect(warningIndex).toBeGreaterThan(-1);
    expect(logoutIndex).toBeGreaterThan(-1);
    expect(warningIndex).toBeLessThan(logoutIndex);
  });
});
