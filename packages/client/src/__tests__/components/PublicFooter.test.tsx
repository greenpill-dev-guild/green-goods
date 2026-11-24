/**
 * PublicFooter - compact footer tests.
 *
 * Locks the provenance line as the footer's last line, the four outside links (Twitter,
 * LinkedIn, GitHub, Docs) on one row and Privacy, Contact and Terms of Use on the next,
 * and neutral-by-default footer link styling.
 *
 * @vitest-environment happy-dom
 */

import { fireEvent, render, screen, within } from "@testing-library/react";
import { createElement } from "react";
import { IntlProvider } from "react-intl";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

const switchLanguage = vi.fn();
vi.mock("@green-goods/shared/providers/App", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@green-goods/shared/providers/App")>()),
  useApp: () => ({ switchLanguage }),
}));

import { PublicFooter } from "../../components/Public/PublicFooter";

const messages: Record<string, string> = {
  "public.footer.docs": "Docs",
  "public.footer.privacy": "Privacy",
  "public.footer.terms": "Terms of Use",
  "public.footer.contact": "Contact",
  "public.footer.github": "GitHub",
  "public.footer.language": "Language",
  "public.footer.legal":
    "© {year} Green Goods. A living public record, rooted in regenerative work.",
  "public.footer.linkedin": "LinkedIn",
  "public.footer.navLabel": "Footer links",
  "public.footer.twitter": "Twitter",
  "public.footer.wordmark": "Green Goods",
};

function renderFooter() {
  return render(
    createElement(
      MemoryRouter,
      null,
      createElement(IntlProvider, { locale: "en", messages }, createElement(PublicFooter))
    )
  );
}

describe("PublicFooter", () => {
  it("ends the footer with the living public record message", () => {
    renderFooter();

    const message = screen.getByText(/A living public record, rooted in regenerative work/);
    const nav = screen.getByRole("navigation", { name: "Footer links" });
    // Page order is the phone's stacking order: the message comes after both link rows.
    expect(nav.compareDocumentPosition(message) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("puts outside homes in new tabs on one row and the site's own pages on the next", () => {
    renderFooter();

    const nav = screen.getByRole("navigation", { name: "Footer links" });
    const rows = within(nav)
      .getAllByRole("list")
      .map((row) =>
        within(row)
          .getAllByRole("link")
          .map((a) => [a.textContent?.trim(), a.getAttribute("href"), a.getAttribute("target")])
      );
    expect(rows).toEqual([
      [
        ["Twitter", "https://x.com/greengoodsapp", "_blank"],
        ["LinkedIn", "https://www.linkedin.com/company/greengoodsapp/", "_blank"],
        ["GitHub", "https://github.com/greenpill-dev-guild/green-goods", "_blank"],
        ["Docs", "https://docs.greengoods.app", "_blank"],
      ],
      [
        ["Privacy", "/privacy", null],
        ["Contact", "/contact", null],
        ["Terms of Use", "/terms", null],
      ],
    ]);
  });

  it("lets a visitor change the site's language, each one named in its own words", () => {
    renderFooter();

    const language = screen.getByRole("combobox", { name: "Language" });
    expect(language).toHaveValue("en");
    expect(
      within(language)
        .getAllByRole("option")
        .map((option) => option.textContent)
    ).toEqual(["English", "Português", "Español"]);
    // The App provider keeps the choice, so it stays on every public page and the next visit.
    fireEvent.change(language, { target: { value: "es" } });
    expect(switchLanguage).toHaveBeenCalledWith("es");
  });

  it("keeps footer links neutral until hover or focus", () => {
    renderFooter();

    const twitter = screen.getByRole("link", { name: "Twitter" });
    expect(twitter).toHaveClass("text-text-sub-600");
    expect(twitter).toHaveClass("hover:text-primary-action-hover");
    expect(twitter).toHaveAttribute("target", "_blank");
    expect(twitter).toHaveAttribute("rel", "noreferrer noopener");
  });
});
