/**
 * PublicFooter - compact footer tests.
 *
 * Locks the restored provenance line, public route links, contact link, and
 * neutral-by-default footer link styling.
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
  "public.footer.contact": "Contact",
  "public.footer.legal":
    "© {year} Green Goods. A living public record, rooted in regenerative work.",
  "public.footer.navLabel": "Footer links",
  "public.footer.wordmark": "Green Goods",
  "public.nav.actions": "Actions",
  "public.nav.fund": "Fund",
  "public.nav.gardens": "Gardens",
  "public.nav.impact": "Impact",
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

  it("renders public route links and contact", () => {
    renderFooter();

    expect(screen.getByRole("link", { name: "Gardens" })).toHaveAttribute("href", "/gardens");
    expect(screen.getByRole("link", { name: "Impact" })).toHaveAttribute("href", "/impact");
    expect(screen.getByRole("link", { name: "Fund" })).toHaveAttribute("href", "/fund");
    expect(screen.getByRole("link", { name: "Actions" })).toHaveAttribute("href", "/actions");
    expect(screen.getByRole("link", { name: "Contact" })).toHaveAttribute(
      "href",
      "mailto:afo@greenpill.builders"
    );
  });

  it("keeps footer links neutral until hover or focus", () => {
    renderFooter();

    const gardens = screen.getByRole("link", { name: "Gardens" });
    expect(gardens).toHaveClass("text-text-sub-600");
    expect(gardens).toHaveClass("hover:text-primary-action");
  });
});
