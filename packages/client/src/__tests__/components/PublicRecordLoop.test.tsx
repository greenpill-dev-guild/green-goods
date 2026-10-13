/**
 * PublicRecordLoop Component Tests
 *
 * Locks the home page's "How it works": the same four-step Garden cycle, in the
 * same words, as the `/impact` figure, each step a link to where it can be seen.
 *
 * @vitest-environment happy-dom
 */

import en from "@green-goods/shared/i18n/en.json";
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

import { PublicRecordLoop } from "../../components/Public/PublicRecordLoop";

function renderLoop() {
  return render(
    createElement(
      MemoryRouter,
      null,
      createElement(
        IntlProvider,
        { locale: "en", messages: en as Record<string, string> },
        createElement(PublicRecordLoop)
      )
    )
  );
}

describe("PublicRecordLoop", () => {
  it("tells the /impact cycle in its words, each step linking to where it can be seen", () => {
    renderLoop();

    expect(
      screen.getByRole("heading", { level: 2, name: en["public.impact.pipeline.title"] })
    ).toBeInTheDocument();
    const steps = screen.getAllByRole("listitem").map((item) => {
      const link = item.querySelector("a");
      return [
        item.querySelector("h3")?.textContent?.replace("→", "").trim(),
        item.querySelector("p")?.textContent,
        link?.getAttribute("href"),
      ];
    });
    expect(steps).toEqual([
      [
        en["public.impact.pipeline.step.needs.title"],
        en["public.impact.pipeline.step.needs.description"],
        "/impact",
      ],
      [
        en["public.impact.pipeline.step.commitment.title"],
        en["public.impact.pipeline.step.commitment.description"],
        "/gardens",
      ],
      [
        en["public.impact.pipeline.step.work.title"],
        en["public.impact.pipeline.step.work.description"],
        "/actions",
      ],
      [
        en["public.impact.pipeline.step.learnings.title"],
        en["public.impact.pipeline.step.learnings.description"],
        "/impact",
      ],
    ]);
    expect(screen.getByText(en["public.impact.pipeline.loop"])).toBeInTheDocument();
  });

  it("keeps the loop kicker compact on mobile", () => {
    renderLoop();

    expect(screen.getByText(en["public.home.loop.kicker"])).toHaveClass(
      "whitespace-nowrap",
      "text-[10px]",
      "tracking-[0.08em]"
    );
  });

  it("numbers the steps plainly, with a quiet arrow on every step title at rest", () => {
    renderLoop();

    for (const numeral of ["1.", "2.", "3.", "4."]) {
      expect(screen.getByText(numeral)).toBeInTheDocument();
    }
    // The visible arrow tells the visitor the row is a link without needing hover.
    for (const heading of screen.getAllByRole("heading", { level: 3 })) {
      const arrow = heading.querySelector("span[aria-hidden='true']");
      expect(arrow?.textContent).toBe("→");
      expect(arrow).toHaveClass("text-text-soft-400", "group-hover:text-primary-action");
    }
  });
});
