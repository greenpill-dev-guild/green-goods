/**
 * Public Garden Detail View Tests
 *
 * Locks the page that replaced the modal at `/gardens/:id`:
 * - Slug-or-id resolution via `publicGardenHelpers.deriveSlug`.
 * - Field notes → Commitments → Certificates → Stewards section order, all
 *   four always rendered so the ordinals stay stable. The commitments section
 *   has its own suite (`commitment-editorial.test.tsx`); here it is pinned to
 *   the pre-launch state so the page contract stays the subject.
 * - A failed EAS read renders an em dash, never `0` — the page may not publish
 *   "we don't know" as zero.
 * - Local paging over the full note set (the query key carries no page size).
 * - Support CTA links to `/fund?garden=<slug>`.
 * - Localized not-found state.
 *
 * @vitest-environment jsdom
 */

import { fireEvent, render, screen, within } from "@testing-library/react";
import { createElement } from "react";
import { IntlProvider } from "react-intl";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { Address } from "viem";
import { beforeEach, describe, expect, it, vi } from "vitest";

const GARDEN_ID = "0x1111111111111111111111111111111111111111" as Address;
const GARDENER = "0x2222222222222222222222222222222222222222" as Address;

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

function makeNote(index: number) {
  return {
    id: `0xnote${index}`,
    title: `Field note ${index}`,
    feedback: `What happened on day ${index}`,
    media: index % 2 === 0 ? [`https://example.com/photo-${index}.jpg`] : [],
    gardenerAddress: GARDENER,
    gardenAddress: GARDEN_ID,
    actionUID: 1,
    createdAt: 1710000000 - index * 86_400,
  };
}

const mockUsePublicGardens = vi.fn();
const mockUsePublicGardenDetail = vi.fn();
const mockUseHypercerts = vi.fn();
const mockUsePublicGardenPool = vi.fn();
const mockUseApp = vi.fn();

vi.mock("@green-goods/shared/hooks/public/usePublicGardens", async (importOriginal) => {
  return {
    ...(await importOriginal()),
    usePublicGardens: (...args: unknown[]) => mockUsePublicGardens(...args),
  };
});

vi.mock("@green-goods/shared/hooks/public/usePublicGardenDetail", async (importOriginal) => {
  return {
    ...(await importOriginal()),
    usePublicGardenDetail: (...args: unknown[]) => mockUsePublicGardenDetail(...args),
  };
});

vi.mock("@green-goods/shared/hooks/hypercerts/useHypercerts", async (importOriginal) => {
  return {
    ...(await importOriginal()),
    useHypercerts: (...args: unknown[]) => mockUseHypercerts(...args),
  };
});

vi.mock("@green-goods/shared/providers/App", async (importOriginal) => {
  return {
    ...(await importOriginal()),
    useApp: () => mockUseApp(),
  };
});

vi.mock("@green-goods/shared/components/AddressDisplay", async (importOriginal) => {
  return {
    ...(await importOriginal()),
    AddressDisplay: ({ address }: { address: Address }) =>
      createElement("button", { type: "button", "data-testid": "address" }, address),
  };
});

vi.mock("@green-goods/shared/hooks/blockchain/useEnsName", async (importOriginal) => {
  return {
    ...(await importOriginal()),
    useEnsName: () => ({ data: null }),
  };
});

vi.mock("@green-goods/shared/utils/app/text", async (importOriginal) => {
  return {
    ...(await importOriginal()),
    formatAddress: (address: string) => `${address.slice(0, 4)}…${address.slice(-3)}`,
  };
});

vi.mock("@green-goods/shared/utils/eas/explorers", async (importOriginal) => {
  return {
    ...(await importOriginal()),
    getEASExplorerUrl: (chainId: number, uid: string) =>
      `https://explorer.example/${chainId}/${uid}`,
  };
});

vi.mock("@green-goods/shared/config/default-chain", async (importOriginal) => {
  return {
    ...(await importOriginal()),
    DEFAULT_CHAIN_ID: 42161,
  };
});

vi.mock("@green-goods/shared/hooks/app/useInstallGuidance", async (importOriginal) => {
  return {
    ...(await importOriginal()),
    useInstallGuidance: () => ({
      scenario: "desktop",
      primaryAction: { type: "continue-in-browser", label: "Open on Mobile" },
      secondaryAction: null,
      browserInfo: { browser: "unknown" },
      showBrowserOption: false,
      manualInstructions: null,
      browserSwitchReason: null,
      openInBrowserUrl: null,
    }),
  };
});

vi.mock("@green-goods/shared/commitment-pooling", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@green-goods/shared/commitment-pooling")>()),
  usePublicGardenPool: (...args: unknown[]) => mockUsePublicGardenPool(...args),
}));

vi.mock("@green-goods/shared/commitment-pooling/public", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@green-goods/shared/commitment-pooling/public")>()),
  usePublicGardenPool: (...args: unknown[]) => mockUsePublicGardenPool(...args),
}));

import GardenDetail from "../../views/Public/GardenDetail";

const messages: Record<string, string> = {
  "public.gardenDetail.notFound": "Garden not found",
  "public.gardenDetail.unavailable": "This Garden could not be loaded",
  "public.gardenDetail.unavailableHelp": "Could not read it right now.",
  "public.gardenDetail.retry": "Try Again",
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
  "public.gardenDetail.notes.untitled": "Untitled entry",
  "public.gardenDetail.notes.showing": "Showing {shown} of {total}",
  "public.gardenDetail.notes.loadMore": "Show more entries",
  "public.gardenDetail.notes.unavailable": "Field notes could not be loaded right now.",
  "public.gardenDetail.notes.mediaAlt": "Photo logged with {title}",
  "public.gardenDetail.notes.noDescription": "No description was logged.",
  "public.gardenDetail.notes.sourceLabel": "View attestation",
  "public.gardenDetail.certificates.heading": "Impact Certificates",
  "public.gardenDetail.certificates.helper": "Bundles of approved Work.",
  "public.gardenDetail.certificates.empty": "No Impact Certificates yet.",
  "public.gardenDetail.certificates.untitled": "Untitled certificate",
  "public.gardenDetail.certificates.attestations":
    "{count, plural, one {# attestation} other {# attestations}}",
  "public.gardenDetail.stewards.heading": "Stewards",
  "public.gardenDetail.stewards.helper": "Trusted coordinators.",
  "public.gardenDetail.stewards.empty": "No stewards are listed for this Garden yet.",
  "public.source.close": "Close",
  "public.nav.installApp": "Install App",
  "public.nav.openApp": "Open App",
  "public.home.install.title": "Bring the field with you",
  "public.home.install.description": "Install the app.",
};

function detailResult(
  overrides: Partial<{
    fieldNotes: ReturnType<typeof makeNote>[];
    contributors: { address: Address; fieldNoteCount: number }[];
    assessmentCount: number;
    works: boolean;
    assessments: boolean;
    isLoading: boolean;
  }> = {}
) {
  const fieldNotes = overrides.fieldNotes ?? [makeNote(0), makeNote(1)];
  return {
    data: {
      garden: {
        id: GARDEN_ID,
        name: "Solar Community Garden",
        location: "Austin, TX",
        description: "A solar-powered community garden in downtown Austin",
        bannerImage: "https://example.com/banner.jpg",
        stewards: [GARDENER],
      },
      fieldNotes,
      contributors: overrides.contributors ?? [{ address: GARDENER, fieldNoteCount: 2 }],
      assessmentCount: overrides.assessmentCount ?? 3,
      totalFieldNotes: fieldNotes.length,
      partialData: Boolean(overrides.works || overrides.assessments),
      unavailableSources: {
        works: Boolean(overrides.works),
        assessments: Boolean(overrides.assessments),
      },
    },
    isLoading: Boolean(overrides.isLoading),
  };
}

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

describe("GardenDetail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUsePublicGardens.mockReturnValue({ data: mockGardens, isLoading: false });
    mockUsePublicGardenDetail.mockReturnValue(detailResult());
    mockUseHypercerts.mockReturnValue({ hypercerts: [], isLoading: false });
    // Pre-launch: no pool registered for this Garden.
    mockUsePublicGardenPool.mockReturnValue({
      data: {
        pool: null,
        openSeason: null,
        openCampaigns: [],
        finishedCycles: [],
        poolUnitSummaries: [],
        cycleUnitSummaries: [],
        partialData: false,
        unavailableSources: { commitmentPool: false, cycleMetadata: false },
      },
      isLoading: false,
      refetch: vi.fn(),
    });
    mockUseApp.mockReturnValue({
      isMobile: false,
      isInstalled: false,
      platform: "unknown",
      deferredPrompt: null,
    });
  });

  it("renders the Garden name as the editorial h1", () => {
    renderView();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Solar Community Garden");
  });

  it("resolves the Garden by slug", () => {
    renderView("/gardens/solar-community-garden");
    expect(screen.getAllByText(/solar-powered community garden/i).length).toBeGreaterThanOrEqual(1);
  });

  it("resolves the Garden by raw id/address", () => {
    renderView(`/gardens/${GARDEN_ID}`);
    expect(screen.getAllByText(/solar-powered community garden/i).length).toBeGreaterThanOrEqual(1);
  });

  it("renders field notes, commitments, certificates and stewards in order, all four always present", () => {
    mockUsePublicGardenDetail.mockReturnValue(detailResult({ fieldNotes: [] }));
    const { container } = renderView();
    // Scoped to the record ladder: PublicInstallCta is a labelled section with
    // an h2 of its own, and it is not part of it.
    const headings = Array.from(
      container.querySelectorAll('section[aria-labelledby^="public-garden-detail-"] h2')
    ).map((h) => h.textContent ?? "");
    expect(headings).toEqual([
      "Latest field notes",
      "This Garden is preparing its pool",
      "Impact Certificates",
      "Stewards",
    ]);
    // Empty sections say so rather than disappearing.
    expect(screen.getByText("No field notes yet.")).toBeInTheDocument();
    expect(screen.getByText("No Impact Certificates yet.")).toBeInTheDocument();
  });

  it("renders an em dash rather than 0 when the works read failed", () => {
    mockUsePublicGardenDetail.mockReturnValue(detailResult({ fieldNotes: [], works: true }));
    renderView();

    const entries = screen.getByText("Entries").closest("div") as HTMLElement;
    expect(within(entries).getByText("—")).toBeInTheDocument();
    expect(within(entries).queryByText("0")).not.toBeInTheDocument();
    expect(within(entries).getByText("Not available")).toBeInTheDocument();

    // The section says it could not load; it does not claim the Garden is empty.
    expect(screen.getByText(/could not be loaded/i)).toBeInTheDocument();
    expect(screen.queryByText("No field notes yet.")).not.toBeInTheDocument();
  });

  it("dashes only the failed source", () => {
    mockUsePublicGardenDetail.mockReturnValue(detailResult({ assessments: true }));
    renderView();

    const assessments = screen.getByText("Assessments").closest("div") as HTMLElement;
    expect(within(assessments).getByText("—")).toBeInTheDocument();

    const entries = screen.getByText("Entries").closest("div") as HTMLElement;
    expect(within(entries).getByText("2")).toBeInTheDocument();
  });

  it("pages the note grid locally without asking the hook for more", () => {
    const notes = Array.from({ length: 14 }, (_, i) => makeNote(i));
    mockUsePublicGardenDetail.mockReturnValue(detailResult({ fieldNotes: notes }));
    renderView();

    expect(screen.getByText("Showing 12 of 14")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Show more entries" }));

    expect(screen.getByText("Showing 14 of 14")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Show more entries" })).not.toBeInTheDocument();
    // Paging is local. Asking the hook for a bigger page would be silently
    // useless: `queryKeys.public.gardenDetail` carries no page size, so the
    // cached result would come back unchanged.
    for (const call of mockUsePublicGardenDetail.mock.calls) {
      expect(call).toEqual(["solar-community-garden", { chainId: 42161 }]);
    }
  });

  it("opens a note in the source dialog and returns focus to its tile", () => {
    renderView();
    const tile = screen.getByRole("button", { name: /Field note 0/ });
    fireEvent.click(tile);

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("What happened on day 0")).toBeInTheDocument();
    // Chain-aware: the link resolves against the same chain the notes came from.
    expect(within(dialog).getByRole("link", { name: "View attestation" })).toHaveAttribute(
      "href",
      "https://explorer.example/42161/0xnote0"
    );

    fireEvent.click(within(dialog).getAllByRole("button", { name: "Close" })[0]);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(tile).toHaveFocus();
  });

  it("does not publish a certificate count before the garden resolves", () => {
    // useHypercerts is disabled without a gardenId, so it reports isLoading
    // false with an empty list — which must not render as a confident 0.
    mockUsePublicGardenDetail.mockReturnValue({
      data: undefined,
      isLoading: true,
    });
    mockUseHypercerts.mockReturnValue({ hypercerts: [], isLoading: false });
    renderView();

    const certificates = screen.getByText("Certificates").closest("div") as HTMLElement;
    expect(within(certificates).queryByText("0")).not.toBeInTheDocument();
    expect(certificates.querySelector("[data-editorial-skeleton]")).toBeInTheDocument();
    expect(certificates.querySelector(".animate-pulse")).toBeNull();
  });

  it("renders the note dialog outside the transformed section", () => {
    // `.editorial-section-reveal` applies a transform, and a transformed
    // ancestor becomes the containing block for `position: fixed`. Rendered
    // in place, the dialog's overlay sizes and scrolls against the section
    // instead of the viewport.
    const { container } = renderView();
    fireEvent.click(screen.getByRole("button", { name: /Field note 0/ }));

    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();
    expect(container.contains(dialog)).toBe(false);
    expect(dialog.closest(".editorial-section-reveal")).toBeNull();
  });

  it("never nests an interactive element inside a note tile", () => {
    const { container } = renderView();
    // The tile is itself a button. AddressDisplay is not usable inside it.
    expect(container.querySelectorAll("button button")).toHaveLength(0);
    expect(container.querySelectorAll("a button, button a")).toHaveLength(0);
  });

  it("links the Support CTA to /fund?garden=<slug>", () => {
    renderView();
    expect(screen.getByRole("link", { name: "Support This Garden" })).toHaveAttribute(
      "href",
      "/fund?garden=solar-community-garden"
    );
  });

  it("offers a way back to the archive", () => {
    renderView();
    expect(screen.getByRole("link", { name: /all gardens/i })).toHaveAttribute("href", "/gardens");
  });

  it("renders Install App CTA when not installed", () => {
    renderView();
    expect(screen.getAllByText("Install App").length).toBeGreaterThanOrEqual(1);
  });

  it("shows the not-found state for unknown Gardens", () => {
    mockUsePublicGardenDetail.mockReturnValue({
      data: {
        garden: null,
        fieldNotes: [],
        contributors: [],
        assessmentCount: 0,
        totalFieldNotes: 0,
        partialData: false,
        unavailableSources: { works: false, assessments: false },
      },
      isLoading: false,
    });
    renderView("/gardens/missing-garden");
    expect(screen.getByText("Garden not found")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /browse gardens/i })).toHaveAttribute(
      "href",
      "/gardens"
    );
  });
  it("distinguishes a failed read from a missing Garden", () => {
    // `getGardens` times out in production. Falling through to not-found told
    // the reader their Garden does not exist, which the page cannot know.
    const refetch = vi.fn();
    mockUsePublicGardenDetail.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      refetch,
    });
    renderView("/gardens/solar-community-garden");

    expect(screen.getByText("This Garden could not be loaded")).toBeInTheDocument();
    expect(screen.queryByText("Garden not found")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Try Again" }));
    expect(refetch).toHaveBeenCalled();
  });

  it("keeps cached Garden data visible when a background refetch fails", () => {
    mockUsePublicGardenDetail.mockReturnValue({
      ...detailResult(),
      isError: true,
      refetch: vi.fn(),
    });
    renderView();

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Solar Community Garden");
    expect(screen.queryByText("This Garden could not be loaded")).not.toBeInTheDocument();
  });
});
