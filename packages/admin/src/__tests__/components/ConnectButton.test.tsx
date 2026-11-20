import { fireEvent, render, screen } from "@testing-library/react";
import { IntlProvider } from "react-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConnectButton } from "@/components/ConnectButton";

const mockLoginWithWallet = vi.fn();
const mockOpen = vi.fn();
const mockUseAccount = vi.fn();
const mockUseAuthState = vi.fn();
const mockWalletModalOpen = vi.fn();

vi.mock("@green-goods/shared/hooks/auth/useAuth", () => ({
  useAuth: () => ({ loginWithWallet: mockLoginWithWallet }),
}));

vi.mock("@green-goods/shared/providers/Auth", () => ({
  useAuthActions: () => ({ loginWithWallet: mockLoginWithWallet }),
  useAuthState: () => mockUseAuthState(),
}));

vi.mock("@green-goods/shared/utils/styles/cn", () => ({
  cn: (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(" "),
}));

vi.mock("@reown/appkit/react", () => ({
  useAppKit: () => ({ open: mockOpen }),
}));

vi.mock("wagmi", () => ({
  useAccount: () => mockUseAccount(),
}));

vi.mock("@green-goods/shared/hooks/auth/useWalletModalOpen", () => ({
  useWalletModalOpen: () => mockWalletModalOpen(),
}));

function renderWithIntl(ui: React.ReactElement) {
  return render(
    <IntlProvider locale="en" messages={{}}>
      {ui}
    </IntlProvider>
  );
}

describe("ConnectButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuthState.mockReturnValue({ walletReleaseStalled: false });
    mockWalletModalOpen.mockReturnValue(false);
    mockUseAccount.mockReturnValue({
      isConnecting: false,
    });
  });

  it("spins only while the wallet modal is open, so a closed modal never leaves it stuck", () => {
    // wagmi kept isConnecting true for about a minute after a phone wallet's modal closed,
    // and a loading button ignores taps (PRD-1491).
    mockUseAccount.mockReturnValue({ isConnecting: true });
    mockWalletModalOpen.mockReturnValue(true);
    const { rerender } = renderWithIntl(<ConnectButton />);
    expect(screen.getByTestId("connect-wallet-button")).toHaveAttribute("aria-busy", "true");

    mockWalletModalOpen.mockReturnValue(false);
    rerender(
      <IntlProvider locale="en" messages={{}}>
        <ConnectButton />
      </IntlProvider>
    );
    const button = screen.getByTestId("connect-wallet-button");
    expect(button).not.toHaveAttribute("aria-busy", "true");
    fireEvent.click(button);
    expect(mockLoginWithWallet).toHaveBeenCalledOnce();
  });

  it("keeps an explicit reload action available while the old connector remains pending", () => {
    mockUseAccount.mockReturnValue({ isConnecting: true });
    mockUseAuthState.mockReturnValue({ walletReleaseStalled: true });
    renderWithIntl(<ConnectButton />);
    const reload = screen.getByRole("button", { name: "Reload to retry wallet" });
    expect(reload).toBeEnabled();
    fireEvent.click(reload);
    expect(mockLoginWithWallet).toHaveBeenCalledOnce();
  });

  it("routes wallet connection through shared auth", () => {
    renderWithIntl(<ConnectButton />);

    fireEvent.click(screen.getByTestId("connect-wallet-button"));

    expect(mockLoginWithWallet).toHaveBeenCalledTimes(1);
    expect(mockOpen).not.toHaveBeenCalled();
  });
});
