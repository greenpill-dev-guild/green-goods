/**
 * Wallet drawer icon tests
 *
 * @vitest-environment happy-dom
 */

import { render, screen, waitFor } from "@testing-library/react";
import { createElement } from "react";
import { IntlProvider } from "react-intl";
import { describe, expect, it, vi } from "vitest";

import { WalletSheetIcon } from "../../views/Home/WalletSheet/Icon";

// The launcher waits for the sheet's code (DL-132); the test stands in for that fetch.
vi.mock("../../views/Home/DeferredSurfaces", () => ({
  preloadWalletSheet: () => Promise.resolve(),
}));

const messages: Record<string, string> = {
  "app.wallet.title": "Your Wallet",
};

function renderView() {
  return render(
    createElement(
      IntlProvider,
      { locale: "en", messages },
      createElement(WalletSheetIcon, { onClick: vi.fn() })
    )
  );
}

describe("WalletSheetIcon", () => {
  it("renders the wallet trigger without a badge, enabled once its sheet's code is cached (DL-132)", async () => {
    renderView();
    const trigger = screen.getByRole("button", { name: "Your Wallet" });
    expect(trigger).toBeDisabled();
    expect(trigger).toHaveAttribute("aria-busy", "true");
    await waitFor(() => expect(trigger).toBeEnabled());
    expect(trigger).not.toHaveAttribute("aria-busy", "true");
    expect(screen.queryByTestId("wallet-badge")).not.toBeInTheDocument();
  });
});
