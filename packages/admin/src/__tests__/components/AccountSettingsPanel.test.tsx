/** @vitest-environment happy-dom */

import messages from "@green-goods/shared/i18n/en.json";
import { fireEvent, render, screen } from "@testing-library/react";
import { IntlProvider } from "react-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AccountSettingsPanel } from "@/components/Layout/AccountSettingsPanel";

vi.mock("@green-goods/shared/hooks/app/useTheme", () => ({
  useTheme: () => ({ theme: "light", setTheme: vi.fn() }),
}));

vi.mock("@green-goods/shared/providers/App", () => ({
  useApp: () => ({ locale: "en", availableLocales: ["en"], switchLanguage: vi.fn() }),
}));

describe("AccountSettingsPanel", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("keeps documentation and community support available without a Telegram invitation", () => {
    render(
      <IntlProvider locale="en" messages={messages}>
        <AccountSettingsPanel />
      </IntlProvider>
    );

    expect(screen.getByRole("link", { name: "Support" })).toHaveAttribute(
      "href",
      "https://discord.gg/greenpill"
    );
    expect(screen.getByRole("link", { name: "Documentation" })).toHaveAttribute(
      "href",
      "https://docs.greengoods.app"
    );
    expect(
      document.querySelector('a[href^="https://t.me/"], a[href^="https://telegram.me/"]')
    ).toBeNull();
  });

  it("offers Refresh only in the installed Hub, as a plain reload that keeps the session", () => {
    const view = render(
      <IntlProvider locale="en" messages={messages}>
        <AccountSettingsPanel installed={false} />
      </IntlProvider>
    );
    // A browser tab has its own reload.
    expect(screen.queryByRole("button", { name: "Refresh the Hub" })).toBeNull();

    const reload = vi.fn();
    vi.stubGlobal("location", { ...window.location, reload });
    view.rerender(
      <IntlProvider locale="en" messages={messages}>
        <AccountSettingsPanel installed />
      </IntlProvider>
    );
    fireEvent.click(screen.getByRole("button", { name: "Refresh the Hub" }));
    expect(reload).toHaveBeenCalledOnce();
    view.unmount();

    // Left to itself, the panel asks the display mode whether the Hub is installed.
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: query === "(display-mode: standalone)",
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
    render(
      <IntlProvider locale="en" messages={messages}>
        <AccountSettingsPanel />
      </IntlProvider>
    );
    expect(screen.getByRole("button", { name: "Refresh the Hub" })).toBeInTheDocument();
  });
});
