/**
 * PublicFundingBridge - homepage funding explanation tests.
 *
 * Locks the cardless trust section after the regenerative work loop:
 * - Donate maps to Cookie Jar direct support.
 * - Endow maps to Garden Vault support over time.
 * - The only action routes to /fund.
 *
 * @vitest-environment jsdom
 */

import { render, screen } from "@testing-library/react";
import { createElement } from "react";
import { IntlProvider } from "react-intl";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

vi.mock("@green-goods/shared", () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(" "),
  useInViewReveal: () => ({ ref: () => undefined, revealed: true }),
}));

import { PublicFundingBridge } from "../../components/Public/PublicFundingBridge";

const messages: Record<string, string> = {
  "public.home.funding.body":
    "Green Goods gives funders two protocol paths: direct support for verified Work, or a Vault position designed so yield can keep supporting a Garden over time.",
  "public.home.funding.cta": "Support Gardens",
  "public.home.funding.donateBody":
    "Send direct support through a Garden's Cookie Jar for verified regenerative Work.",
  "public.home.funding.donateTitle": "Donate",
  "public.home.funding.endowBody":
    "Deposit into a Garden Vault designed to preserve principal while yield supports the Garden.",
  "public.home.funding.endowTitle": "Endow",
  "public.home.funding.kicker": "§ 04: Support Gardens",
  "public.home.funding.note":
    "Donate and Endow support the Garden directly. They are not tax-deductible, charitable, or nonprofit-backed unless separately configured. Vaults also carry smart contract, token, yield, provider, and wallet recovery risk.",
  "public.home.funding.notePrefix": "note",
  "public.home.funding.title": "Direct support today. Endowment support over time.",
};

function renderBridge() {
  return render(
    createElement(
      MemoryRouter,
      null,
      createElement(IntlProvider, { locale: "en", messages }, createElement(PublicFundingBridge))
    )
  );
}

describe("PublicFundingBridge", () => {
  it("explains Donate and Endow in protocol terms", () => {
    renderBridge();

    const heading = screen.getByRole("heading", {
      name: "Direct support today. Endowment support over time.",
    });
    expect(heading).toBeInTheDocument();
    expect(heading.closest("section")).toHaveClass("bg-editorial-warm");
    expect(screen.getByRole("heading", { name: "Donate" })).toBeInTheDocument();
    expect(screen.getByText(/Garden's Cookie Jar/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Endow" })).toBeInTheDocument();
    expect(screen.getByText(/Garden Vault/i)).toBeInTheDocument();
    expect(screen.getByText(/smart contract, token, yield/i)).toBeInTheDocument();
  });

  it("uses standard numbers for the support paths", () => {
    renderBridge();

    expect(screen.getByText("1.")).toBeInTheDocument();
    expect(screen.getByText("2.")).toBeInTheDocument();
    expect(screen.queryByText("i.")).toBeNull();
    expect(screen.queryByText("ii.")).toBeNull();
  });

  it("routes the single action to /fund", () => {
    renderBridge();

    const supportLink = screen.getByRole("link", { name: "Support Gardens" });
    expect(supportLink).toHaveAttribute("href", "/fund");
    expect(supportLink).toHaveClass("border-b");
    expect(supportLink).toHaveClass("text-primary-action");
    expect(supportLink).not.toHaveClass("bg-primary-action");
  });
});
