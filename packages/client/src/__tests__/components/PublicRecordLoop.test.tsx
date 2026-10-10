/**
 * PublicRecordLoop Component Tests
 *
 * Locks the homepage loop heading's intentional two-line composition.
 *
 * @vitest-environment happy-dom
 */

import { render, screen, within } from "@testing-library/react";
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

import { PublicRecordLoop } from "../../components/Public/PublicRecordLoop";

const messages: Record<string, string> = {
  "public.home.loop.assess": "Assess the place.",
  "public.home.loop.assessBody":
    "A Garden starts as a real community hub with members, roles, and a place-based brief, so every Work record has somewhere accountable to land.",
  "public.home.loop.fund": "Support what comes next.",
  "public.home.loop.fundBody":
    "Supporters can explore a Garden’s record, donate to its shared fund, or discuss longer-term support.",
  "public.home.loop.kicker": "§ 03: How it works",
  "public.home.loop.title": "Document. Review. <line2>Support what comes next.</line2>",
  "public.home.loop.verify": "Review it locally.",
  "public.home.loop.verifyBody":
    "Garden stewards review each submission. Approved work becomes public; assessments can describe the conditions and changes behind it.",
  "public.home.loop.work": "Document the work.",
  "public.home.loop.workBody":
    "Participants record what they did with photos, notes, and measurements. A public record helps others understand the work.",
  "public.home.loop.fieldGuideKicker": "Curious how the work gets planned?",
  "public.home.loop.fieldGuide": "Explore the types of work Gardens document",
};

function renderLoop() {
  return render(
    createElement(
      MemoryRouter,
      null,
      createElement(IntlProvider, { locale: "en", messages }, createElement(PublicRecordLoop))
    )
  );
}

describe("PublicRecordLoop", () => {
  it("puts season after season on the second title line", () => {
    renderLoop();

    const heading = screen.getByRole("heading", {
      name: "Document. Review. Support what comes next.",
    });
    const secondLine = within(heading).getByText("Support what comes next.");

    expect(secondLine).toHaveClass("block");
  });

  it("keeps the loop kicker compact on mobile", () => {
    renderLoop();

    expect(screen.getByText("§ 03: How it works")).toHaveClass(
      "whitespace-nowrap",
      "text-[10px]",
      "tracking-[0.08em]"
    );
  });

  it("uses standard numbers for homepage loop steps", () => {
    renderLoop();

    for (const numeral of ["1.", "2.", "3."]) {
      expect(screen.getByText(numeral)).toBeInTheDocument();
    }
    for (const romanNumeral of ["i.", "ii.", "iii.", "iv."]) {
      expect(screen.queryByText(romanNumeral)).toBeNull();
    }
  });

  it("renders a subtle arrow at rest on every step title row (P3-5)", () => {
    renderLoop();

    // Each numbered step renders an aria-hidden arrow inside its <h3> at rest;
    // the visible arrow is what tells the visitor the row is a link without
    // requiring hover. The EditorialLinkArrow on the field-guide CTA also
    // renders an arrow, so the assertion targets only arrows that live inside
    // a step heading.
    const headingArrows = screen
      .getAllByRole("heading", { level: 3 })
      .map((heading) => heading.querySelector("span[aria-hidden='true']"))
      .filter((node): node is HTMLElement => node !== null);
    expect(headingArrows.length).toBe(3);
    for (const arrow of headingArrows) {
      expect(arrow.textContent).toBe("→");
      expect(arrow).toHaveClass("text-text-soft-400");
      expect(arrow).toHaveClass("group-hover:text-primary-action");
    }
  });

  it("surfaces the actions field guide from the homepage loop (P3-2)", () => {
    renderLoop();

    expect(screen.getByText("Curious how the work gets planned?")).toBeInTheDocument();
    const fieldGuideLink = screen.getByRole("link", {
      name: /Explore the types of work Gardens document/i,
    });
    expect(fieldGuideLink).toHaveAttribute("href", "/actions");
  });
});
