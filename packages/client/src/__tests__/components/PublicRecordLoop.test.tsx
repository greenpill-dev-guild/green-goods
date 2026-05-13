/**
 * PublicRecordLoop Component Tests
 *
 * Locks the homepage loop heading's intentional two-line composition.
 *
 * @vitest-environment jsdom
 */

import { render, screen, within } from "@testing-library/react";
import { createElement } from "react";
import { IntlProvider } from "react-intl";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

vi.mock("@green-goods/shared", () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(" "),
  useInViewReveal: () => ({ ref: () => undefined, revealed: true }),
}));

import { PublicRecordLoop } from "../../components/Public/PublicRecordLoop";

const messages: Record<string, string> = {
  "public.home.loop.assess": "Assess the place.",
  "public.home.loop.assessBody":
    "A Garden starts as a real community hub with members, roles, and a place-based brief, so every Work record has somewhere accountable to land.",
  "public.home.loop.fund": "Fund what grows.",
  "public.home.loop.fundBody":
    "Funders can Donate through Cookie Jars for direct support or Endow Garden Vaults designed so yield supports the Work over time.",
  "public.home.loop.kicker": "§ 03: Regenerative Work Loop",
  "public.home.loop.title": "Four steps. Repeated, <line2>season after season</line2>",
  "public.home.loop.verify": "Verify impact.",
  "public.home.loop.verifyBody":
    "Evaluators create Assessments that connect approved Work to evidence and impact across the Eight Forms of Capital.",
  "public.home.loop.work": "Do the work.",
  "public.home.loop.workBody":
    "Gardeners submit Work from the field with media, details, and metadata. Operators review those submissions before they become part of the public record.",
  "public.home.loop.fieldGuideKicker": "Curious how the work gets planned?",
  "public.home.loop.fieldGuide": "Browse the field guide of regenerative Actions",
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
      name: "Four steps. Repeated, season after season",
    });
    const secondLine = within(heading).getByText("season after season");

    expect(secondLine).toHaveClass("block");
  });

  it("keeps the loop kicker compact on mobile", () => {
    renderLoop();

    expect(screen.getByText("§ 03: Regenerative Work Loop")).toHaveClass(
      "whitespace-nowrap",
      "text-[10px]",
      "tracking-[0.08em]"
    );
  });

  it("places step body copy under the title on small screens", () => {
    renderLoop();

    expect(
      screen.getByText(
        "A Garden starts as a real community hub with members, roles, and a place-based brief, so every Work record has somewhere accountable to land."
      )
    ).toHaveClass("col-start-2", "md:col-start-auto");
  });

  it("uses standard numbers for homepage loop steps", () => {
    renderLoop();

    for (const numeral of ["1.", "2.", "3.", "4."]) {
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
    expect(headingArrows.length).toBe(4);
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
      name: /browse the field guide of regenerative actions/i,
    });
    expect(fieldGuideLink).toHaveAttribute("href", "/actions");
  });
});
