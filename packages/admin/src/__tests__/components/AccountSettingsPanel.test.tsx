/** @vitest-environment happy-dom */
// TEST-QUALITY: allow-small-test-file - Protects the account settings support destination after the public Telegram group closes.

import messages from "@green-goods/shared/i18n/en.json";
import { render, screen } from "@testing-library/react";
import { IntlProvider } from "react-intl";
import { describe, expect, it, vi } from "vitest";
import { AccountSettingsPanel } from "@/components/Layout/AccountSettingsPanel";

vi.mock("@green-goods/shared/hooks/app/useTheme", () => ({
  useTheme: () => ({ theme: "light", setTheme: vi.fn() }),
}));

vi.mock("@green-goods/shared/providers/App", () => ({
  useApp: () => ({ locale: "en", availableLocales: ["en"], switchLanguage: vi.fn() }),
}));

describe("AccountSettingsPanel", () => {
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
});
