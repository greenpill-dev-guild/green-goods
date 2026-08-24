/**
 * Commitment pooling — editorial public-browser suite.
 *
 * Locks the three public surfaces of the editorial lane (uiux-spec §7):
 * - `PublicEvidencePipeline` tells the five-stage story, localized, without
 *   widening the evidence ledger's three record kinds.
 * - `/gardens/:id` § 02 renders the Garden's commitment record across
 *   seasons and campaigns: readiness copy before launch, counts and the one
 *   sanctioned percentage only above the public threshold, open Season and
 *   Campaigns as their own rows, finished cycles newest first and paged,
 *   cancelled cycles never, em dashes (never zeros) when a read failed.
 * - `/impact` § 02 publishes protocol-wide aggregates with the open-pool
 *   count and lifetime totals kept distinct, and "support arrived" only for
 *   the CCIP-confirmed total.
 *
 * Renders against the real `en` catalog so every key the surfaces use is
 * proven to exist; the localization test swaps in the `es` catalog.
 *
 * @vitest-environment jsdom
 */

import en from "@green-goods/shared/i18n/en";
import es from "@green-goods/shared/i18n/es";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { createElement, type ReactElement } from "react";
import { IntlProvider } from "react-intl";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { Address } from "viem";
import { beforeEach, describe, expect, it, vi } from "vitest";

const GARDEN_ID = "0x1111111111111111111111111111111111111111" as Address;
const GARDENER = "0x2222222222222222222222222222222222222222" as Address;
const PROVIDER = "0x3333333333333333333333333333333333333333";
const CHAIN_ID = 42161;

const mockUsePublicGardens = vi.fn();
const mockUsePublicGardenDetail = vi.fn();
const mockUseHypercerts = vi.fn();
const mockUsePublicGardenPool = vi.fn();
const mockUsePublicCommitmentImpact = vi.fn();
const mockUsePublicStats = vi.fn();
const mockUsePublicImpactEvidence = vi.fn();
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

vi.mock("@green-goods/shared/hooks/public/usePublicStats", async (importOriginal) => {
  return {
    ...(await importOriginal()),
    usePublicStats: () => mockUsePublicStats(),
  };
});

vi.mock("@green-goods/shared/hooks/public/usePublicImpactEvidence", async (importOriginal) => {
  return {
    ...(await importOriginal()),
    usePublicImpactEvidence: () => mockUsePublicImpactEvidence(),
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
  usePublicCommitmentImpact: (...args: unknown[]) => mockUsePublicCommitmentImpact(...args),
}));

import { EVIDENCE_KIND_LABELS } from "../components/Public/evidenceKinds";
import { PublicCommitmentsBand } from "../components/Public/PublicCommitmentsBand";
import { PublicEvidencePipeline } from "../components/Public/PublicEvidencePipeline";
import GardenDetail from "../views/Public/GardenDetail";
import ImpactPage from "../views/Public/Impact";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const DAY = 86_400n;
const T0 = 1_750_000_000n;

function makePool(overrides: Partial<PoolFixture> = {}): PoolFixture {
  return {
    id: `${CHAIN_ID}-1`,
    chainId: CHAIN_ID,
    poolId: 1n,
    state: "OPEN",
    commitmentsOffered: 40n,
    commitmentsAccepted: 30n,
    commitmentsFulfilled: 24n,
    commitmentsCancelled: 2n,
    commitmentsExpired: 1n,
    commitmentsDisputed: 1n,
    commitmentsDue: 28n,
    openCommitmentCount: 4n,
    distinctProviderCount: 9n,
    ...overrides,
  };
}

interface PoolFixture {
  id: string;
  chainId: number;
  poolId: bigint;
  state: "UNKNOWN" | "NOT_READY" | "READY" | "OPEN" | "PAUSED" | "CLOSED" | "COMPOSTED";
  commitmentsOffered: bigint;
  commitmentsAccepted: bigint;
  commitmentsFulfilled: bigint;
  commitmentsCancelled: bigint;
  commitmentsExpired: bigint;
  commitmentsDisputed: bigint;
  commitmentsDue: bigint;
  openCommitmentCount: bigint;
  distinctProviderCount: bigint;
}

interface CycleFixture {
  id: string;
  chainId: number;
  cycleId: bigint;
  poolId: bigint;
  cycleType: "SEASON" | "CAMPAIGN";
  state: "OPEN" | "RECONCILED" | "COMPOSTED" | "CANCELLED";
  startTime: bigint | null;
  endTime: bigint | null;
  name: string | null;
  nameUnavailable: boolean;
  commitmentsAccepted: bigint;
  commitmentsReadyForConfirmation: bigint;
  commitmentsFulfilled: bigint;
  commitmentsCancelled: bigint;
  commitmentsExpired: bigint;
  commitmentsDisputed: bigint;
  commitmentsDue: bigint;
  openCommitmentCount: bigint;
}

function makeCycle(overrides: Partial<CycleFixture> & { cycleId: bigint }): CycleFixture {
  const n = overrides.cycleId;
  return {
    id: `${CHAIN_ID}-1-${n}`,
    chainId: CHAIN_ID,
    poolId: 1n,
    cycleType: "SEASON",
    state: "RECONCILED",
    startTime: T0 - n * 200n * DAY,
    endTime: T0 - n * 200n * DAY + 150n * DAY,
    name: `Season ${n}`,
    nameUnavailable: false,
    commitmentsAccepted: 10n,
    commitmentsReadyForConfirmation: 0n,
    commitmentsFulfilled: 8n,
    commitmentsCancelled: 0n,
    commitmentsExpired: 0n,
    commitmentsDisputed: 0n,
    commitmentsDue: 9n,
    openCommitmentCount: 0n,
    ...overrides,
  };
}

function makeUnit(overrides: {
  id: string;
  scope: "POOL" | "CYCLE";
  cycleId: bigint | null;
  unitLabel: string;
  expectedUnits: bigint;
  fulfilledUnits: bigint;
}) {
  return {
    chainId: CHAIN_ID,
    scopeId: overrides.cycleId ?? 1n,
    poolId: 1n,
    unitLabelHash: `0x${overrides.unitLabel.length.toString(16).padStart(64, "0")}`,
    approvedUnits: overrides.fulfilledUnits,
    openUnits: overrides.expectedUnits - overrides.fulfilledUnits,
    updatedAt: 1_750_000_000,
    ...overrides,
  };
}

interface PoolDataFixture {
  pool: PoolFixture | null;
  openSeason: CycleFixture | null;
  openCampaigns: CycleFixture[];
  finishedCycles: CycleFixture[];
  poolUnitSummaries: ReturnType<typeof makeUnit>[];
  cycleUnitSummaries: ReturnType<typeof makeUnit>[];
  finishedCycleTotal: number;
  hasCommitmentCertificates: boolean;
  partialData: boolean;
  unavailableSources: { commitmentPool: boolean; cycleMetadata: boolean };
}

function poolData(overrides: Partial<PoolDataFixture> = {}): PoolDataFixture {
  const finishedCycles = overrides.finishedCycles ?? [];
  return {
    pool: makePool(),
    openSeason: null,
    openCampaigns: [],
    finishedCycles,
    poolUnitSummaries: [],
    cycleUnitSummaries: [],
    finishedCycleTotal: finishedCycles.length,
    hasCommitmentCertificates: false,
    partialData: false,
    unavailableSources: { commitmentPool: false, cycleMetadata: false },
    ...overrides,
  };
}

function poolResult(data: PoolDataFixture, extra: Record<string, unknown> = {}) {
  return {
    data,
    isLoading: false,
    isPending: false,
    isFetching: false,
    isPlaceholderData: false,
    refetch: vi.fn(),
    ...extra,
  };
}

function impactData(
  overrides: Partial<{
    openPoolCount: bigint | null;
    commitmentsFulfilled: bigint | null;
    commitmentsDue: bigint | null;
    distinctProviderCount: bigint | null;
    confirmedDisbursementTotal: bigint | null;
    unavailableSources: {
      commitmentPools: boolean;
      distinctProviders: boolean;
      confirmedSettlement: boolean;
    };
  }> = {}
) {
  const unavailableSources = overrides.unavailableSources ?? {
    commitmentPools: false,
    distinctProviders: false,
    confirmedSettlement: false,
  };
  return {
    openPoolCount: 2n,
    commitmentsFulfilled: 43n,
    commitmentsDue: 50n,
    distinctProviderCount: 9n,
    confirmedDisbursementTotal: 312n * 10n ** 18n,
    partialData: Object.values(unavailableSources).some(Boolean),
    unavailableSources,
    ...overrides,
  };
}

const gardenSummary = {
  id: GARDEN_ID,
  address: GARDEN_ID,
  name: "Rocinha Community Garden",
  slug: "rocinha-community-garden",
  description: "A hillside garden",
  location: "Rio de Janeiro",
  bannerImage: "https://example.com/banner.jpg",
  contributorCount: 2,
  actionCount: 2,
  lastActivityAt: 1710000000,
  operators: [GARDENER],
  evaluators: [],
};

function detailResult() {
  return {
    data: {
      garden: {
        id: GARDEN_ID,
        name: "Rocinha Community Garden",
        location: "Rio de Janeiro",
        description: "A hillside garden",
        bannerImage: "https://example.com/banner.jpg",
        operators: [GARDENER],
      },
      fieldNotes: [],
      contributors: [],
      assessmentCount: 3,
      totalFieldNotes: 0,
      partialData: false,
      unavailableSources: { works: false, assessments: false },
    },
    isLoading: false,
  };
}

function withProviders(
  element: ReactElement,
  { locale = "en", messages = en as Record<string, string>, route = "/" } = {}
) {
  return render(
    createElement(
      MemoryRouter,
      { initialEntries: [route] },
      createElement(IntlProvider, { locale, messages }, element)
    )
  );
}

function renderGarden() {
  return withProviders(
    createElement(
      Routes,
      null,
      createElement(Route, { path: "/gardens/:id", element: createElement(GardenDetail) })
    ),
    { route: "/gardens/rocinha-community-garden" }
  );
}

function commitmentsSection(): HTMLElement {
  const section = document.querySelector(
    'section[aria-labelledby="public-garden-detail-commitments"]'
  );
  if (!(section instanceof HTMLElement)) throw new Error("§ 02 commitments section missing");
  return section;
}

function cellValue(label: string): string {
  const cell = screen.getByText(label).closest("div") as HTMLElement;
  return (cell.querySelector("dd")?.textContent ?? "").trim();
}

function markerValue(label: string): string {
  const marker = screen.getByText(label).closest("div") as HTMLElement;
  return (marker.querySelector("dd")?.textContent ?? "").trim();
}

beforeEach(() => {
  vi.clearAllMocks();
  mockUsePublicGardens.mockReturnValue({ data: [gardenSummary], isLoading: false });
  mockUsePublicGardenDetail.mockReturnValue(detailResult());
  mockUseHypercerts.mockReturnValue({ hypercerts: [], isLoading: false });
  mockUsePublicGardenPool.mockReturnValue(poolResult(poolData()));
  mockUsePublicCommitmentImpact.mockReturnValue({ data: impactData(), isLoading: false });
  mockUsePublicStats.mockReturnValue({
    data: { gardenCount: 5, contributorCount: 12, fieldNoteCount: 30, attestationCount: 7 },
    isLoading: false,
  });
  mockUsePublicImpactEvidence.mockReturnValue({
    data: {
      records: [],
      page: 1,
      pageSize: 12,
      totalFetchedRecords: 0,
      partialData: false,
      sourceLimitReached: false,
      status: "empty",
    },
    isLoading: false,
  });
  mockUseApp.mockReturnValue({
    isMobile: false,
    isInstalled: false,
    platform: "unknown",
    deferredPrompt: null,
  });
});

// ---------------------------------------------------------------------------
// PublicEvidencePipeline
// ---------------------------------------------------------------------------

describe("PublicEvidencePipeline", () => {
  it("renders the five stages as an ordered list in the required order", () => {
    withProviders(
      createElement(PublicEvidencePipeline, { title: "The cycle", titleId: "pipeline-title" })
    );
    const list = screen.getByRole("list", { name: en["public.impact.pipeline.figureLabel"] });
    expect(list.tagName).toBe("OL");
    const titles = within(list)
      .getAllByRole("listitem")
      .map((item) => within(item).getByRole("heading", { level: 3 }).textContent?.trim());
    expect(titles).toEqual([
      "Assessment",
      "Commitment",
      "Work",
      "Confirmation",
      "Impact Certificate",
    ]);
    // The loop closes on the last node, not somewhere in the middle.
    const items = within(list).getAllByRole("listitem");
    expect(items[4]).toHaveTextContent(en["public.impact.pipeline.closesCycle"]);
    expect(items[1]).not.toHaveTextContent(en["public.impact.pipeline.closesCycle"]);
  });

  it("localizes every node title, description, and definition rather than hardcoding English", () => {
    withProviders(
      createElement(PublicEvidencePipeline, { title: "El ciclo", titleId: "pipeline-title" }),
      { locale: "es", messages: es as Record<string, string> }
    );
    const list = screen.getByRole("list", { name: es["public.impact.pipeline.figureLabel"] });
    const titles = within(list)
      .getAllByRole("listitem")
      .map((item) => within(item).getByRole("heading", { level: 3 }).textContent?.trim());
    expect(titles).toEqual([
      "Evaluación",
      "Compromiso",
      "Trabajo",
      "Confirmación",
      "Certificado de Impacto",
    ]);
    expect(list).toHaveTextContent(es["public.impact.pipeline.node.commitment.description"]);
    expect(list).toHaveTextContent(es["public.impact.pipeline.node.confirmation.description"]);
    expect(list).not.toHaveTextContent("Work begins as a commitment to someone");
    expect(list).toHaveTextContent(es["public.impact.pipeline.closesCycle"]);

    // Tooltip definitions come from the shared first-exposure family.
    fireEvent.click(within(list).getByRole("button", { name: "Compromiso" }));
    expect(screen.getByRole("tooltip")).toHaveTextContent(es["public.pool.terms.commitment"]);
  });

  it("keeps the evidence ledger's record kinds unchanged", () => {
    expect(Object.keys(EVIDENCE_KIND_LABELS)).toEqual(["assessment", "work", "certificate"]);

    withProviders(createElement(ImpactPage));
    const filters = screen.getByRole("navigation", { name: en["public.impact.filters.label"] });
    const chips = within(filters)
      .getAllByRole("button", { pressed: false })
      .concat(within(filters).getAllByRole("button", { pressed: true }))
      .map((chip) => chip.textContent?.replace(/\d+$/, "").trim());
    expect(chips).not.toContain("Commitment");
    expect(chips).not.toContain("Confirmation");
    expect(chips).toEqual(
      expect.arrayContaining(["All", "Assessment", "Work", "Impact Certificate"])
    );
  });

  it("names a ledger record's kind through the same localized keys as the filters", () => {
    mockUsePublicImpactEvidence.mockReturnValue({
      data: {
        records: [
          {
            id: "certificate:1",
            kind: "certificate",
            gardenId: GARDEN_ID,
            gardenName: "Rocinha Community Garden",
            title: "Season of Repair: terraces",
            hypercertId: "1",
            sourceAvailable: true,
            createdAt: 1_710_000_000,
          },
        ],
        page: 1,
        pageSize: 12,
        totalFetchedRecords: 1,
        partialData: false,
        sourceLimitReached: false,
        status: "ready",
      },
      isLoading: false,
    });
    withProviders(createElement(ImpactPage), { locale: "es", messages: es });
    const card = screen.getByRole("button", { name: "Season of Repair: terraces" });
    expect(card).toHaveTextContent(es["public.impact.kind.certificate"]);
    expect(card).not.toHaveTextContent("Impact Certificate");
  });

  it("formats a record's time window in the visitor's locale and survives an unrepresentable date", () => {
    mockUsePublicImpactEvidence.mockReturnValue({
      data: {
        records: [
          {
            id: "work:0xabcd",
            kind: "work",
            gardenId: GARDEN_ID,
            gardenName: "Rocinha Community Garden",
            title: "Terracing the upper slope",
            // Start is 14 Nov 2023; the end is past what `Date` can hold.
            timeWindow: { start: 1_700_000_000, end: 8_640_000_000_001 },
            easUid: "0xabcd",
            sourceAvailable: true,
            createdAt: 1_700_000_000,
          },
        ],
        page: 1,
        pageSize: 12,
        totalFetchedRecords: 1,
        partialData: false,
        sourceLimitReached: false,
        status: "ready",
      },
      isLoading: false,
    });
    withProviders(createElement(ImpactPage), { locale: "es", messages: es });
    fireEvent.click(screen.getByRole("button", { name: "Terracing the upper slope" }));
    const dialog = screen.getByRole("dialog");
    const window = within(dialog).getByText(es["public.impact.dialog.meta.timeWindow"])
      .nextElementSibling as HTMLElement;
    expect(window).toHaveTextContent(/nov/i);
    expect(window).not.toHaveTextContent(/Nov 14, 2023/);
    expect(window).not.toHaveTextContent("→");
  });
});

// ---------------------------------------------------------------------------
// /gardens/:id § 02 Commitments
// ---------------------------------------------------------------------------

describe("GardenDetail § 02 Commitments", () => {
  it("sits between field notes and certificates with the ordinals renumbered", () => {
    const { container } = renderGarden();
    // The hero is a labelled section too; the record ladder starts after it.
    const sections = Array.from(
      container.querySelectorAll('section[aria-labelledby^="public-garden-detail-"]')
    )
      .map((section) => section.getAttribute("aria-labelledby"))
      .filter((id) => id !== "public-garden-detail-title");
    expect(sections).toEqual([
      "public-garden-detail-notes",
      "public-garden-detail-commitments",
      "public-garden-detail-certificates",
      "public-garden-detail-operators",
    ]);
    expect(screen.getByText("§ 01: Field notes")).toBeInTheDocument();
    expect(screen.getByText("§ 02: Commitments")).toBeInTheDocument();
    expect(screen.getByText("§ 03: Certificates")).toBeInTheDocument();
    expect(screen.getByText("§ 04: Operators")).toBeInTheDocument();
    expect(mockUsePublicGardenPool).toHaveBeenCalledWith(GARDEN_ID, {
      chainId: CHAIN_ID,
      historyLimit: 12,
    });
  });

  it("renders readiness copy and no statistics when the Garden has no pool yet", () => {
    mockUsePublicGardenPool.mockReturnValue(poolResult(poolData({ pool: null })));
    renderGarden();
    const section = commitmentsSection();
    expect(within(section).getByRole("heading", { level: 2 })).toHaveTextContent(
      en["public.pool.garden.heading.preparing"]
    );
    expect(section).toHaveTextContent(en["public.pool.garden.state.notReady"]);
    expect(within(section).queryByText(en["public.pool.garden.record.made"])).toBeNull();
    // No numbers beyond the ordinal in the kicker.
    const body = (section.textContent ?? "").replace(en["public.pool.garden.kicker"], "");
    expect(body).not.toMatch(/\d/);
  });

  it("holds the record's frame while the pool is still loading, without printing a number", () => {
    mockUsePublicGardenPool.mockReturnValue({
      data: undefined,
      isLoading: true,
      isPending: true,
      refetch: vi.fn(),
    });
    renderGarden();
    const section = commitmentsSection();
    expect(within(section).getByText(en["public.pool.garden.record.made"])).toBeInTheDocument();
    expect(within(section).getByText(en["public.pool.garden.record.kept"])).toBeInTheDocument();
    expect(within(section).queryByText(en["public.pool.garden.record.keptRate"])).toBeNull();
    const body = (section.textContent ?? "").replace(en["public.pool.garden.kicker"], "");
    expect(body).not.toMatch(/\d/);
    expect(body).not.toContain("—");
  });

  it("uses ready-state copy for a READY pool without fabricating live statistics", () => {
    mockUsePublicGardenPool.mockReturnValue(
      poolResult(poolData({ pool: makePool({ state: "READY", commitmentsAccepted: 0n }) }))
    );
    renderGarden();
    const section = commitmentsSection();
    expect(section).toHaveTextContent(en["public.pool.garden.state.ready"]);
    expect(within(section).queryByText(en["public.pool.garden.record.made"])).toBeNull();
  });

  it("publishes the kept rate at exactly 5 due and 3 distinct providers", () => {
    mockUsePublicGardenPool.mockReturnValue(
      poolResult(
        poolData({
          pool: makePool({
            commitmentsAccepted: 10n,
            commitmentsFulfilled: 4n,
            commitmentsDue: 5n,
            distinctProviderCount: 3n,
          }),
        })
      )
    );
    renderGarden();
    expect(cellValue(en["public.pool.garden.record.made"])).toBe("10");
    expect(cellValue(en["public.pool.garden.record.kept"])).toBe("4");
    // fulfilled / due, never fulfilled / made (4 / 10 would read 40%).
    expect(cellValue(en["public.pool.garden.record.keptRate"])).toBe("80%");
    expect(commitmentsSection()).toHaveTextContent(en["public.pool.garden.record.keptRateNote"]);
  });

  it("shows counts only at 4 due commitments", () => {
    mockUsePublicGardenPool.mockReturnValue(
      poolResult(
        poolData({
          pool: makePool({
            commitmentsAccepted: 9n,
            commitmentsFulfilled: 3n,
            commitmentsDue: 4n,
            distinctProviderCount: 6n,
          }),
        })
      )
    );
    renderGarden();
    const section = commitmentsSection();
    expect(cellValue(en["public.pool.garden.record.made"])).toBe("9");
    expect(cellValue(en["public.pool.garden.record.kept"])).toBe("3");
    expect(within(section).queryByText(en["public.pool.garden.record.keptRate"])).toBeNull();
    expect(section.textContent).not.toMatch(/%/);
    expect(section).toHaveTextContent(en["public.pool.garden.record.countsOnlyNote"]);
  });

  it("shows counts only at 2 distinct providers", () => {
    mockUsePublicGardenPool.mockReturnValue(
      poolResult(
        poolData({
          pool: makePool({
            commitmentsAccepted: 9n,
            commitmentsFulfilled: 7n,
            commitmentsDue: 8n,
            distinctProviderCount: 2n,
          }),
        })
      )
    );
    renderGarden();
    const section = commitmentsSection();
    expect(within(section).queryByText(en["public.pool.garden.record.keptRate"])).toBeNull();
    expect(section.textContent).not.toMatch(/%/);
  });

  it("renders an open Season and an open Campaign as separate rows, each naming its own scope", () => {
    const season = makeCycle({
      cycleId: 7n,
      state: "OPEN",
      name: "Season of First Rains",
      commitmentsAccepted: 9n,
      commitmentsFulfilled: 7n,
      endTime: T0 + 30n * DAY,
    });
    const campaign = makeCycle({
      cycleId: 8n,
      state: "OPEN",
      cycleType: "CAMPAIGN",
      name: "Mutirão de Agosto",
      commitmentsAccepted: 4n,
      commitmentsFulfilled: 1n,
      endTime: null,
    });
    mockUsePublicGardenPool.mockReturnValue(
      poolResult(
        poolData({
          openSeason: season,
          openCampaigns: [campaign],
          cycleUnitSummaries: [
            makeUnit({
              id: "c7-hours",
              scope: "CYCLE",
              cycleId: 7n,
              unitLabel: "hours",
              expectedUnits: 52n,
              fulfilledUnits: 25n,
            }),
            makeUnit({
              id: "c7-Hours",
              scope: "CYCLE",
              cycleId: 7n,
              unitLabel: "Hours",
              expectedUnits: 10n,
              fulfilledUnits: 2n,
            }),
            makeUnit({
              id: "c8-rides",
              scope: "CYCLE",
              cycleId: 8n,
              unitLabel: "rides",
              expectedUnits: 16n,
              fulfilledUnits: 9n,
            }),
          ],
          poolUnitSummaries: [
            makeUnit({
              id: "p-hours",
              scope: "POOL",
              cycleId: null,
              unitLabel: "hours",
              expectedUnits: 140n,
              fulfilledUnits: 90n,
            }),
          ],
        })
      )
    );
    renderGarden();
    const section = commitmentsSection();

    const seasonRow = within(section)
      .getByText("Season of First Rains")
      .closest("li") as HTMLElement;
    expect(seasonRow).toHaveTextContent(/Season · Open now · Runs through/);
    expect(seasonRow).toHaveTextContent("9 made · 7 kept so far");
    // Exact labels keep their own rows: "hours" and "Hours" are never merged.
    expect(within(seasonRow).getByText("hours").nextElementSibling).toHaveTextContent("25 of 52");
    expect(within(seasonRow).getByText("Hours").nextElementSibling).toHaveTextContent("2 of 10");
    expect(seasonRow).not.toHaveTextContent("rides");

    const campaignRow = within(section).getByText("Mutirão de Agosto").closest("li") as HTMLElement;
    expect(campaignRow).toHaveTextContent(/Campaign · Open now/);
    expect(campaignRow).not.toHaveTextContent("Season");
    expect(campaignRow).toHaveTextContent("4 made · 1 kept so far");
    expect(within(campaignRow).getByText("rides").nextElementSibling).toHaveTextContent("9 of 16");

    // One block kicker over both rows, and it does not repeat each row's
    // own "Open now" so neither reading doubles the other.
    expect(within(section).getAllByText(en["public.pool.garden.openKicker"])).toHaveLength(1);
    expect(en["public.pool.garden.openKicker"]).not.toBe(en["public.pool.garden.cycle.openNow"]);

    // Pool-scope rows stay separate from the cycle rows.
    const poolUnits = within(section).getByText(en["public.pool.garden.units.pool"])
      .parentElement as HTMLElement;
    expect(poolUnits).toHaveTextContent("90 of 140");
    // The lifetime record may carry the one sanctioned percentage; cycle and
    // unit rows never do — no combined progress band, no per-cycle rate.
    for (const block of [seasonRow, campaignRow, poolUnits]) {
      expect(block.textContent).not.toMatch(/%/);
    }
  });

  it("lists finished cycles newest first, twelve at a time, with campaigns beside seasons", () => {
    const finished = Array.from({ length: 14 }, (_, i) =>
      makeCycle({
        cycleId: BigInt(i + 1),
        name: i === 2 ? "Summer Mutirão" : `Season ${i + 1}`,
        cycleType: i === 2 ? "CAMPAIGN" : "SEASON",
        state: i % 2 === 0 ? "RECONCILED" : "COMPOSTED",
        commitmentsAccepted: 12n,
        commitmentsFulfilled: 10n,
      })
    );
    // The reader cuts the window before resolving metadata; the mock answers
    // each requested window the way the data boundary would.
    mockUsePublicGardenPool.mockImplementation(
      (_garden: unknown, options: { historyLimit?: number } = {}) =>
        poolResult(
          poolData({
            finishedCycles: finished.slice(0, options.historyLimit ?? 12),
            finishedCycleTotal: finished.length,
          })
        )
    );
    renderGarden();
    const section = commitmentsSection();
    const history = within(section).getByText(en["public.pool.garden.history.kicker"])
      .parentElement as HTMLElement;

    const names = () =>
      within(history)
        .getAllByRole("listitem")
        .map((row) => row.querySelector("p")?.textContent);
    expect(names()).toHaveLength(12);
    expect(names()[0]).toBe("Season 1");
    expect(names()[2]).toBe("Summer Mutirão");
    expect(within(history).getByText("Summer Mutirão").closest("li")).toHaveTextContent(
      /Campaign ·/
    );
    expect(within(history).getAllByText("10 of 12 kept")).toHaveLength(12);
    expect(within(history).getByText("Showing 12 of 14")).toBeInTheDocument();

    fireEvent.click(
      within(history).getByRole("button", { name: en["public.pool.garden.history.loadMore"] })
    );
    expect(names()).toHaveLength(14);
    // Paging asked the data boundary for a wider window rather than slicing
    // a fully resolved history on the client.
    expect(mockUsePublicGardenPool).toHaveBeenLastCalledWith(
      GARDEN_ID,
      expect.objectContaining({ historyLimit: 24 })
    );
    expect(within(history).getByText("Showing 14 of 14")).toBeInTheDocument();
    expect(
      within(history).queryByRole("button", { name: en["public.pool.garden.history.loadMore"] })
    ).toBeNull();
    // The control unmounted under the reader; focus moves to the line that
    // announces the change rather than falling to the document body.
    expect(document.activeElement).toBe(within(history).getByText("Showing 14 of 14"));
  });

  it("never renders a cancelled cycle", () => {
    mockUsePublicGardenPool.mockReturnValue(
      poolResult(
        poolData({
          finishedCycles: [
            makeCycle({ cycleId: 2n, name: "Season of Repair" }),
            makeCycle({ cycleId: 3n, name: "Cancelled Harvest", state: "CANCELLED" }),
          ],
        })
      )
    );
    renderGarden();
    const section = commitmentsSection();
    expect(within(section).getByText("Season of Repair")).toBeInTheDocument();
    expect(within(section).queryByText("Cancelled Harvest")).toBeNull();
    expect(section.textContent).not.toMatch(/cancel/i);
  });

  it("uses the closed lifetime snapshot between seasons and includes the newly finished cycle", () => {
    mockUsePublicGardenPool.mockReturnValue(
      poolResult(
        poolData({
          pool: makePool({
            commitmentsAccepted: 43n,
            commitmentsFulfilled: 35n,
            commitmentsDue: 40n,
            distinctProviderCount: 12n,
          }),
          openSeason: null,
          openCampaigns: [],
          finishedCycles: [
            makeCycle({
              cycleId: 4n,
              name: "Season of First Rains",
              commitmentsAccepted: 14n,
              commitmentsFulfilled: 11n,
            }),
            makeCycle({ cycleId: 3n, name: "Season of Repair" }),
          ],
        })
      )
    );
    renderGarden();
    const section = commitmentsSection();
    expect(section).toHaveTextContent(en["public.pool.garden.state.betweenSeasons"]);
    expect(cellValue(en["public.pool.garden.record.made"])).toBe("43");
    expect(cellValue(en["public.pool.garden.record.kept"])).toBe("35");
    expect(within(section).getByText("Season of First Rains").closest("li")).toHaveTextContent(
      "11 of 14 kept"
    );
    expect(within(section).queryByText(en["public.pool.garden.cycle.openNow"])).toBeNull();
  });

  it("keeps the record visible with neutral quiet-period copy while paused", () => {
    mockUsePublicGardenPool.mockReturnValue(
      poolResult(poolData({ pool: makePool({ state: "PAUSED" }) }))
    );
    renderGarden();
    const section = commitmentsSection();
    expect(section).toHaveTextContent(en["public.pool.garden.state.paused"]);
    expect(cellValue(en["public.pool.garden.record.made"])).toBe("30");
    expect(section.textContent).not.toMatch(/reason|CID/i);
  });

  it("renders em dashes and retry copy, never zeros, when the pool read failed", () => {
    const refetch = vi.fn();
    mockUsePublicGardenPool.mockReturnValue({
      data: poolData({
        pool: null,
        partialData: true,
        unavailableSources: { commitmentPool: true, cycleMetadata: false },
      }),
      isLoading: false,
      isPending: false,
      refetch,
    });
    renderGarden();
    const section = commitmentsSection();
    expect(section).toHaveTextContent(en["public.pool.garden.unavailable"]);
    const made = screen
      .getByText(en["public.pool.garden.record.made"])
      .closest("div") as HTMLElement;
    expect(within(made).getByText("—")).toBeInTheDocument();
    expect(within(made).queryByText("0")).toBeNull();
    expect(within(made).getByText(en["public.gardenDetail.stats.unknown"])).toBeInTheDocument();
    expect(section).not.toHaveTextContent(en["public.pool.garden.heading.preparing"]);

    fireEvent.click(within(section).getByRole("button", { name: en["public.gardenDetail.retry"] }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("preserves a cycle whose metadata is missing with an unavailable-name treatment", () => {
    mockUsePublicGardenPool.mockReturnValue(
      poolResult(
        poolData({
          finishedCycles: [makeCycle({ cycleId: 2n, name: null, nameUnavailable: true })],
          partialData: true,
          unavailableSources: { commitmentPool: false, cycleMetadata: true },
        })
      )
    );
    renderGarden();
    const section = commitmentsSection();
    expect(
      within(section).getByText(en["public.pool.garden.cycle.nameUnavailable"])
    ).toBeInTheDocument();
    expect(section).toHaveTextContent("8 of 10 kept");
    expect(section).toHaveTextContent(en["public.pool.garden.partial"]);
    expect(section.textContent).not.toMatch(/Qm[1-9A-HJ-NP-Za-km-z]{44}|bafy/);
  });

  it("keeps the page visible when a background refetch of the pool fails", () => {
    mockUsePublicGardenPool.mockReturnValue(poolResult(poolData(), { isError: true }));
    renderGarden();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Rocinha Community Garden");
    expect(cellValue(en["public.pool.garden.record.made"])).toBe("30");
  });

  it("treats a read that settled without data as unavailable, not as a Garden preparing its pool", () => {
    const refetch = vi.fn();
    mockUsePublicGardenPool.mockReturnValue({
      data: undefined,
      isLoading: false,
      isPending: false,
      refetch,
    });
    renderGarden();
    const section = commitmentsSection();
    expect(within(section).getByRole("heading", { level: 2 })).toHaveTextContent(
      en["public.pool.garden.heading"]
    );
    expect(section).not.toHaveTextContent(en["public.pool.garden.heading.preparing"]);
    expect(section).toHaveTextContent(en["public.pool.garden.unavailable"]);
    const made = screen
      .getByText(en["public.pool.garden.record.made"])
      .closest("div") as HTMLElement;
    expect(within(made).getByText("—")).toBeInTheDocument();
  });

  it("names an open Season that has no commitments yet without printing a zero progress line", () => {
    mockUsePublicGardenPool.mockReturnValue(
      poolResult(
        poolData({
          pool: makePool({ commitmentsAccepted: 0n, commitmentsFulfilled: 0n, commitmentsDue: 0n }),
          openSeason: makeCycle({
            cycleId: 7n,
            state: "OPEN",
            name: "Season of First Rains",
            commitmentsAccepted: 0n,
            commitmentsFulfilled: 0n,
            endTime: T0 + 30n * DAY,
          }),
        })
      )
    );
    renderGarden();
    const section = commitmentsSection();
    expect(section).toHaveTextContent(en["public.pool.garden.empty"]);
    const seasonRow = within(section)
      .getByText("Season of First Rains")
      .closest("li") as HTMLElement;
    expect(seasonRow).toHaveTextContent(/Season · Open now · Runs through/);
    expect(seasonRow.textContent).not.toMatch(/made|kept so far/);
    expect(within(section).queryByText(en["public.pool.garden.record.made"])).toBeNull();
  });

  it("says so when an open pool has no commitments yet", () => {
    mockUsePublicGardenPool.mockReturnValue(
      poolResult(
        poolData({
          pool: makePool({ commitmentsAccepted: 0n, commitmentsFulfilled: 0n, commitmentsDue: 0n }),
        })
      )
    );
    renderGarden();
    const section = commitmentsSection();
    expect(section).toHaveTextContent(en["public.pool.garden.empty"]);
    expect(within(section).queryByText(en["public.pool.garden.record.made"])).toBeNull();
  });

  it("links fulfilled commitments into the certificates section only when a certificate bundles commitments", () => {
    mockUsePublicGardenPool.mockReturnValue(
      poolResult(poolData({ hasCommitmentCertificates: true }))
    );
    mockUseHypercerts.mockReturnValue({
      hypercerts: [
        { id: "hc-1", title: "Season of Repair: terraces", attestationCount: 12, workScopes: [] },
      ],
      isLoading: false,
    });
    renderGarden();
    const section = commitmentsSection();
    expect(section).toHaveTextContent(en["public.pool.garden.certificatesTieIn"]);
    const link = within(section).getByRole("link", {
      name: en["public.pool.garden.certificatesLink"],
    });
    expect(link).toHaveAttribute("href", "#public-garden-detail-certificates");
    expect(document.getElementById("public-garden-detail-certificates")).not.toBeNull();
  });

  it("makes no anchoring claim when the Garden's certificates are legacy Work bundles", () => {
    // A certificate exists in § 03, but the indexer reports no commitment
    // bundle for this Garden: presence is not linkage, so no anchor is claimed.
    mockUseHypercerts.mockReturnValue({
      hypercerts: [
        { id: "hc-legacy", title: "Planting season 2025", attestationCount: 8, workScopes: [] },
      ],
      isLoading: false,
    });
    renderGarden();
    const section = commitmentsSection();
    expect(cellValue(en["public.pool.garden.record.kept"])).toBe("24");
    expect(document.getElementById("public-garden-detail-certificates")).not.toBeNull();
    expect(section).not.toHaveTextContent(en["public.pool.garden.certificatesTieIn"]);
    expect(
      within(section).queryByRole("link", { name: en["public.pool.garden.certificatesLink"] })
    ).toBeNull();
  });

  it("never rounds a near-boundary kept rate into a categorical claim", () => {
    mockUsePublicGardenPool.mockReturnValue(
      poolResult(
        poolData({
          pool: makePool({
            commitmentsAccepted: 1_000n,
            commitmentsFulfilled: 999n,
            commitmentsDue: 1_000n,
            distinctProviderCount: 9n,
          }),
        })
      )
    );
    const { unmount } = renderGarden();
    expect(cellValue(en["public.pool.garden.record.keptRate"])).toBe(">99%");
    unmount();

    mockUsePublicGardenPool.mockReturnValue(
      poolResult(
        poolData({
          pool: makePool({
            commitmentsAccepted: 1_000n,
            commitmentsFulfilled: 1n,
            commitmentsDue: 1_000n,
            distinctProviderCount: 9n,
          }),
        })
      )
    );
    const second = renderGarden();
    expect(cellValue(en["public.pool.garden.record.keptRate"])).toBe("<1%");
    second.unmount();

    // Every decision is integer arithmetic on the counters: a uint256-scale
    // record a hair under 99.5% narrows to exactly 0.995 as a double, which a
    // float formatter would round up to "100%". It must read as 99%.
    mockUsePublicGardenPool.mockReturnValue(
      poolResult(
        poolData({
          pool: makePool({
            commitmentsAccepted: 10n ** 30n,
            commitmentsFulfilled: 995n * 10n ** 27n - 1n,
            commitmentsDue: 10n ** 30n,
            distinctProviderCount: 9n,
          }),
        })
      )
    );
    renderGarden();
    expect(cellValue(en["public.pool.garden.record.keptRate"])).toBe("99%");
  });

  it("never exposes a provider address, provider-level outcome, or cancelled and disputed counts", () => {
    mockUsePublicGardenPool.mockReturnValue(
      poolResult(
        poolData({
          pool: makePool({ commitmentsCancelled: 7n, commitmentsDisputed: 5n }),
          openSeason: makeCycle({ cycleId: 7n, state: "OPEN", name: "Season of First Rains" }),
        })
      )
    );
    renderGarden();
    const text = commitmentsSection().textContent ?? "";
    expect(text).not.toContain(PROVIDER);
    expect(text).not.toContain(GARDENER);
    expect(text).not.toMatch(/0x[0-9a-fA-F]{6,}/);
    expect(text).not.toMatch(/reliab|rank|disput|cancel|lapsed|score/i);
    expect(text).not.toMatch(/\b7\b|\b5\b/);
  });
});

// ---------------------------------------------------------------------------
// /impact § 02 commitments band
// ---------------------------------------------------------------------------

describe("/impact commitments band", () => {
  it("sits between § 01 proof markers and § 03 the cycle", () => {
    withProviders(createElement(ImpactPage));
    const labelled = Array.from(document.querySelectorAll("section[aria-labelledby]"))
      .map((s) => s.getAttribute("aria-labelledby"))
      .filter((id) => id !== "public-impact-hero-title");
    expect(labelled.slice(0, 4)).toEqual([
      "public-impact-proof-title",
      "public-impact-commitments-title",
      "public-impact-pipeline-title",
      "public-impact-ledger-title",
    ]);
    expect(screen.getByText("§ 01: Proof markers")).toBeInTheDocument();
    expect(screen.getByText("§ 02: Commitments")).toBeInTheDocument();
    expect(screen.getByText("§ 03: The cycle")).toBeInTheDocument();
    expect(screen.getByText("§ 04: Evidence ledger")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /See the Gardens/ })).toHaveAttribute(
      "href",
      "/gardens"
    );
  });

  it("keeps the open-pool count and the lifetime fulfilled total distinct", () => {
    withProviders(createElement(PublicCommitmentsBand));
    expect(markerValue(en["public.pool.impact.openPools.label"])).toBe("2");
    expect(markerValue(en["public.pool.impact.fulfilled.label"])).toBe("43");
    const fulfilled = screen
      .getByText(en["public.pool.impact.fulfilled.label"])
      .closest("div") as HTMLElement;
    expect(fulfilled).toHaveTextContent(/Lifetime/);
    expect(fulfilled.textContent).not.toMatch(/this season/i);
    expect(mockUsePublicCommitmentImpact).toHaveBeenCalledWith(CHAIN_ID);
  });

  it("publishes the protocol-wide kept rate only from the selector's rate branch", () => {
    withProviders(createElement(PublicCommitmentsBand));
    // 43 of 50 due, 9 providers: above threshold, fulfilled / due.
    expect(markerValue(en["public.pool.impact.kept.label"])).toBe("86%");
  });

  it("shows counts only below the public threshold", () => {
    mockUsePublicCommitmentImpact.mockReturnValue({
      data: impactData({ commitmentsFulfilled: 3n, commitmentsDue: 4n, distinctProviderCount: 9n }),
      isLoading: false,
    });
    const { container } = withProviders(createElement(PublicCommitmentsBand));
    expect(markerValue(en["public.pool.impact.kept.label"])).toBe("3 of 4");
    expect(container.textContent).not.toMatch(/%/);

    mockUsePublicCommitmentImpact.mockReturnValue({
      data: impactData({
        commitmentsFulfilled: 40n,
        commitmentsDue: 50n,
        distinctProviderCount: 2n,
      }),
      isLoading: false,
    });
    const second = withProviders(createElement(PublicCommitmentsBand));
    expect(second.container.textContent).not.toMatch(/%/);
  });

  it("shows confirmed support in G$ without implying queued or dispatched arrival", () => {
    const { container } = withProviders(createElement(PublicCommitmentsBand));
    expect(markerValue(en["public.pool.impact.support.label"])).toBe("312 G$");
    expect(container.textContent).not.toMatch(/312000000000000000000/);
    expect(container.textContent).not.toMatch(/queued|dispatched|pending/i);
    // "Support arrived" is the only arrival language, and it names the confirmed figure.
    expect(container.textContent?.match(/arrived/g)).toHaveLength(1);
  });

  it("renders an em dash for an unavailable aggregate and never a zero", () => {
    mockUsePublicCommitmentImpact.mockReturnValue({
      data: impactData({
        openPoolCount: null,
        commitmentsFulfilled: null,
        commitmentsDue: null,
        distinctProviderCount: null,
        confirmedDisbursementTotal: null,
        unavailableSources: {
          commitmentPools: true,
          distinctProviders: true,
          confirmedSettlement: true,
        },
      }),
      isLoading: false,
    });
    const { container } = withProviders(createElement(PublicCommitmentsBand));
    for (const label of [
      en["public.pool.impact.openPools.label"],
      en["public.pool.impact.fulfilled.label"],
      en["public.pool.impact.kept.label"],
      en["public.pool.impact.support.label"],
    ]) {
      const marker = screen.getByText(label).closest("div") as HTMLElement;
      expect(within(marker).getByText("—")).toBeInTheDocument();
      expect(within(marker).getByText(en["public.impact.proof.unavailable"])).toBeInTheDocument();
      expect(within(marker).queryByText("0")).toBeNull();
    }
    expect(container).toHaveTextContent(en["public.pool.impact.partial"]);
  });

  it("dashes only the failed source when the settlement read fails", () => {
    mockUsePublicCommitmentImpact.mockReturnValue({
      data: impactData({
        confirmedDisbursementTotal: null,
        unavailableSources: {
          commitmentPools: false,
          distinctProviders: false,
          confirmedSettlement: true,
        },
      }),
      isLoading: false,
    });
    withProviders(createElement(PublicCommitmentsBand));
    expect(markerValue(en["public.pool.impact.openPools.label"])).toBe("2");
    expect(markerValue(en["public.pool.impact.kept.label"])).toBe("86%");
    const support = screen
      .getByText(en["public.pool.impact.support.label"])
      .closest("div") as HTMLElement;
    expect(within(support).getByText("—")).toBeInTheDocument();
  });

  it("uses readiness phrasing rather than live zeros before any pool opens", () => {
    mockUsePublicCommitmentImpact.mockReturnValue({
      data: impactData({
        openPoolCount: 0n,
        commitmentsFulfilled: 0n,
        commitmentsDue: 0n,
        distinctProviderCount: 0n,
        confirmedDisbursementTotal: 0n,
      }),
      isLoading: false,
    });
    const { container } = withProviders(createElement(PublicCommitmentsBand));
    expect(markerValue(en["public.pool.impact.openPools.label"])).toBe(
      en["public.pool.impact.noneYet"]
    );
    expect(markerValue(en["public.pool.impact.kept.label"])).toBe(
      en["public.pool.impact.kept.noneDue"]
    );
    expect(markerValue(en["public.pool.impact.support.label"])).toBe(
      en["public.pool.impact.noneYet"]
    );
    expect(container.textContent).not.toMatch(/\b0\b/);
  });

  it("never renders a provider address or per-garden ordering", () => {
    const { container } = withProviders(createElement(PublicCommitmentsBand));
    expect(container.textContent).not.toMatch(/0x[0-9a-fA-F]{6,}/);
    expect(container.querySelector("table")).toBeNull();
    expect(container.textContent).not.toMatch(/rank|top garden|most/i);
  });
});
