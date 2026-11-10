import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { IntlProvider } from "react-intl";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import en from "@green-goods/shared/i18n/en.json";
import es from "@green-goods/shared/i18n/es.json";
import pt from "@green-goods/shared/i18n/pt.json";
import Strategy from "../../views/Public/Strategy";
import Privacy from "../../views/Public/Privacy";
import Contact from "../../views/Public/Contact";
import Terms from "../../views/Public/Terms";

const CATALOGS = { en, es, pt };
type Locale = keyof typeof CATALOGS;
afterEach(cleanup);

function renderPage(Page: typeof Strategy, locale: Locale = "en") {
  const messages = CATALOGS[locale];
  render(
    <IntlProvider locale={locale} messages={messages}>
      <MemoryRouter>
        <Page />
      </MemoryRouter>
    </IntlProvider>
  );
  return messages;
}

describe("public information pages", () => {
  it.each([
    [Strategy, "Growing with care"],
    [Privacy, "Your information, with care"],
    [Contact, "A person to talk to"],
    [Terms, "Share work with care"],
  ] as const)("renders English copy while the async catalogue is loading: %s", (Page, title) => {
    const onError = vi.fn();
    render(
      <IntlProvider locale="en" messages={{}} onError={onError}>
        <MemoryRouter>
          <Page />
        </MemoryRouter>
      </IntlProvider>
    );
    expect(screen.getByRole("heading", { level: 1, name: title })).toBeInTheDocument();
    // Terms reuses footer and Contact messages for its kicker and closing links.
    expect(document.body.textContent).not.toMatch(
      /public\.(strategy|privacy|contact|terms|footer)\./
    );
    expect(onError).not.toHaveBeenCalled();
  });
  it("opens the full privacy policy from the human support page", () => {
    render(
      <IntlProvider locale="en" messages={en}>
        <MemoryRouter initialEntries={["/contact"]}>
          <Routes>
            <Route path="/contact" element={<Contact />} />
            <Route path="/privacy" element={<Privacy />} />
          </Routes>
        </MemoryRouter>
      </IntlProvider>
    );
    fireEvent.click(screen.getByRole("link", { name: "Read the Privacy Policy" }));
    expect(
      screen.getByRole("heading", { level: 1, name: "Your information, with care" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Private drafts and public records" })
    ).toBeInTheDocument();
  });
  it.each([
    "en",
    "es",
    "pt",
  ] as const)("shows dated priorities, honest statuses and reviewed materials in %s", (locale) => {
    const messages = renderPage(Strategy, locale);
    expect(
      screen.getByRole("heading", { level: 1, name: messages["public.strategy.title"] })
    ).toBeInTheDocument();
    expect(document.querySelector("time")).toHaveAttribute("dateTime", "2026-11-04");
    for (const priority of ["delivery", "integrations", "business", "mentorship"] as const) {
      expect(
        screen.getByRole("heading", { name: messages[`public.strategy.${priority}.title`] })
      ).toBeInTheDocument();
      expect(
        screen.getByText(messages[`public.strategy.${priority}.dependency`])
      ).toBeInTheDocument();
    }
    for (const month of ["october", "november", "december"] as const) {
      expect(
        screen.getByRole("heading", { name: messages[`public.strategy.${month}.title`] })
      ).toBeInTheDocument();
      expect(screen.getByText(messages[`public.strategy.${month}.status`])).toBeInTheDocument();
    }
    const materials = screen.getByRole("region", {
      name: messages["public.strategy.materials.title"],
    });
    expect(
      within(materials)
        .getAllByRole("link")
        .map((link) => link.getAttribute("href"))
    ).toEqual([
      "https://drive.google.com/file/d/1OU4Flit-Nq8oHVuPMf5tfu5_AM2R2cD_/view",
      "https://drive.google.com/file/d/1IUHAB8pjaJLAPcNUMV4oUvnUhzX-zyo9/view",
      "https://drive.google.com/file/d/1YzGMk5sDmh_PN8_jstYPmbpWUHm4_LUa/view",
      "https://drive.google.com/file/d/1EFV79GLzQ7-88E1Ngv0RZwPy-hvHD_2l/view",
      "https://drive.google.com/file/d/1WeOr5i7OL1gZqJN3SyNEl0e7ByMhf1Sw/view",
    ]);
    expect(
      screen.getByRole("link", { name: messages["public.strategy.next.contact"] })
    ).toHaveAttribute("href", "mailto:contact@greengoods.app");
    expect(screen.queryByRole("link", { name: /demo/i })).not.toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/\$800|\$1200|25k|100k|Appendix [BC]/);
    expect(document.querySelector('a[href*="docs.google.com/document"]')).toBeNull();
  });

  it.each([
    "en",
    "es",
    "pt",
  ] as const)("makes consent, publication limits, providers and deletion discoverable in %s", (locale) => {
    const messages = renderPage(Privacy, locale);
    expect(
      screen.getByRole("heading", { level: 1, name: messages["public.privacy.title"] })
    ).toBeInTheDocument();
    for (const topic of [
      "consent",
      "publication",
      "providers",
      "retention",
      "analytics",
      "successor",
    ] as const) {
      expect(
        screen.getByRole("heading", { name: messages[`public.privacy.${topic}.title`] })
      ).toBeInTheDocument();
      expect(screen.getByText(messages[`public.privacy.${topic}.body`])).toBeInTheDocument();
    }
    expect(document.body.textContent).toMatch(/STOP/);
    expect(document.body.textContent).toMatch(/START/);
    expect(document.body.textContent).toMatch(/DELETE/);
    expect(document.body.textContent).toMatch(/30/);
    expect(document.body.textContent).toMatch(/IPFS/);
    expect(document.body.textContent).toMatch(/Sentry/);
    // The policy ends on one act: an email to the support mailbox with its subject filled in.
    const policy = screen.getByRole("article");
    expect(within(policy).getAllByRole("link")).toHaveLength(1);
    expect(
      within(policy).getByRole("link", { name: messages["public.privacy.request"] })
    ).toHaveAttribute(
      "href",
      "mailto:contact@greengoods.app?subject=Green%20Goods%20privacy%20request"
    );
  });

  it.each([
    "en",
    "es",
    "pt",
  ] as const)("offers a person, the support mailbox, the strategy and the privacy policy in %s", (locale) => {
    const messages = renderPage(Contact, locale);
    expect(
      screen.getByRole("heading", { level: 1, name: messages["public.contact.title"] })
    ).toBeInTheDocument();
    expect(screen.getByText(messages["public.contact.people.body"])).toBeInTheDocument();
    expect(screen.getByText(messages["public.contact.people.body"])).toHaveTextContent(/Afolabi/);
    expect(screen.getByText(messages["public.contact.people.body"])).toHaveTextContent(/Matt/);
    expect(screen.getByRole("link", { name: "contact@greengoods.app" })).toHaveAttribute(
      "href",
      "mailto:contact@greengoods.app"
    );
    // The site's menus leave Strategy out, so Contact links to it for partners.
    expect(
      screen.getByRole("link", { name: messages["public.contact.strategy.link"] })
    ).toHaveAttribute("href", "/strategy");
    expect(
      screen.getByRole("link", { name: messages["public.contact.privacy.link"] })
    ).toHaveAttribute("href", "/privacy");
  });
});
