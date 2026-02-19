import { render, screen } from "@testing-library/react";
import { IntlProvider } from "react-intl";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import Login from "@/views/Login";

const mockUseAccount = vi.fn();

vi.mock("wagmi", () => ({
  useAccount: () => mockUseAccount(),
}));

vi.mock("@/components/ConnectButton", () => ({
  ConnectButton: ({ className }: { className?: string }) => (
    <button className={className} type="button">
      Connect Wallet
    </button>
  ),
}));

describe("Admin Login", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAccount.mockReturnValue({
      address: undefined,
      isConnected: false,
    });
    delete (window as { ethereum?: unknown }).ethereum;
  });

  it("shows wallet extension guidance when no provider is available", () => {
    render(
      <IntlProvider locale="en" messages={{}}>
        <MemoryRouter>
          <Login />
        </MemoryRouter>
      </IntlProvider>
    );

    expect(screen.getByText("No wallet extension detected")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "MetaMask" })).toHaveAttribute(
      "href",
      "https://metamask.io/download/"
    );
    expect(screen.getByRole("link", { name: "Rabby" })).toHaveAttribute(
      "href",
      "https://rabby.io/"
    );
  });

  it("does not show extension guidance when MetaMask is detected", () => {
    (window as { ethereum?: { isMetaMask?: boolean } }).ethereum = { isMetaMask: true };

    render(
      <IntlProvider locale="en" messages={{}}>
        <MemoryRouter>
          <Login />
        </MemoryRouter>
      </IntlProvider>
    );

    expect(screen.queryByText("No wallet extension detected")).not.toBeInTheDocument();
  });
});
