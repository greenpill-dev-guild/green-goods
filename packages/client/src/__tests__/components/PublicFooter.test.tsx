/**
 * PublicFooter - compact footer tests.
 *
 * Locks the restored provenance line, external utility links (Twitter, Admin,
 * Docs, GitHub), and neutral-by-default footer link styling.
 *
 * @vitest-environment jsdom
 */

import { render, screen } from "@testing-library/react";
import { createElement } from "react";
import { IntlProvider } from "react-intl";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { PublicFooter } from "../../components/Public/PublicFooter";

const messages: Record<string, string> = {
  "public.footer.admin": "Admin",
  "public.footer.docs": "Docs",
  "public.footer.github": "GitHub",
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
