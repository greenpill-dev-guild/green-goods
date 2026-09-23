import messages from "@green-goods/shared/i18n/en.json";
import { render, screen } from "@testing-library/react";
import { IntlProvider } from "react-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { JoinGardenConfirmDialog } from "@/components/Features/Garden/JoinGardenConfirmDialog";

/** Render at phone width, where the confirmation is a bottom sheet. */
function stubPhoneViewport() {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: vi.fn((query: string) => ({
      matches: query.includes("max-width: 639px"),
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

describe("JoinGardenConfirmDialog", () => {
  const originalMatchMedia = window.matchMedia;

  beforeEach(() => {
    stubPhoneViewport();
  });

  afterEach(() => {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      configurable: true,
      value: originalMatchMedia,
    });
  });

  it("names the garden in one short sentence instead of quoting its description", () => {
    render(
      <IntlProvider locale="en" messages={messages}>
        <JoinGardenConfirmDialog
          isOpen
          gardenName="Greenpill Nigeria"
          isJoining={false}
          onClose={vi.fn()}
          onConfirm={vi.fn()}
        />
      </IntlProvider>
    );

    const sheet = screen.getByTestId("confirm-dialog");
    expect(sheet).toHaveAttribute("data-sheet-size", "compact");
    expect(screen.getByText("Join Garden")).toBeInTheDocument();
    expect(
      screen.getByText(
        "You'll join Greenpill Nigeria as a Gardener and can submit work right away."
      )
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Join" })).toBeInTheDocument();
  });
});
