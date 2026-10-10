import { cleanup, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { IntlProvider } from "react-intl";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockUseGardens = vi.fn();
const mockUseGardenAssessmentRecords = vi.fn();

vi.mock("@green-goods/shared/config/default-chain", () => ({
  DEFAULT_CHAIN_ID: 42161,
}));

vi.mock("@green-goods/shared/utils/garden-detail", () => ({
  DOMAIN_LABEL_IDS: { 2: "app.domain.tab.education" },
}));

vi.mock("@green-goods/shared/modules/data/ipfs/resolve", () => ({
  resolveIPFSUrl: (cid: string) => `https://gateway.test/ipfs/${cid}`,
}));

vi.mock("@green-goods/shared/hooks/blockchain/useBaseLists", () => ({
  useGardens: (...args: unknown[]) => mockUseGardens(...args),
}));

vi.mock("@green-goods/shared/hooks/assessment/useGardenAssessmentRecords", () => ({
  useGardenAssessmentRecords: (...args: unknown[]) => mockUseGardenAssessmentRecords(...args),
}));

vi.mock("@/components/Communication", () => ({
  Badge: ({ children }: { children: React.ReactNode }) =>
    createElement("span", { "data-testid": "badge" }, children),
}));

vi.mock("@/components/Features/Work", () => ({
  WorkViewSkeleton: () => createElement("div", { "data-testid": "skeleton" }),
}));

vi.mock("@/components/Navigation", () => ({
  TopNav: ({ overlay }: { overlay?: boolean }) =>
    createElement("nav", { "data-testid": "topnav", "data-overlay": String(Boolean(overlay)) }),
}));

import { GardenAssessment } from "../../views/Home/Garden/Assessment";

const ASSESSMENT_ID = "assessment-1";
const GARDEN_ID = "0x00000000000000000000000000000000000000Aa";

// What the attestation carries. Create Assessment stores each end of the period
// as UTC midnight of the day the author picked.
const summary = {
  id: ASSESSMENT_ID,
  authorAddress: "0x0000000000000000000000000000000000000002" as const,
  gardenAddress: GARDEN_ID,
  title: "Soil workshops, second stage",
  description: "Training gardeners to read and restore their soil",
  assessmentConfigCID: "bafy-config",
  domain: 2,
  startDate: Date.UTC(2026, 6, 1) / 1000,
  endDate: Date.UTC(2026, 8, 30) / 1000,
  location: "Field A",
  createdAt: 1_782_000_000,
};

// What the two files on IPFS add.
const detail = {
  diagnosis: "Compacted soil and low organic matter are limiting water retention.",
  smartOutcomes: [
    { description: "Run soil workshops", metric: "sessionsDelivered", target: 6 },
    { description: "Hand out soil test kits", metric: "materialsDistributed", target: 0 },
  ],
  cynefinPhase: 2,
  selectedActionUIDs: ["42161-15"],
  sdgTargets: [2, 13],
  evidenceCids: ["bafy-photo", "bafy-report"],
};

const garden = { id: GARDEN_ID, name: "Muizenberg Community Garden" };

const messages = {
  "app.admin.assessment.strategyKernel.metric.materialsDistributed": "Materials distributed",
  "app.admin.assessment.strategyKernel.metric.sessionsDelivered": "Sessions delivered",
  "app.admin.assessment.strategyKernel.unit.items": "items",
  "app.admin.assessment.strategyKernel.unit.sessions": "sessions",
  "app.domain.tab.education": "Education",
  "app.garden.assessments.cynefin.complex": "Complex",
  "app.garden.assessments.dateNotSet": "Date not set",
  "app.garden.assessments.detailUnavailable": "The rest of this assessment could not be loaded.",
  "app.garden.assessments.diagnosis": "Diagnosis",
  "app.garden.assessments.evidence": "Evidence media",
  "app.garden.assessments.evidenceItem": "Open evidence {index}",
  "app.garden.assessments.loadError": "Assessments could not be loaded.",
  "app.garden.assessments.locationNotProvided": "Location not provided",
  "app.garden.assessments.noEvidence": "No evidence media attached.",
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

type DetailState =
  | { status: "pending" }
  | { status: "unavailable" }
  | { status: "loaded"; value: typeof detail };

function read(detailState: DetailState, status: "pending" | "success" | "error" = "success") {
  mockUseGardenAssessmentRecords.mockReturnValue({
    records: [{ summary, detail: detailState }],
    status,
  });
}

const renderRoute = () =>
  render(
    createElement(
      MemoryRouter,
      // A link may carry the address in lower case.
      { initialEntries: [`/home/${GARDEN_ID.toLowerCase()}/assessments/${ASSESSMENT_ID}`] },
      createElement(
        IntlProvider,
        // A reader west of UTC, set on the provider so no case depends on the
        // zone of the machine running it.
        { locale: "en", messages, defaultLocale: "en", timeZone: "America/Sao_Paulo" },
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
    mockUseGardens.mockReturnValue({ data: [garden], isLoading: false });
    read({ status: "loaded", value: detail });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("reads the assessments of the garden in the link", () => {
    renderRoute();
    expect(mockUseGardenAssessmentRecords).toHaveBeenLastCalledWith(GARDEN_ID, 42161);
  });

  it.each([
    [
      "the garden is not in the list",
      () => mockUseGardens.mockReturnValue({ data: [], isLoading: false }),
      "Assessment not found.",
    ],
    [
      "no assessment has the id in the link",
      () => mockUseGardenAssessmentRecords.mockReturnValue({ records: [], status: "success" }),
      "Assessment not found.",
    ],
    [
      "the garden's assessments could not be read",
      () => mockUseGardenAssessmentRecords.mockReturnValue({ records: [], status: "error" }),
      "Assessments could not be loaded.",
    ],
    [
      // The list is from an earlier read, so an assessment missing from it may
      // have been attested since: that is not a finding that it does not exist.
      "the id is not in a list whose latest read failed",
      () =>
        mockUseGardenAssessmentRecords.mockReturnValue({
          records: [
            { summary: { ...summary, id: "an-earlier-one" }, detail: { status: "pending" } },
          ],
          status: "success",
          refreshFailed: true,
        }),
      "Assessments could not be loaded.",
    ],
  ])("says so when %s", (_label, arrange, message) => {
    arrange();
    renderRoute();
    expect(screen.getByText(message)).toBeInTheDocument();
    expect(screen.getByTestId("skeleton")).toBeInTheDocument();
  });

  // The top bar is 80px tall. Left in the flow with 64px of padding under it,
  // the page began 144px down, where the work page and the promise page begin
  // at 80px. Like theirs, the bar is pinned over the page, which clears it once.
  it.each([
    ["an assessment to show", () => undefined],
    [
      "no assessment to show",
      () => mockUseGardenAssessmentRecords.mockReturnValue({ records: [], status: "success" }),
    ],
  ])("pins the top bar and starts the page 80px down, with %s", (_label, arrange) => {
    arrange();
    renderRoute();

    const bar = screen.getByTestId("topnav");
    expect(bar).toHaveAttribute("data-overlay", "true");
    expect(bar.nextElementSibling).toHaveClass("pt-20");
  });

  it("claims nothing while the assessments are still being read", () => {
    mockUseGardenAssessmentRecords.mockReturnValue({ records: [], status: "pending" });
    renderRoute();
    expect(screen.getByTestId("skeleton")).toBeInTheDocument();
    expect(screen.queryByText("Assessment not found.")).not.toBeInTheDocument();
  });

  it("renders what the attestation carries: garden, title, description and domain", () => {
    renderRoute();
    expect(screen.getByText("Muizenberg Community Garden")).toBeInTheDocument();
    expect(screen.getByText("Soil workshops, second stage")).toBeInTheDocument();
    expect(
      screen.getByText("Training gardeners to read and restore their soil")
    ).toBeInTheDocument();
    expect(screen.getByText("Education")).toBeInTheDocument();
  });

  it("shows the reporting period as the days the author picked, for a reader west of UTC", () => {
    renderRoute();
    // Read in the reader's own zone, the page would say Jun 30 – Sep 29.
    expect(screen.getByText(/Jul 1\s–\sSep 30, 2026 · Field A/u)).toBeInTheDocument();
  });

  it("renders the stored detail: complexity, diagnosis, outcomes, SDGs and evidence", () => {
    renderRoute();
    expect(screen.getByText("Complex")).toBeInTheDocument();
    expect(
      screen.getByText("Compacted soil and low organic matter are limiting water retention.")
    ).toBeInTheDocument();
    expect(screen.getByText("Run soil workshops")).toBeInTheDocument();
    // The metric is named in words, and a target left at zero is not printed.
    expect(screen.getByText("Sessions delivered · Target: 6 sessions")).toBeInTheDocument();
    expect(screen.getByText("Materials distributed")).toBeInTheDocument();
    expect(screen.getByText("SDG 2: Zero Hunger")).toBeInTheDocument();
    expect(screen.getByText("SDG 13: Climate Action")).toBeInTheDocument();
    // The upload keeps no file name, so evidence is named by its place in the list.
    expect(screen.getByRole("link", { name: "Open evidence 1" })).toHaveAttribute(
      "href",
      "https://gateway.test/ipfs/bafy-photo"
    );
    expect(screen.getByRole("link", { name: "Open evidence 2" })).toHaveAttribute(
      "href",
      "https://gateway.test/ipfs/bafy-report"
    );
  });

  // A failed read of the stored files is not an assessment with nothing recorded.
  it("says the rest could not be loaded instead of reporting nothing recorded", () => {
    read({ status: "unavailable" });
    renderRoute();
    expect(screen.getByText("Soil workshops, second stage")).toBeInTheDocument();
    // A warning, so it is announced politely: the real Alert gives it the status role.
    expect(screen.getByRole("status")).toHaveTextContent(
      "The rest of this assessment could not be loaded."
    );
    expect(screen.queryByText("No outcome targets recorded.")).not.toBeInTheDocument();
    expect(screen.queryByText("No evidence media attached.")).not.toBeInTheDocument();
  });

  it("says what was not recorded once the detail has been read", () => {
    mockUseGardenAssessmentRecords.mockReturnValue({
      records: [
        {
          summary: { ...summary, startDate: 0, endDate: 0, location: "" },
          detail: {
            status: "loaded",
            value: {
              ...detail,
              diagnosis: "",
              smartOutcomes: [],
              sdgTargets: [],
              evidenceCids: [],
            },
          },
        },
      ],
      status: "success",
    });
    renderRoute();
    expect(screen.getByText(/Date not set/)).toBeInTheDocument();
    expect(screen.getByText(/Location not provided/)).toBeInTheDocument();
    expect(screen.queryByText("Diagnosis")).not.toBeInTheDocument();
    expect(screen.getByText("No outcome targets recorded.")).toBeInTheDocument();
    expect(screen.getByText("No SDG alignment recorded.")).toBeInTheDocument();
    expect(screen.getByText("No evidence media attached.")).toBeInTheDocument();
  });
});
