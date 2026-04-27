/**
 * Public Impact View Tests
 *
 * Locks the v1 evidence ledger contract:
 * - Confirmed counts come from `usePublicStats` (not `useGardens`).
 * - Evidence cards come from `usePublicImpactEvidence` and open a
 *   source-anchored dialog.
 * - Honest states: loading, empty, EAS error, partialData,
 *   sourceLimitReached.
 *
 * @vitest-environment jsdom
 */

import { render, screen, within } from "@testing-library/react";
import { createElement } from "react";
import { IntlProvider } from "react-intl";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockStats = {
  gardenCount: 5,
  contributorCount: 12,
  fieldNoteCount: 30,
  attestationCount: 7,
};

const mockSliceReady = {
  records: [
    {
      id: "rec-1",
      gardenId: "0x1",
      gardenName: "Solar Garden",
      title: "Q3 Soil Renewal",
      summary: "Restoration of 2 acres of degraded land",
      domain: 1,
      timeWindow: { start: 1700000000, end: 1710000000 },
      easUid: "0xabcd",
      sourceAvailable: true,
      createdAt: 1710000000,
    },
    {
      id: "rec-2",
      gardenId: "0x2",
      gardenName: "Compost Hub",
      title: "Composting Pilot",
      domain: 3,
      sourceAvailable: false,
      createdAt: 1690000000,
    },
  ],
  page: 1,
  pageSize: 12,
  totalFetchedRecords: 2,
  partialData: false,
  sourceLimitReached: false,
  status: "ready" as const,
};

const mockUsePublicStats = vi.fn();
const mockUsePublicImpactEvidence = vi.fn();

vi.mock("@green-goods/shared", async () => {
  const actual = await vi.importActual<typeof import("@green-goods/shared")>("@green-goods/shared");
  return {
    ...actual,
    usePublicStats: () => mockUsePublicStats(),
    usePublicImpactEvidence: () => mockUsePublicImpactEvidence(),
  };
});

import ImpactPage from "../../views/Public/Impact";

const messages: Record<string, string> = {
  "public.impact.title": "Impact",
  "public.impact.kicker": "Public evidence ledger",
  "public.impact.description": "Confirmed counts and recent evidence.",
  "public.impact.statsTitle": "Impact stats",
  "public.impact.totalAssessments": "Total Assessments",
  "public.impact.totalGardens": "Total Gardens",
  "public.impact.totalContributors": "Total Contributors",
  "public.impact.evidence.title": "Recent evidence",
  "public.impact.evidence.empty": "Assessment evidence will appear here.",
  "public.impact.evidence.error": "Evidence is temporarily unavailable.",
  "public.impact.evidence.partialData": "Showing partial evidence.",
  "public.impact.evidence.sourceLimitReached": "Capped slice.",
  "public.impact.evidence.viewSource": "View source",
  "public.impact.evidence.noSource": "Source pending",
};

function renderView() {
  return render(
    createElement(
      MemoryRouter,
      null,
      createElement(IntlProvider, { locale: "en", messages }, createElement(ImpactPage))
    )
  );
}

describe("ImpactPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUsePublicStats.mockReturnValue({ data: mockStats, isLoading: false });
    mockUsePublicImpactEvidence.mockReturnValue({ data: mockSliceReady, isLoading: false });
  });

  it("renders the editorial header", () => {
    renderView();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Impact");
    expect(screen.getByText(/public evidence ledger/i)).toBeInTheDocument();
  });

  it("renders confirmed counts from usePublicStats", () => {
    renderView();
    const assessmentsLabel = screen.getByText("Total Assessments");
    expect(
      within(assessmentsLabel.closest("div") as HTMLElement).getByText("7")
    ).toBeInTheDocument();
    const gardensLabel = screen.getByText("Total Gardens");
    expect(within(gardensLabel.closest("div") as HTMLElement).getByText("5")).toBeInTheDocument();
    const contributorsLabel = screen.getByText("Total Contributors");
    expect(
      within(contributorsLabel.closest("div") as HTMLElement).getByText("12")
    ).toBeInTheDocument();
  });

  it("renders evidence cards with the View source / Source pending labels", () => {
    renderView();
    expect(screen.getByText("Q3 Soil Renewal")).toBeInTheDocument();
    expect(screen.getByText("Composting Pilot")).toBeInTheDocument();
    expect(screen.getByText("View source")).toBeInTheDocument();
    expect(screen.getByText("Source pending")).toBeInTheDocument();
  });

  it("shows loading skeletons while stats are loading", () => {
    mockUsePublicStats.mockReturnValue({ data: undefined, isLoading: true });
    const { container } = renderView();
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThanOrEqual(1);
  });

  it("shows the empty evidence state when no records load", () => {
    mockUsePublicImpactEvidence.mockReturnValue({
      data: { ...mockSliceReady, records: [], status: "empty" },
      isLoading: false,
    });
    renderView();
    expect(screen.getByText("Assessment evidence will appear here.")).toBeInTheDocument();
  });

  it("shows the EAS-failure state when the slice reports `error`", () => {
    mockUsePublicImpactEvidence.mockReturnValue({
      data: { ...mockSliceReady, status: "error", errorCode: "eas_unavailable" },
      isLoading: false,
    });
    renderView();
    expect(screen.getByText("Evidence is temporarily unavailable.")).toBeInTheDocument();
  });

  it("surfaces partialData and sourceLimitReached banners", () => {
    mockUsePublicImpactEvidence.mockReturnValue({
      data: { ...mockSliceReady, partialData: true, sourceLimitReached: true, status: "partial" },
      isLoading: false,
    });
    renderView();
    expect(screen.getByText("Showing partial evidence.")).toBeInTheDocument();
    expect(screen.getByText("Capped slice.")).toBeInTheDocument();
  });
});
