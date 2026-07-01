/**
 * Wallet drawer icon tests
 *
 * @vitest-environment jsdom
 */

import { render, screen } from "@testing-library/react";
import { createElement } from "react";
import { IntlProvider } from "react-intl";
import { describe, expect, it, vi } from "vitest";

import { WalletDrawerIcon } from "../../views/Home/WalletDrawer/Icon";

const messages: Record<string, string> = {
  "app.wallet.title": "Your Wallet",
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
  it("renders the wallet trigger without a notification badge", () => {
    renderView();
    expect(screen.getByRole("button", { name: "Your Wallet" })).toBeInTheDocument();
    expect(screen.queryByTestId("wallet-badge")).not.toBeInTheDocument();
  });
});
