/**
 * PublicFooter - compact footer tests.
 *
 * Locks the restored provenance line, the four outside links (Twitter, LinkedIn,
 * GitHub, Docs), privacy/contact discoverability, and neutral-by-default footer link styling.
 *
 * @vitest-environment happy-dom
 */

import { render, screen } from "@testing-library/react";
import { createElement } from "react";
import { IntlProvider } from "react-intl";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { PublicFooter } from "../../components/Public/PublicFooter";

const messages: Record<string, string> = {
  "public.footer.docs": "Docs",
  "public.footer.privacy": "Privacy",
  "public.footer.contact": "Contact",
  "public.footer.github": "GitHub",
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
  it("restores the living public record footer message", () => {
    renderFooter();

    expect(
      screen.getByText(/A living public record, rooted in regenerative work/)
    ).toBeInTheDocument();
  });

  it("keeps outside homes in new tabs and privacy/contact in the site", () => {
    renderFooter();

    const nav = screen.getByRole("navigation", { name: "Footer links" });
    const links = Array.from(nav.querySelectorAll("a")).map((a) => [
      a.textContent?.trim(),
      a.getAttribute("href"),
      a.getAttribute("target"),
    ]);
    expect(links).toEqual([
      ["Twitter", "https://x.com/greengoodsapp", "_blank"],
      ["LinkedIn", "https://www.linkedin.com/company/greengoodsapp/", "_blank"],
      ["GitHub", "https://github.com/greenpill-dev-guild/green-goods", "_blank"],
      ["Docs", "https://docs.greengoods.app", "_blank"],
      ["Privacy", "/privacy", null],
      ["Contact", "/contact", null],
    ]);
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
