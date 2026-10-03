import { cleanup, render, screen } from "@testing-library/react";
import { IntlProvider } from "react-intl";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { GardenAssessmentRecord } from "@green-goods/shared/hooks/assessment/useGardenAssessmentRecords";

vi.mock("@green-goods/shared/utils/garden-detail", () => ({
  DOMAIN_LABEL_IDS: { 2: "app.domain.tab.education" },
}));

vi.mock("@/components/Cards", () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/Communication", () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  EmptyState: ({ title }: { title: string }) => <div>{title}</div>,
}));

vi.mock("@/components/Display", () => ({
  Carousel: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CarouselContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CarouselItem: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

import { GardenAssessments } from "../../components/Features/Garden/Assessments";

// What the attestation carries. Create Assessment stores each end of the period
// as UTC midnight of the day the author picked.
const summary = {
  id: "assessment-1",
  authorAddress: "0x0000000000000000000000000000000000000002" as const,
  gardenAddress: "0x0000000000000000000000000000000000000001" as const,
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
const loaded: GardenAssessmentRecord = {
  summary,
  detail: {
    status: "loaded",
    value: {
      diagnosis: "Compacted soil is limiting water retention.",
      smartOutcomes: [
        { description: "Run soil workshops", metric: "sessionsDelivered", target: 6 },
        { description: "Hand out soil test kits", metric: "materialsDistributed", target: 0 },
      ],
      cynefinPhase: 2,
      selectedActionUIDs: ["42161-15"],
      sdgTargets: [2, 13],
      evidenceCids: [],
    },
  },
};

const messages = {
  "app.actions.view": "View",
  "app.admin.assessment.strategyKernel.metric.materialsDistributed": "Materials distributed",
  "app.admin.assessment.strategyKernel.metric.sessionsDelivered": "Sessions delivered",
  "app.admin.assessment.strategyKernel.unit.items": "items",
  "app.admin.assessment.strategyKernel.unit.sessions": "sessions",
  "app.domain.tab.education": "Education",
  "app.garden.assessments.cynefin.complex": "Complex",
  "app.garden.assessments.cynefinPhase": "Complexity",
  "app.garden.assessments.dateRange": "Reporting period",
  "app.garden.assessments.detailUnavailableShort": "More detail could not be loaded.",
  "app.garden.assessments.listTitle": "Assessments",
  "app.garden.assessments.loadError": "Assessments could not be loaded.",
  "app.garden.assessments.noAssesment": "No assessments yet for this garden.",
  "app.garden.assessments.noSdgTargets": "No SDG alignment recorded.",
  "app.garden.assessments.outcomeTarget": "Target: {target} {metric}",
  "app.garden.assessments.sdgAlignment": "SDG alignment",
  "app.garden.assessments.sdgItem": "SDG {number}: {label}",
  "app.garden.assessments.smartOutcomesPreview": "Outcome targets",
  "app.hypercerts.sdg.2": "Zero Hunger",
  "app.hypercerts.sdg.13": "Climate Action",
};

// A reader west of UTC, set on the provider so no case depends on the zone of
// the machine running it.
const renderAssessments = (
  records: GardenAssessmentRecord[],
  assessmentFetchStatus: "pending" | "success" | "error" = "success"
) =>
  render(
    <MemoryRouter>
      <IntlProvider locale="en" messages={messages} defaultLocale="en" timeZone="America/Sao_Paulo">
        <GardenAssessments
          records={records}
          assessmentFetchStatus={assessmentFetchStatus}
          description={null}
        />
      </IntlProvider>
    </MemoryRouter>
  );

describe("GardenAssessments", () => {
  afterEach(cleanup);

  it("shows the reporting period as the days the author picked, for a reader west of UTC", () => {
    renderAssessments([loaded]);

    // Read in the reader's own zone, the card would say Jun 30 – Sep 29.
    expect(screen.getByText(/^Jul 1\s–\sSep 30, 2026$/u)).toBeInTheDocument();
  });

  it("summarizes what the attestation carries and what the stored detail adds", () => {
    renderAssessments([loaded]);

    expect(screen.getByText("Soil workshops, second stage")).toBeInTheDocument();
    expect(screen.getByText("Education")).toBeInTheDocument();
    expect(screen.getByText("Complex")).toBeInTheDocument();
    expect(screen.getByText("SDG 2: Zero Hunger")).toBeInTheDocument();
    expect(screen.getByText("SDG 13: Climate Action")).toBeInTheDocument();
    expect(screen.getByText("Run soil workshops")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View" })).toHaveAttribute(
      "href",
      "/assessments/assessment-1"
    );
  });

  // A stored metric is a key such as sessionsDelivered, and the form leaves a
  // target at zero until it is filled in.
  it("names an outcome's metric in words and shows a target only when one was set", () => {
    renderAssessments([loaded]);

    expect(screen.getByText("Sessions delivered · Target: 6 sessions")).toBeInTheDocument();
    expect(screen.getByText("Materials distributed")).toBeInTheDocument();
    expect(screen.queryByText(/sessionsDelivered|Target: 0/)).not.toBeInTheDocument();
  });

  // A failed read of the stored files is not an assessment with nothing recorded.
  it("says the detail could not be loaded instead of reporting nothing recorded", () => {
    renderAssessments([{ summary, detail: { status: "unavailable" } }]);

    expect(screen.getByText("Soil workshops, second stage")).toBeInTheDocument();
    expect(screen.getByText(/^Jul 1\s–\sSep 30, 2026$/u)).toBeInTheDocument();
    expect(screen.getByText("More detail could not be loaded.")).toBeInTheDocument();
    expect(screen.queryByText("No SDG alignment recorded.")).not.toBeInTheDocument();
    expect(screen.queryByText("Outcome targets")).not.toBeInTheDocument();
  });

  it.each([
    ["no assessment was read", "success", "No assessments yet for this garden."],
    ["the list could not be read", "error", "Assessments could not be loaded."],
  ] as const)("says so when %s", (_label, status, message) => {
    renderAssessments([], status);

    expect(screen.getByText(message)).toBeInTheDocument();
  });
});
