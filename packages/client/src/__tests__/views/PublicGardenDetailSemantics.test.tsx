/**
 * GardenDetail section-semantics tests.
 *
 * Locks the Phase 3 P3-4 contract: each major section on the public garden
 * page is wrapped in a `<section aria-labelledby="...">` whose id resolves to
 * an `<h2>` heading. Screen readers and the axe accessibility tree depend on
 * this pairing.
 *
 * Written without `vi.importActual("@green-goods/shared")` so it does not pull
 * the wallet runtime barrel through the test transformer. The hero and footer
 * are stubbed too — this suite is about the section landmarks, and
 * `PublicGardenDetail.test.tsx` covers the composed page.
 *
 * @vitest-environment jsdom
 */

import { render, screen } from "@testing-library/react";
import { createElement } from "react";
import type { Address } from "viem";
import { IntlProvider } from "react-intl";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

const GARDEN_ID = "0x1111111111111111111111111111111111111111";
const GARDENER = "0x2222222222222222222222222222222222222222";

const mockGardens = [
  {
    id: GARDEN_ID,
    address: GARDEN_ID,
    name: "Solar Community Garden",
    slug: "solar-community-garden",
    description: "A solar-powered community garden in downtown Austin",
    location: "Austin, TX",
    bannerImage: "https://example.com/banner.jpg",
    contributorCount: 2,
    actionCount: 2,
    lastActivityAt: 1710000000,
    stewards: [GARDENER],
    evaluators: [],
  },
];

vi.mock("@green-goods/shared/utils/styles/cn", () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(" "),
}));

vi.mock("@green-goods/shared/config/default-chain", () => ({
  DEFAULT_CHAIN_ID: 42161,
}));

vi.mock("@green-goods/shared/utils/eas/explorers", () => ({
  getEASExplorerUrl: (chainId: number, uid: string) => `https://explorer.example/${chainId}/${uid}`,
}));

vi.mock("@green-goods/shared/utils/app/text", () => ({
  formatAddress: (address: string) => address,
}));

vi.mock("@green-goods/shared/hooks/blockchain/useEnsName", () => ({
  useEnsName: () => ({ data: null }),
}));

vi.mock("@green-goods/shared/hooks/public/usePublicGardens", () => ({
  publicGardenHelpers: {
    deriveSlug: (name: string) =>
      name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, ""),
  },
  usePublicGardens: () => ({ data: mockGardens, isLoading: false }),
}));

vi.mock("@green-goods/shared/hooks/public/usePublicGardenDetail", () => ({
  usePublicGardenDetail: () => ({
    data: {
      garden: {
        id: GARDEN_ID,
        name: "Solar Community Garden",
        location: "Austin, TX",
        description: "A solar-powered community garden in downtown Austin",
        bannerImage: "https://example.com/banner.jpg",
        stewards: [GARDENER],
      },
      fieldNotes: [],
      contributors: [],
      assessmentCount: 0,
      totalFieldNotes: 0,
      partialData: false,
      unavailableSources: { works: false, assessments: false },
    },
    isLoading: false,
  }),
}));

vi.mock("@green-goods/shared/hooks/hypercerts/useHypercerts", () => ({
  useHypercerts: () => ({ hypercerts: [], isLoading: false }),
}));

vi.mock("@green-goods/shared/hooks/ui/useInViewReveal", () => ({
  useInViewReveal: () => ({ ref: { current: null }, revealed: true }),
}));

vi.mock("@green-goods/shared/components/AddressDisplay", () => ({
  AddressDisplay: ({ address }: { address: Address }) =>
    createElement("button", { type: "button" }, address),
}));

vi.mock("@green-goods/shared/commitment-pooling", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@green-goods/shared/commitment-pooling")>()),
  PUBLIC_HISTORY_PAGE_SIZE: 12,
  usePublicGardenPool: () => ({
    data: {
      pool: null,
      openSeason: null,
      openCampaigns: [],
      finishedCycles: [],
      poolUnitSummaries: [],
      cycleUnitSummaries: [],
      finishedCycleTotal: 0,
      hasCommitmentCertificates: false,
      partialData: false,
      unavailableSources: { commitmentPool: false, cycleMetadata: false },
    },
    isLoading: false,
    isFetching: false,
    isPlaceholderData: false,
    refetch: () => Promise.resolve(),
  }),
  selectPublicPromiseKeptRate: () => ({
    kind: "counts-only",
    counts: { fulfilled: 0n, due: 0n },
  }),
}));

vi.mock("@/components/Display", () => ({
  ImageWithFallback: ({ alt }: { alt?: string }) => createElement("img", { alt: alt ?? "" }),
}));

vi.mock("@/components/Public/PublicEditorialHero", () => ({
  PublicEditorialHero: ({ title }: { title: React.ReactNode }) => createElement("h1", null, title),
}));

vi.mock("@/components/Public/PublicFooter", () => ({
  PublicFooter: () => createElement("div", { "data-testid": "public-footer" }),
}));

vi.mock("@/components/Public/PublicInstallCta", () => ({
  PublicInstallCta: () => createElement("div", { "data-testid": "public-install-cta" }),
}));

import GardenDetail from "../../views/Public/GardenDetail";

const messages: Record<string, string> = {
  "public.gardenDetail.notFound": "Garden not found",
  "public.gardenDetail.notFoundHelp": "The link may be stale.",
  "public.gardenDetail.backToGardens": "Browse Gardens",
  "public.gardenDetail.backToArchive": "All Gardens",
  "public.gardenDetail.place.empty": "Garden narrative will appear here.",
  "public.gardenDetail.support": "Support This Garden",
  "public.gardenDetail.evidence.cta": "View Public Evidence",
  "public.gardenDetail.stats.entries": "Entries",
  "public.gardenDetail.stats.handsAtWork": "Hands at work",
  "public.gardenDetail.stats.assessments": "Assessments",
  "public.gardenDetail.stats.certificates": "Certificates",
  "public.gardenDetail.stats.unknown": "Not available",
  "public.gardenDetail.section.notes": "§ 01: Field notes",
  "public.gardenDetail.section.certificates": "§ 03: Certificates",
  "public.gardenDetail.section.stewards": "§ 04: Stewards",
  "public.pool.garden.kicker": "§ 02: Commitments",
  "public.pool.garden.heading.preparing": "This Garden is preparing its pool",
  "public.pool.garden.state.notReady": "Offers and requests open once the pool is ready.",
  "public.gardenDetail.notes.heading": "Latest field notes",
  "public.gardenDetail.notes.helper": "What gardeners have logged.",
  "public.gardenDetail.notes.empty": "No field notes yet.",
  "public.gardenDetail.certificates.heading": "Impact Certificates",
  "public.gardenDetail.certificates.helper": "Bundles of approved Work.",
  "public.gardenDetail.certificates.empty": "No Impact Certificates yet.",
  "public.gardenDetail.stewards.heading": "Stewards",
  "public.gardenDetail.stewards.helper": "Trusted coordinators.",
  "public.gardenDetail.stewards.empty": "No stewards are listed for this Garden yet.",
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
      ["public-garden-detail-notes", "Latest field notes"],
      ["public-garden-detail-commitments", "This Garden is preparing its pool"],
      ["public-garden-detail-certificates", "Impact Certificates"],
      ["public-garden-detail-stewards", "Stewards"],
    ] as const;

    for (const [labelId, headingText] of expected) {
      const section = container.querySelector(`section[aria-labelledby="${labelId}"]`);
      expect(section, `<section aria-labelledby="${labelId}"> not found`).not.toBeNull();
      const heading = section?.querySelector(`h2#${labelId}`);
      expect(heading, `<h2 id="${labelId}"> not found inside its labelled section`).not.toBeNull();
      expect(heading?.textContent).toBe(headingText);
    }

    // The sections appear at h2 level and do not collide with the page h1,
    // which carries the Garden name.
    const h2Texts = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent ?? "");
    expect(h2Texts).toEqual([
      "Latest field notes",
      "This Garden is preparing its pool",
      "Impact Certificates",
      "Stewards",
    ]);
  });

  it("keeps every section present when the Garden has no content for it", () => {
    const { container } = renderView();

    // Ordinals stay stable between Gardens: § 02 commitments renders its
    // pre-launch state rather than disappearing, so it has a defined
    // neighbour on both sides regardless of what this Garden has published.
    expect(container.querySelectorAll("section[aria-labelledby]")).toHaveLength(4);
    expect(screen.getByText("No field notes yet.")).toBeInTheDocument();
    expect(screen.getByText("No Impact Certificates yet.")).toBeInTheDocument();
  });
});
