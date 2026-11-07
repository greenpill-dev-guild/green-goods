// TEST-QUALITY: allow-small-test-file - One localized support contract needs a direct rendered seam.
import en from "@green-goods/shared/i18n/en.json";
import es from "@green-goods/shared/i18n/es.json";
import pt from "@green-goods/shared/i18n/pt.json";
import { cleanup, render, screen } from "@testing-library/react";
import { IntlProvider } from "react-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FocusedAccountSheet } from "../../components/Navigation/FocusedAccountSheet";

afterEach(cleanup);

describe("FocusedAccountSheet support", () => {
  it.each([
    ["en", en, "Email Green Goods", "Privacy Policy"],
    ["es", es, "Escribir a Green Goods", "Política de privacidad"],
    ["pt", pt, "Enviar e-mail ao Green Goods", "Política de privacidade"],
  ] as const)("offers the support mailbox and privacy notice in %s", (locale, messages, email, privacy) => {
    render(
      <IntlProvider locale={locale} messages={messages}>
        <FocusedAccountSheet
          open
          onOpenChange={vi.fn()}
          accountRef={vi.fn()}
          pageSaysAccount={false}
        />
      </IntlProvider>
    );

    const contact = screen.getByRole("link", { name: `${email} contact@greengoods.app` });
    expect(contact).toHaveAttribute("href", "mailto:contact@greengoods.app");
    expect(contact).not.toHaveAttribute("target");
    const notice = screen.getByRole("link", { name: new RegExp(privacy) });
    expect(notice).toHaveAttribute("href", "/privacy");
    expect(notice).toHaveAttribute("target", "_blank");
    expect(notice).toHaveAttribute("rel", "noopener noreferrer");
  });
});
