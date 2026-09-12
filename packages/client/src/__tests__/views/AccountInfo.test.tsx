/**
 * AccountInfo passkey recovery note tests
 * @vitest-environment jsdom
 */

import { cleanup, render, screen } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { IntlProvider } from "react-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let mockAuthMode: "passkey" | "wallet" | "embedded" | null = "passkey";
let mockSmartAccountAddress: string | null = "0x1234567890123456789012345678901234567890";
let mockWalletAddress: string | null = null;
let mockEmbeddedAddress: string | null = null;
let mockUserName: string | null = "alice";
let mockPasskeyServerEnabled = true;
const mockSignOut = vi.fn();

vi.mock("@green-goods/shared/config/passkeyServer", () => ({
  isPasskeyServerEnabled: () => mockPasskeyServerEnabled,
}));

vi.mock("@green-goods/shared/hooks/auth/useAuth", () => ({
  useAuthState: () => ({
    authMode: mockAuthMode,
    credential: { id: "test-cred" },
    walletAddress: mockWalletAddress,
    embeddedAddress: mockEmbeddedAddress,
    userName: mockUserName,
  }),
  useAuthActions: () => ({
    signOut: mockSignOut,
  }),
}));

vi.mock("@green-goods/shared/hooks/auth/usePrimaryAddress", () => ({
  usePrimaryAddress: () => mockSmartAccountAddress || mockWalletAddress || mockEmbeddedAddress,
}));

vi.mock("@green-goods/shared/hooks/blockchain/useEnsName", () => ({
  useEnsName: () => ({ data: null }),
}));

vi.mock("@green-goods/shared/utils/debug", () => ({
  debugError: vi.fn(),
}));

vi.mock("@green-goods/shared/utils/app/haptics", () => ({
  hapticLight: vi.fn(),
}));

vi.mock("@green-goods/shared/components/Toast/toast.service", () => ({
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

import messages from "@green-goods/shared/i18n/en.json";
import { AccountInfo } from "../../views/Profile/AccountInfo";

function renderAccountInfo() {
  return render(
    createElement(IntlProvider, { locale: "en", messages }, createElement(AccountInfo))
  );
}

describe("AccountInfo passkey recovery note", () => {
  const deviceLine =
    "To sign in on another device, choose “Already have an account?” and enter alice.";
  const genericLine =
    "To sign in on another device, choose “Already have an account?” and enter your username.";
  const accountLine =
    "Your passkey is saved in your Apple or Google account, so that device needs to be signed in to the same account.";

  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthMode = "passkey";
    mockSmartAccountAddress = "0x1234567890123456789012345678901234567890";
    mockWalletAddress = null;
    mockEmbeddedAddress = null;
    mockUserName = "alice";
    mockPasskeyServerEnabled = true;
  });

  afterEach(() => {
    cleanup();
  });

  it("names the gardener's own username and the account condition on a passkey session", () => {
    renderAccountInfo();

    expect(screen.getByText(deviceLine)).toBeInTheDocument();
    expect(screen.getByText(accountLine)).toBeInTheDocument();
  });

  it("falls back to a generic username line when no name is stored", () => {
    mockUserName = null;
    renderAccountInfo();

    expect(screen.getByText(genericLine)).toBeInTheDocument();
    expect(screen.getByText(accountLine)).toBeInTheDocument();
  });

  it("stays hidden when the passkey server lookup is off", () => {
    // Without the server the sign-in screen has no username door to point at.
    mockPasskeyServerEnabled = false;
    renderAccountInfo();

    expect(screen.queryByText(deviceLine)).not.toBeInTheDocument();
    expect(screen.queryByText(accountLine)).not.toBeInTheDocument();
  });

  it("does not show the note when authMode is wallet", () => {
    mockAuthMode = "wallet";
    renderAccountInfo();

    expect(screen.queryByText(deviceLine)).not.toBeInTheDocument();
  });

  it("does not show the note when authMode is null", () => {
    mockAuthMode = null;
    mockSmartAccountAddress = null;
    renderAccountInfo();

    expect(screen.queryByText(deviceLine)).not.toBeInTheDocument();
  });

  it("shows connected wallet state for embedded auth", () => {
    mockAuthMode = "embedded";
    mockSmartAccountAddress = null;
    mockEmbeddedAddress = "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd";
    renderAccountInfo();

    expect(screen.getByText("Wallet")).toBeInTheDocument();
    expect(screen.getByText("Connected")).toBeInTheDocument();
    expect(screen.getByText("address-copy")).toBeInTheDocument();
    expect(screen.queryByText(deviceLine)).not.toBeInTheDocument();
  });

  it("places the note before the logout button", () => {
    renderAccountInfo();

    const note = screen.getByText(deviceLine);
    const logoutButton = screen.getByText("Logout");

    // The note should appear before logout in DOM order
    const allElements = document.body.querySelectorAll("*");
    let noteIndex = -1;
    let logoutIndex = -1;
    allElements.forEach((el, i) => {
      if (el === note) noteIndex = i;
      if (el === logoutButton) logoutIndex = i;
    });

    expect(noteIndex).toBeGreaterThan(-1);
    expect(logoutIndex).toBeGreaterThan(-1);
    expect(noteIndex).toBeLessThan(logoutIndex);
  });
});
