/**
 * Wallet drawer icon tests
 *
 * @vitest-environment jsdom
 */

import { render, screen } from "@testing-library/react";
import { createElement } from "react";
import { IntlProvider } from "react-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockUseAccessibleCookieJars = vi.fn();

vi.mock("@green-goods/shared", async () => {
  const actual = await vi.importActual<typeof import("@green-goods/shared")>("@green-goods/shared");

  return {
    ...actual,
    useAccessibleCookieJars: () => mockUseAccessibleCookieJars(),
  };
});

import { WalletDrawerIcon } from "../../views/Home/WalletDrawer/Icon";

const messages: Record<string, string> = {
  "app.cookieJar.wallet": "Wallet",
  "app.cookieJar.walletWithCount":
    "Wallet, {count, plural, one {# accessible cookie jar} other {# accessible cookie jars}}",
};

function renderView() {
  return render(
    createElement(
      IntlProvider,
      { locale: "en", messages },
      createElement(WalletDrawerIcon, { onClick: vi.fn() })
    )
  );
}

describe("WalletDrawerIcon", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAccessibleCookieJars.mockReturnValue({ jars: [] });
  });

  it("hides the badge when there are no accessible jars", () => {
    renderView();
    expect(screen.queryByTestId("wallet-badge")).not.toBeInTheDocument();
  });

  it("shows the accessible jar count in the badge", () => {
    mockUseAccessibleCookieJars.mockReturnValue({
      jars: [
        { jarAddress: "0x1", balance: 0n },
        { jarAddress: "0x2", balance: 12n },
      ],
    });

    renderView();

    expect(
      screen.getByRole("button", { name: "Wallet, 2 accessible cookie jars" })
    ).toBeInTheDocument();
    expect(screen.getByTestId("wallet-badge")).toHaveTextContent("2");
  });
});
