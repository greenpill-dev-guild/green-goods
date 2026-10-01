/**
 * PublicFooter - compact footer tests.
 *
 * Locks the restored provenance line, external utility links (Twitter, Admin,
 * Docs, GitHub), and neutral-by-default footer link styling.
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
  "public.footer.actions": "Actions",
  "public.footer.admin": "Admin",
  "public.footer.docs": "Docs",
  "public.footer.fund": "Fund",
  "public.footer.gardens": "Gardens",
  "public.footer.github": "GitHub",
  "public.footer.impact": "Impact",
  "public.footer.legal":
    "© {year} Green Goods. A living public record, rooted in regenerative work.",
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

  it("retains core route wayfinding alongside glossary and external utilities", () => {
    renderFooter();

    const nav = screen.getByRole("navigation", { name: "Footer links" });
    const labels = Array.from(nav.querySelectorAll("a")).map((a) => a.textContent?.trim());
    expect(labels).toEqual([
      "Gardens",
      "Impact",
      "Fund",
      "Actions",
      "Glossary",
      "Twitter",
      "Admin",
      "Docs",
      "GitHub",
    ]);
    for (const route of ["Gardens", "Impact", "Fund", "Actions"]) {
      expect(screen.getByRole("link", { name: route })).toHaveAttribute(
        "href",
        `/${route.toLowerCase()}`
      );
    }
    expect(screen.getByRole("link", { name: "Glossary" })).toHaveAttribute("href", "/glossary");
  });

  it("renders external utility links", () => {
    renderFooter();

    expect(screen.getByRole("link", { name: "Twitter" })).toHaveAttribute(
      "href",
      "https://x.com/greengoodsapp"
    );
    expect(screen.getByRole("link", { name: "Admin" })).toHaveAttribute(
      "href",
      "https://admin.greengoods.app"
    );
    expect(screen.getByRole("link", { name: "Docs" })).toHaveAttribute(
      "href",
      "https://docs.greengoods.app"
    );
    expect(screen.getByRole("link", { name: "GitHub" })).toHaveAttribute(
      "href",
      "https://github.com/greenpill-dev-guild/green-goods"
    );
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
