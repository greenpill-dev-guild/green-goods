/**
 * GardenDetail section-semantics tests.
 *
 * Locks the Phase 3 P3-4 contract: each major section on the public garden
 * page is wrapped in a `<section aria-labelledby="...">` whose id resolves to
 * an `<h2>` heading. Screen readers and the axe accessibility tree depend on
 * this pairing.
 *
 * Written without `vi.importActual("@green-goods/shared")` so it does not
 * pull the wallet runtime barrel through the test transformer (the historic
 * `PublicGardenDetail.test.tsx` route does not load in this worktree).
 *
 * @vitest-environment jsdom
 */

import { render, screen } from "@testing-library/react";
import { createElement } from "react";
import { IntlProvider } from "react-intl";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

const mockGardens = [
  {
    id: "0x1111111111111111111111111111111111111111",
    address: "0x1111111111111111111111111111111111111111",
    name: "Solar Community Garden",
    slug: "solar-community-garden",
    description: "A solar-powered community garden in downtown Austin",
    location: "Austin, TX",
    bannerImage: "https://example.com/banner.jpg",
    contributorCount: 2,
    actionCount: 2,
    lastActivityAt: 1710000000,
    operators: [],
    evaluators: [],
  },
];

vi.mock("@green-goods/shared", () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(" "),
  publicGardenHelpers: {
    deriveSlug: (name: string) =>
      name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, ""),
  },
  usePublicGardens: () => ({ data: mockGardens, isLoading: false }),
}));

vi.mock("@/components/Display", () => ({
  ImageWithFallback: ({ alt }: { alt?: string }) => createElement("img", { alt: alt ?? "" }),
}));

vi.mock("@/components/Public/PublicInstallAction", () => ({
  PublicInstallAction: ({
    children,
  }: {
    children: (props: {
      label: string;
      href: string;
      isOpenApp: boolean;
      onClick: () => void;
      dataInstallAction: string;
    }) => unknown;
  }) =>
    children({
      label: "Install App",
      href: "#install",
      isOpenApp: false,
      onClick: () => undefined,
      dataInstallAction: "install_pwa",
    }),
}));

vi.mock("@/components/Public/PublicInstallCta", () => ({
  PublicInstallCta: () => createElement("div", { "data-testid": "public-install-cta" }),
}));

import GardenDetail from "../../views/Public/GardenDetail";

const messages: Record<string, string> = {
  "public.gardenDetail.notFound": "Garden not found",
  "public.gardenDetail.notFoundHelp": "The link may be stale.",
  "public.gardenDetail.backToGardens": "Browse Gardens",
  "public.gardenDetail.place.title": "About this Garden",
  "public.gardenDetail.place.empty": "Garden narrative will appear here.",
  "public.gardenDetail.work.title": "Work",
  "public.gardenDetail.work.summary":
    "{count} {count, plural, one {Work entry} other {Work entries}} documented.",
  "public.gardenDetail.evidence.title": "Evidence",
  "public.gardenDetail.evidence.summary": "Browse the Impact ledger.",
  "public.gardenDetail.evidence.cta": "View public evidence",
  "public.gardenDetail.fund.title": "Fund this Garden",
  "public.gardenDetail.fund.description": "Donate or Endow this Garden.",
  "public.gardenDetail.fund.cta": "Support this Garden",
  "public.gardenDetail.stats.contributors": "Contributors",
  "public.gardenDetail.stats.work": "Work",
};

function renderView(route = "/gardens/solar-community-garden") {
  return render(
    createElement(
      MemoryRouter,
      { initialEntries: [route] },
      createElement(
        IntlProvider,
        { locale: "en", messages },
        createElement(
          Routes,
          null,
          createElement(Route, { path: "/gardens/:id", element: createElement(GardenDetail) })
        )
      )
    )
  );
}

describe("GardenDetail section semantics (P3-4)", () => {
  it("wraps each public-record section in a <section aria-labelledby=...>", () => {
    const { container } = renderView();

    const expected = [
      ["garden-place-title", "About this Garden"],
      ["garden-work-title", "Work"],
      ["garden-evidence-title", "Evidence"],
      ["garden-fund-title", "Fund this Garden"],
    ] as const;

    for (const [labelId, headingText] of expected) {
      const section = container.querySelector(`section[aria-labelledby="${labelId}"]`);
      expect(section, `<section aria-labelledby="${labelId}"> not found`).not.toBeNull();
      const heading = section?.querySelector(`h2#${labelId}`);
      expect(heading, `<h2 id="${labelId}"> not found inside its labelled section`).not.toBeNull();
      expect(heading?.textContent).toBe(headingText);
    }

    // The four sections appear at h2 level (they should not collide with the
    // page h1 which renders the garden name).
    const h2Texts = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent ?? "");
    expect(h2Texts).toEqual(
      expect.arrayContaining(["About this Garden", "Work", "Evidence", "Fund this Garden"])
    );
  });
});
