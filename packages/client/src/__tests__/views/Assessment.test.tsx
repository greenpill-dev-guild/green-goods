import { cleanup, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { IntlProvider } from "react-intl";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockUseGardens = vi.fn();
const mockCanManageGarden = vi.fn();

vi.mock("@green-goods/shared", () => ({
  cn: (...classes: unknown[]) => classes.filter(Boolean).join(" "),
  DEFAULT_CHAIN_ID: 42161,
  getEASExplorerUrl: (chainId: number, uid: string) =>
    `https://easscan.example/?chain=${chainId}&uid=${uid}`,
  getTag: (_intl: unknown, tag: string) => tag,
  useGardenPermissions: () => ({ canManageGarden: mockCanManageGarden }),
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

vi.mock("@/styles/pwaStatusStyles", () => ({
  pwaStatusStyles: { primary: { text: "text-primary" } },
}));

import { GardenAssessment } from "../../views/Home/Garden/Assessment";

const ASSESSMENT_ID = "assessment-1";
const GARDEN_ID = "0xgarden";

const baseAssessment = {
  id: ASSESSMENT_ID,
  title: "Q1 Soil Health Assessment",
  description: "Assessment of soil regeneration outcomes",
  assessmentType: "Soil",
  capitals: ["Natural", "Social"],
  tags: ["regeneration", "soil"],
  startDate: 1700000000,
  endDate: 1710000000,
  location: "Field A",
  metrics: { phLevel: 6.8, organicMatter: "12%", drainage: "good" },
  evidenceMedia: ["https://example.com/photo1.jpg", "https://example.com/photo2.jpg"],
  reportDocuments: ["https://example.com/report.pdf"],
  impactAttestations: [
    "0xeac1111111111111111111111111111111111111111111111111111111111111",
    "0xeac2222222222222222222222222222222222222222222222222222222222222",
  ],
};

const baseGarden = {
  id: GARDEN_ID,
  name: "Aiyeloja Family Garden",
  assessments: [baseAssessment],
};

const messages = {
  "app.garden.assessments.title": "Assessment",
  "app.garden.assessments.metrics": "Metrics",
  "app.garden.assessments.noMetrics": "No metrics available.",
  "app.garden.assessments.evidence": "Evidence",
  "app.garden.assessments.noEvidence": "No evidence available.",
  "app.garden.assessments.documents": "Documents",
  "app.garden.assessments.documentItem": "Open document {index}",
  "app.garden.assessments.noDocuments": "No documents available.",
  "app.garden.assessments.evidenceItem": "Open evidence {index}",
  "app.garden.assessments.impactAttestations": "Impact attestations",
  "app.garden.assessments.dateNotSet": "Date not set",
  "app.garden.assessments.locationNotProvided": "Location not provided",
  "app.garden.assessments.notFound": "Assessment not found.",
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
    mockCanManageGarden.mockReturnValue(false);
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

  it("renders title, description, capitals, and garden eyebrow", () => {
    renderRoute();
    expect(screen.getByText("Aiyeloja Family Garden")).toBeInTheDocument();
    expect(screen.getByText("Q1 Soil Health Assessment")).toBeInTheDocument();
    expect(screen.getByText("Assessment of soil regeneration outcomes")).toBeInTheDocument();
    expect(screen.getByText("Natural")).toBeInTheDocument();
    expect(screen.getByText("Social")).toBeInTheDocument();
  });

  it("renders metrics as labeled key/value rows for non-operators", () => {
    renderRoute();
    // Metric labels are humanized (camelCase → spaced + Capitalized)
    expect(screen.getByText("Ph Level")).toBeInTheDocument();
    expect(screen.getByText("6.8")).toBeInTheDocument();
    expect(screen.getByText("Organic Matter")).toBeInTheDocument();
    expect(screen.getByText("12%")).toBeInTheDocument();
    // No raw JSON dump for non-operators
    expect(screen.queryByText(/"phLevel":/)).not.toBeInTheDocument();
  });

  it("renders raw JSON metrics for operators", () => {
    mockCanManageGarden.mockReturnValue(true);
    renderRoute();
    // Operator sees the JSON pre block
    expect(screen.getByText(/"phLevel": 6.8/)).toBeInTheDocument();
    expect(screen.getByText(/"organicMatter": "12%"/)).toBeInTheDocument();
  });

  it("hides the impact attestations section for non-operators", () => {
    renderRoute();
    expect(screen.queryByText("Impact attestations")).not.toBeInTheDocument();
    expect(
      screen.queryByText("0xeac1111111111111111111111111111111111111111111111111111111111111")
    ).not.toBeInTheDocument();
  });

  it("renders the impact attestations section for operators", () => {
    mockCanManageGarden.mockReturnValue(true);
    renderRoute();
    expect(screen.getByText("Impact attestations")).toBeInTheDocument();
    expect(
      screen.getByText("0xeac1111111111111111111111111111111111111111111111111111111111111")
    ).toBeInTheDocument();
  });

  it("renders documents with friendly indexed labels (not raw URLs)", () => {
    renderRoute();
    expect(screen.getByText("Open document 1")).toBeInTheDocument();
    // The raw URL text is not displayed
    expect(screen.queryByText("https://example.com/report.pdf")).not.toBeInTheDocument();
  });

  it("renders evidence with friendly indexed labels", () => {
    renderRoute();
    expect(screen.getByText("Open evidence 1")).toBeInTheDocument();
    expect(screen.getByText("Open evidence 2")).toBeInTheDocument();
  });

  it("falls back to date-not-set / location-not-provided when missing", () => {
    mockUseGardens.mockReturnValue({
      data: [
        {
          ...baseGarden,
          assessments: [
            {
              ...baseAssessment,
              startDate: null,
              endDate: null,
              location: "",
            },
          ],
        },
      ],
    });
    renderRoute();
    expect(screen.getByText(/Date not set/)).toBeInTheDocument();
    expect(screen.getByText(/Location not provided/)).toBeInTheDocument();
  });
});
