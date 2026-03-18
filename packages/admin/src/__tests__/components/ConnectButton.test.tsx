import { fireEvent, render, screen } from "@testing-library/react";
import { IntlProvider } from "react-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConnectButton } from "@/components/ConnectButton";

const mockLoginWithWallet = vi.fn();
const mockUseAuth = vi.fn();
const mockOpen = vi.fn();
const mockUseAccount = vi.fn();

vi.mock("@green-goods/shared", () => ({
  cn: (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(" "),
  useAuth: () => mockUseAuth(),
}));

vi.mock("@reown/appkit/react", () => ({
  useAppKit: () => ({ open: mockOpen }),
}));

vi.mock("wagmi", () => ({
  useAccount: () => mockUseAccount(),
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
    mockUseAuth.mockReturnValue({
      loginWithWallet: mockLoginWithWallet,
    });
    mockUseAccount.mockReturnValue({
      isConnecting: false,
    });
  });

  it("routes wallet connection through shared auth", () => {
    renderWithIntl(<ConnectButton />);

    fireEvent.click(screen.getByTestId("connect-wallet-button"));

    expect(mockLoginWithWallet).toHaveBeenCalledTimes(1);
    expect(mockOpen).not.toHaveBeenCalled();
  });
});
