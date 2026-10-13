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
 * @vitest-environment happy-dom
 */

import { fireEvent, render, screen, within } from "@testing-library/react";
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
const mockUsePublicCommitmentImpact = vi.fn();

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

vi.mock("@green-goods/shared/hooks/public/usePublicGardens", async (importOriginal) => {
  return {
    ...(await importOriginal()),
    usePublicGardens: () => mockUsePublicGardens(),
  };
});

vi.mock("@green-goods/shared/commitment-pooling", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@green-goods/shared/commitment-pooling")>()),
  usePublicCommitmentImpact: () => mockUsePublicCommitmentImpact(),
}));

vi.mock("@green-goods/shared/hooks/public/usePublicCommitmentImpact", () => ({
  usePublicCommitmentImpact: () => mockUsePublicCommitmentImpact(),
}));

import ImpactPage from "../../views/Public/Impact";

const messages: Record<string, string> = {
  "public.impact.heroTitle": "See how Garden work becomes evidence",
  "public.impact.heroLede":
    "Green Goods turns documented regenerative work into public evidence through Assessments and, when ready, Impact Certificates.",
  "public.impact.totalAssessments": "Assessments",
  "public.impact.totalGardens": "Gardens",
  "public.impact.totalWork": "Work",
  "public.impact.evidence.empty": "Assessment evidence will appear here.",
  "public.impact.evidence.error": "Evidence is temporarily unavailable.",
  "public.impact.evidence.partialData": "Showing partial evidence.",
  "public.impact.evidence.sourceLimitReached": "Capped slice.",
  "public.impact.evidence.viewSource": "View Source",
  "public.impact.evidence.noSource": "Source pending",
  "public.impact.evidence.thumbnailFallback": "no image",
  "public.impact.proof.notPublicYet": "Not public yet",
  "public.impact.kind.all": "All",
  "public.impact.kind.assessment": "Assessment",
  "public.impact.kind.work": "Submission",
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
    // § 02 commitments band has its own suite (`commitment-editorial.test.tsx`);
    // here it is pinned to a still-loading read so its figures cannot collide
    // with the proof-marker counts this suite asserts on.
    mockUsePublicCommitmentImpact.mockReturnValue({ data: undefined, isLoading: true });
  });

  it("renders the editorial hero", () => {
    renderView();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      /see how garden work becomes evidence/i
    );
  });

  it("renders confirmed proof markers from usePublicStats, and no figure it cannot read", () => {
    renderView();
    const proof = document.querySelector(
      'section[aria-labelledby="public-impact-proof-title"]'
    ) as HTMLElement;
    const markers = Array.from(proof.querySelectorAll("dl > div")).map((marker) => [
      marker.querySelector("dt")?.textContent,
      marker.querySelector("dd")?.textContent,
    ]);
    expect(markers).toEqual([
      ["Approved submissions", "30"],
      ["Assessments", "7"],
      ["Gardens", "5"],
    ]);
    // No certificate count exists to read yet, so the row does not carry one.
    expect(within(proof).queryByText(/Impact Certificates/)).toBeNull();
  });

  it("renders a stats read that settled without data as unavailable, never as zero", () => {
    mockUsePublicStats.mockReturnValue({ data: undefined, isLoading: false });
    renderView();
    const proof = document.querySelector(
      'section[aria-labelledby="public-impact-proof-title"]'
    ) as HTMLElement;
    expect(within(proof).getAllByText("Not available right now")).toHaveLength(3);
    expect(within(proof).queryByText("Not public yet")).toBeNull();
    expect(within(proof).queryByText("0")).toBeNull();
  });

  it("dashes out only the count the stats read could not establish", () => {
    mockUsePublicStats.mockReturnValue({
      data: { ...mockStats, fieldNoteCount: null },
      isLoading: false,
    });
    renderView();
    const proof = document.querySelector(
      'section[aria-labelledby="public-impact-proof-title"]'
    ) as HTMLElement;
    expect(within(proof).getAllByText("Not available right now")).toHaveLength(1);
    expect(within(proof).getByText("7")).toBeInTheDocument();
    expect(within(proof).queryByText("30")).toBeNull();
  });

  it("renders evidence cards with their titles in an image-forward grid", () => {
    renderView();
    expect(screen.getByText("Q3 Soil Renewal")).toBeInTheDocument();
    expect(screen.getByText("Composting Pilot")).toBeInTheDocument();
    // Each card is an accessible button labelled by record.title.
    expect(screen.getByRole("button", { name: "Q3 Soil Renewal" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Composting Pilot" })).toBeInTheDocument();
  });

  it("titles a work record without the timestamps its stored title carries, and no other kind", () => {
    const stamps = " - 2026-04-23T18:44:24.803Z - 2026-04-23T18:44:25.160Z";
    const base = { gardenId: "0x1", gardenName: "Solar Garden", sourceAvailable: true };
    const work = { ...base, id: "work:0x9", kind: "work" as const, createdAt: 1720000000 };
    const certificate = { ...base, id: "certificate:0x7", kind: "certificate" as const };
    mockUsePublicImpactEvidence.mockReturnValue({
      data: {
        ...mockSliceReady,
        records: [
          { ...work, title: `Cleanup Event${stamps}`, easUid: "0x9" },
          { ...certificate, title: `Harvest Record${stamps}`, createdAt: 1715000000 },
          ...mockSliceReady.records,
        ],
      },
      isLoading: false,
    });
    renderView();

    const card = screen.getByRole("button", { name: "Cleanup Event" });
    expect(within(card).getByRole("heading", { level: 3 })).toHaveTextContent(/^Cleanup Event$/);
    // A certificate keeps the title it was minted with, whatever it ends in.
    expect(screen.getByRole("button", { name: `Harvest Record${stamps}` })).toBeInTheDocument();

    fireEvent.click(card);
    expect(screen.getByRole("dialog", { name: "Cleanup Event" })).toBeInTheDocument();
  });

  it("returns focus to the evidence card when its record closes", () => {
    renderView();
    const card = screen.getByRole("button", { name: "Composting Pilot" });
    // A bare click moves no focus, as a click or tap on a button moves none in Safari.
    fireEvent.click(card);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(card).toHaveFocus();
  });

  // Prev and Next sit under the last card; staying there after a page turn left the
  // visitor looking at the bottom of a list they had not seen (QA review, 2026-10-12).
  it("brings the visitor to the ledger's top, with focus on its heading, when the page turns", () => {
    const records = Array.from({ length: 13 }, (_, index) => ({
      id: `work:${index}`,
      kind: "work" as const,
      gardenId: "0x1",
      gardenName: "Solar Garden",
      title: `Record ${index + 1}`,
      domain: 0,
      sourceAvailable: true,
      createdAt: 1710000000 - index,
    }));
    mockUsePublicImpactEvidence.mockReturnValue({
      data: { ...mockSliceReady, records, totalFetchedRecords: records.length },
      isLoading: false,
    });
    const scrollIntoView = vi.fn();
    const original = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollIntoView");
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: scrollIntoView,
    });
    try {
      renderView();
      const heading = screen.getByRole("heading", {
        level: 2,
        name: "Recent evidence across Gardens.",
      });

      fireEvent.click(screen.getByRole("button", { name: /Next/ }));

      expect(screen.getByText("Record 13")).toBeInTheDocument();
      expect(scrollIntoView).toHaveBeenCalledOnce();
      expect(scrollIntoView.mock.contexts[0]).toBe(heading.closest("header"));
      expect(scrollIntoView).toHaveBeenCalledWith(expect.objectContaining({ block: "start" }));
      expect(heading).toHaveFocus();
    } finally {
      if (original) Object.defineProperty(HTMLElement.prototype, "scrollIntoView", original);
      else delete (HTMLElement.prototype as { scrollIntoView?: unknown }).scrollIntoView;
    }
  });

  it("shows loading skeletons while evidence is loading", () => {
    mockUsePublicImpactEvidence.mockReturnValue({ data: undefined, isLoading: true });
    const { container } = renderView();
    expect(container.querySelectorAll("[data-editorial-skeleton]").length).toBeGreaterThanOrEqual(
      3
    );
    expect(container.querySelector(".animate-pulse")).toBeNull();
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
