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
      id: "assessment:0xabcd",
      kind: "assessment" as const,
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
      id: "assessment:0xdef0",
      kind: "assessment" as const,
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
const mockUsePublicGardens = vi.fn();

vi.mock("@green-goods/shared", async () => {
  const actual = await vi.importActual<typeof import("@green-goods/shared")>("@green-goods/shared");
  return {
    ...actual,
    usePublicStats: () => mockUsePublicStats(),
    usePublicImpactEvidence: () => mockUsePublicImpactEvidence(),
    usePublicGardens: () => mockUsePublicGardens(),
  };
});

import ImpactPage from "../../views/Public/Impact";

const messages: Record<string, string> = {
  "public.impact.heroTitle": "See how Garden work becomes evidence.",
  "public.impact.heroLede":
    "Green Goods turns documented regenerative work into public evidence through Assessments and, when ready, Impact Certificates.",
  "public.impact.totalAssessments": "Assessments",
  "public.impact.totalGardens": "Gardens",
  "public.impact.totalWork": "Work",
  "public.impact.totalCertificates": "Impact Certificates",
  "public.impact.evidence.empty": "Assessment evidence will appear here.",
  "public.impact.evidence.error": "Evidence is temporarily unavailable.",
  "public.impact.evidence.partialData": "Showing partial evidence.",
  "public.impact.evidence.sourceLimitReached": "Capped slice.",
  "public.impact.evidence.viewSource": "View source",
  "public.impact.evidence.noSource": "Source pending",
  "public.impact.evidence.thumbnailFallback": "no image",
  "public.impact.proof.notPublicYet": "Not public yet",
  "public.impact.kind.all": "All",
  "public.impact.kind.assessment": "Assessment",
  "public.impact.kind.work": "Work",
  "public.impact.kind.certificate": "Impact Certificate",
  "public.impact.filters.kind": "Kind",
  "public.impact.filters.domain": "Domain",
  "public.impact.pipeline.kicker": "§ 01 — The cycle",
  "public.impact.pipeline.title": "From plan to public proof, season after season.",
  "public.impact.pipeline.intro":
    "Each Garden moves through three stages of evidence — and starts again.",
  "public.impact.ledger.kicker": "§ 02 — Evidence ledger",
  "public.impact.ledger.title": "Recent evidence across Gardens.",
  "public.actions.domain.all": "All",
  "app.domain.tab.solar": "Solar",
  "app.domain.tab.agro": "Agroforestry",
  "app.domain.tab.education": "Education",
  "app.domain.tab.waste": "Waste",
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
    mockUsePublicGardens.mockReturnValue({ data: [], isLoading: false });
  });

  it("renders the editorial hero", () => {
    renderView();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      /see how garden work becomes evidence/i
    );
  });

  it("renders confirmed proof markers from usePublicStats", () => {
    renderView();
    expect(screen.getAllByText("Assessments").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Gardens").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Work").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("7")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getByText("30")).toBeInTheDocument();
  });

  it("renders evidence cards with their titles in an image-forward grid", () => {
    renderView();
    expect(screen.getByText("Q3 Soil Renewal")).toBeInTheDocument();
    expect(screen.getByText("Composting Pilot")).toBeInTheDocument();
    // Each card is an accessible button labelled by record.title.
    expect(screen.getByRole("button", { name: "Q3 Soil Renewal" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Composting Pilot" })).toBeInTheDocument();
  });

  it("shows loading skeletons while evidence is loading", () => {
    mockUsePublicImpactEvidence.mockReturnValue({ data: undefined, isLoading: true });
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
      data: {
        ...mockSliceReady,
        partialData: true,
        sourceLimitReached: true,
        status: "partial",
        totalFetchedRecords: 100,
      },
      isLoading: false,
    });
    renderView();
    expect(screen.getByText("Showing partial evidence.")).toBeInTheDocument();
    expect(screen.getByText("Capped slice.")).toBeInTheDocument();
  });
});
