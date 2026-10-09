/**
 * PublicFundingBridge - homepage funding explanation tests.
 *
 * Locks the cardless trust section after the regenerative work loop:
 * - Donate maps to Cookie Jar direct support.
 * - Endow maps to Garden Vault support over time.
 * - The only action routes to /fund.
 *
 * @vitest-environment happy-dom
 */

import { render, screen } from "@testing-library/react";
import { createElement } from "react";
import { IntlProvider } from "react-intl";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

vi.mock("@green-goods/shared/utils/styles/cn", () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(" "),
}));

vi.mock("@green-goods/shared/hooks/ui/useInViewReveal", () => ({
  useInViewReveal: () => ({ ref: () => undefined, revealed: true }),
}));

import { PublicFundingBridge } from "../../components/Public/PublicFundingBridge";

const messages: Record<string, string> = {
  "public.home.funding.body":
    "Explore a Garden’s work before choosing how to support it. Give to its shared fund today, or explore an endowment for support over time.",
  "public.home.funding.cta": "Support Gardens",
  "public.home.funding.donateBody":
    "Contribute to the Garden’s shared fund to help its community carry out the work.",
  "public.home.funding.donateTitle": "Donate",
  "public.home.funding.endowBody":
    "An endowment is a withdrawable deposit whose investment earnings support the Garden. Read its terms and risks before contributing.",
  "public.home.funding.endowTitle": "Support over time",
  "public.home.funding.kicker": "§ 04: Support Gardens",
  "public.home.funding.note":
    "Both paths support the Garden directly. They are not tax-deductible, charitable, or nonprofit-backed unless separately configured. Long-term deposits depend on the underlying token and provider, so values and access can vary.",
  "public.home.funding.notePrefix": "note",
  "public.home.funding.title": "Help communities keep going.",
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
  it("explains Donate and Endow in plain editorial language", () => {
    renderBridge();

    const heading = screen.getByRole("heading", {
      name: "Help communities keep going.",
    });
    expect(heading).toBeInTheDocument();
    expect(heading.closest("section")).toHaveClass("bg-editorial-warm");
    expect(screen.getByRole("heading", { name: "Donate" })).toBeInTheDocument();
    expect(screen.getAllByText(/shared fund/i)[0]).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Support over time" })).toBeInTheDocument();
    expect(screen.getByText(/withdrawable deposit/i)).toBeInTheDocument();

    // Trust note: tax-status is honest; risk language is the same plain-English
    // sentence used across the funding decision moments. The test fixture
    // doubles as a regression guard against the old technical risk vocabulary.
    const note = screen.getByText(/not tax-deductible/i);
    expect(note).toBeInTheDocument();
    expect(note).toHaveTextContent(/values and access can vary/i);
    expect(note.textContent ?? "").not.toMatch(/smart contract/i);
    expect(note.textContent ?? "").not.toMatch(/wallet recovery/i);
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
