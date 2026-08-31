import { cleanup, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { IntlProvider } from "react-intl";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockUseGardens = vi.fn();

vi.mock("@green-goods/shared/config/default-chain", () => ({
  DEFAULT_CHAIN_ID: 42161,
}));

vi.mock("@green-goods/shared/utils/garden-detail", () => ({
  DOMAIN_LABEL_IDS: { 1: "app.domain.tab.agro" },
}));

vi.mock("@green-goods/shared/utils/time", () => ({
  formatDateRange: (start: number, end: number, fallback: string) =>
    start || end ? "Nov 14, 2023 – Mar 9, 2024" : fallback,
}));

vi.mock("@green-goods/shared/modules/data/ipfs/resolve", () => ({
  resolveIPFSUrl: (cid: string) => `https://gateway.test/ipfs/${cid}`,
}));

vi.mock("@green-goods/shared/hooks/blockchain/useBaseLists", () => ({
  useGardens: (...args: unknown[]) => mockUseGardens(...args),
}));

vi.mock("@/components/Communication", () => ({
  Badge: ({ children }: { children: React.ReactNode }) =>
    createElement("span", { "data-testid": "badge" }, children),
}));

vi.mock("@/components/Features/Work", () => ({
  WorkViewSkeleton: () => createElement("div", { "data-testid": "skeleton" }),
}));

vi.mock("@/components/Navigation", () => ({
  TopNav: () => createElement("nav", { "data-testid": "topnav" }),
}));

import { GardenAssessment } from "../../views/Home/Garden/Assessment";

const ASSESSMENT_ID = "assessment-1";
const GARDEN_ID = "0x0000000000000000000000000000000000000001";

const baseAssessment = {
  id: ASSESSMENT_ID,
  schemaVersion: "assessment_v2" as const,
  authorAddress: "0x0000000000000000000000000000000000000002" as const,
  gardenAddress: GARDEN_ID,
  title: "Q1 Soil Health Assessment",
  description: "Assessment of soil regeneration outcomes",
  diagnosis: "Compacted soil and low organic matter are limiting water retention.",
  smartOutcomes: [
    {
      description: "Restore healthy soil across the north field",
      metric: "hectares",
      target: 20,
    },
    {
      description: "Increase soil organic matter",
      metric: "percent",
      target: 12,
    },
  ],
  cynefinPhase: 2 as const,
  domain: 1 as const,
  selectedActionUIDs: ["action-1", "action-2"],
  reportingPeriod: { start: 1_700_000_000, end: 1_710_000_000 },
  sdgTargets: [2, 13],
  attachments: [
    { name: "Field photo.jpg", cid: "bafy-photo", mimeType: "image/jpeg" },
    { name: "Soil report.pdf", cid: "bafy-report", mimeType: "application/pdf" },
  ],
  location: "Field A",
  createdAt: 1_700_000_000,
};

const baseGarden = {
  id: GARDEN_ID,
  name: "Muizenberg Community Garden",
  assessments: [baseAssessment],
};

const messages = {
  "app.domain.tab.agro": "Agroforestry",
  "app.garden.assessments.attachments": "Supporting files",
  "app.garden.assessments.cynefin.complex": "Complex",
  "app.garden.assessments.cynefinPhase": "Complexity",
  "app.garden.assessments.dateNotSet": "Date not set",
  "app.garden.assessments.dateRange": "Reporting period",
  "app.garden.assessments.diagnosis": "Diagnosis",
  "app.garden.assessments.locationNotProvided": "Location not provided",
  "app.garden.assessments.noAttachments": "No supporting files attached.",
  "app.garden.assessments.noSdgTargets": "No SDG alignment recorded.",
  "app.garden.assessments.noSmartOutcomes": "No outcome targets recorded.",
  "app.garden.assessments.notFound": "Assessment not found.",
  "app.garden.assessments.outcomeTarget": "Target: {target} {metric}",
  "app.garden.assessments.sdgAlignment": "SDG alignment",
  "app.garden.assessments.sdgItem": "SDG {number}: {label}",
  "app.garden.assessments.smartOutcomes": "SMART outcomes",
  "app.hypercerts.sdg.2": "Zero Hunger",
  "app.hypercerts.sdg.13": "Climate Action",
};

const renderRoute = () =>
  render(
    createElement(
      MemoryRouter,
      { initialEntries: [`/home/${GARDEN_ID}/assessments/${ASSESSMENT_ID}`] },
      createElement(
        IntlProvider,
        { locale: "en", messages, defaultLocale: "en" },
        createElement(
          Routes,
          null,
          createElement(Route, {
            path: "/home/:id/assessments/:assessmentId",
            element: createElement(GardenAssessment),
          })
        )
      )
    )
  );

describe("GardenAssessment", () => {
  beforeEach(() => {
    mockUseGardens.mockReturnValue({ data: [baseGarden] });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("renders the not-found state when garden is missing", () => {
    mockUseGardens.mockReturnValue({ data: [] });
    renderRoute();
    expect(screen.getByText("Assessment not found.")).toBeInTheDocument();
    expect(screen.getByTestId("skeleton")).toBeInTheDocument();
  });

  it("renders the not-found state when the assessment id doesn't match", () => {
    mockUseGardens.mockReturnValue({
      data: [{ ...baseGarden, assessments: [{ ...baseAssessment, id: "other" }] }],
    });
    renderRoute();
    expect(screen.getByText("Assessment not found.")).toBeInTheDocument();
  });

  it("renders the canonical domain, complexity, and reporting period", () => {
    renderRoute();
    expect(screen.getByText("Muizenberg Community Garden")).toBeInTheDocument();
    expect(screen.getByText("Q1 Soil Health Assessment")).toBeInTheDocument();
    expect(screen.getByText("Assessment of soil regeneration outcomes")).toBeInTheDocument();
    expect(screen.getByText("Agroforestry")).toBeInTheDocument();
    expect(screen.getByText("Complex")).toBeInTheDocument();
    expect(screen.getByText(/Nov 14, 2023 – Mar 9, 2024/)).toBeInTheDocument();
  });

  it("renders the diagnosis and SMART outcome targets", () => {
    renderRoute();
    expect(
      screen.getByText("Compacted soil and low organic matter are limiting water retention.")
    ).toBeInTheDocument();
    expect(screen.getByText("Restore healthy soil across the north field")).toBeInTheDocument();
    expect(screen.getByText("Target: 20 hectares")).toBeInTheDocument();
    expect(screen.getByText("Increase soil organic matter")).toBeInTheDocument();
    expect(screen.getByText("Target: 12 percent")).toBeInTheDocument();
  });

  it("renders localized SDG alignment", () => {
    renderRoute();
    expect(screen.getByText("SDG 2: Zero Hunger")).toBeInTheDocument();
    expect(screen.getByText("SDG 13: Climate Action")).toBeInTheDocument();
  });

  it("renders IPFS attachments by their human-readable names", () => {
    renderRoute();
    expect(screen.getByRole("link", { name: "Field photo.jpg" })).toHaveAttribute(
      "href",
      "https://gateway.test/ipfs/bafy-photo"
    );
    expect(screen.getByRole("link", { name: "Soil report.pdf" })).toHaveAttribute(
      "href",
      "https://gateway.test/ipfs/bafy-report"
    );
  });

  it("renders honest empty states for omitted optional display data", () => {
    mockUseGardens.mockReturnValue({
      data: [
        {
          ...baseGarden,
          assessments: [
            {
              ...baseAssessment,
              reportingPeriod: { start: 0, end: 0 },
              smartOutcomes: [],
              sdgTargets: [],
              attachments: [],
              location: "",
            },
          ],
        },
      ],
    });
    renderRoute();
    expect(screen.getByText(/Date not set/)).toBeInTheDocument();
    expect(screen.getByText(/Location not provided/)).toBeInTheDocument();
    expect(screen.getByText("No outcome targets recorded.")).toBeInTheDocument();
    expect(screen.getByText("No SDG alignment recorded.")).toBeInTheDocument();
    expect(screen.getByText("No supporting files attached.")).toBeInTheDocument();
  });
});
