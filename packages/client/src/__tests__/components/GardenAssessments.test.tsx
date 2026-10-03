import { cleanup, render, screen } from "@testing-library/react";
import { IntlProvider } from "react-intl";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@green-goods/shared/utils/garden-detail", () => ({
  DOMAIN_LABEL_IDS: { 1: "app.domain.tab.agro" },
}));

vi.mock("@green-goods/shared/modules/data/ipfs/resolve", () => ({
  resolveIPFSUrl: (cid: string) => `https://gateway.test/ipfs/${cid}`,
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

const assessment = {
  id: "assessment-1",
  schemaVersion: "assessment_v2" as const,
  authorAddress: "0x0000000000000000000000000000000000000002" as const,
  gardenAddress: "0x0000000000000000000000000000000000000001" as const,
  title: "Q1 Soil Health Assessment",
  description: "Assessment of soil regeneration outcomes",
  diagnosis: "Compacted soil is limiting water retention.",
  smartOutcomes: [
    {
      description: "Restore healthy soil across the north field",
      metric: "hectares",
      target: 20,
    },
  ],
  cynefinPhase: 2 as const,
  domain: 1 as const,
  selectedActionUIDs: ["action-1"],
  // Create Assessment stores each end as UTC midnight of the day the author picked.
  reportingPeriod: { start: Date.UTC(2026, 6, 1) / 1000, end: Date.UTC(2026, 8, 30) / 1000 },
  sdgTargets: [2, 13],
  attachments: [{ name: "Soil report.pdf", cid: "bafy-report", mimeType: "application/pdf" }],
  location: "Field A",
  createdAt: 1_700_000_000,
};

const messages = {
  "app.actions.view": "View",
  "app.actions.viewDocument": "View file",
  "app.domain.tab.agro": "Agroforestry",
  "app.garden.assessments.attachments": "Supporting files",
  "app.garden.assessments.cynefin.complex": "Complex",
  "app.garden.assessments.cynefinPhase": "Complexity",
  "app.garden.assessments.dateRange": "Reporting period",
  "app.garden.assessments.listTitle": "Assessments",
  "app.garden.assessments.outcomeTarget": "Target: {target} {metric}",
  "app.garden.assessments.sdgAlignment": "SDG alignment",
  "app.garden.assessments.sdgItem": "SDG {number}: {label}",
  "app.garden.assessments.smartOutcomesPreview": "Outcome targets",
  "app.hypercerts.sdg.2": "Zero Hunger",
  "app.hypercerts.sdg.13": "Climate Action",
};

// A reader west of UTC, set on the provider so no case depends on the zone of
// the machine running it.
const renderAssessments = () =>
  render(
    <MemoryRouter>
      <IntlProvider locale="en" messages={messages} defaultLocale="en" timeZone="America/Sao_Paulo">
        <GardenAssessments
          assessments={[assessment]}
          assessmentFetchStatus="success"
          description={null}
        />
      </IntlProvider>
    </MemoryRouter>
  );

describe("GardenAssessments", () => {
  afterEach(cleanup);

  it("shows the reporting period as the days the author picked, for a reader west of UTC", () => {
    renderAssessments();

    // Read in the reader's own zone, the card would say Jun 30 – Sep 29.
    expect(screen.getByText(/^Jul 1\s–\sSep 30, 2026$/u)).toBeInTheDocument();
  });

  it("summarizes canonical v2 assessment fields and attachments", () => {
    renderAssessments();

    expect(screen.getByText("Agroforestry")).toBeInTheDocument();
    expect(screen.getByText("Complex")).toBeInTheDocument();
    expect(screen.getByText("SDG 2: Zero Hunger")).toBeInTheDocument();
    expect(screen.getByText("SDG 13: Climate Action")).toBeInTheDocument();
    expect(screen.getByText("Restore healthy soil across the north field")).toBeInTheDocument();
    expect(screen.getByText("Target: 20 hectares")).toBeInTheDocument();
    expect(screen.getByText("Soil report.pdf")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View file" })).toHaveAttribute(
      "href",
      "https://gateway.test/ipfs/bafy-report"
    );
    expect(screen.queryByText("Capitals")).not.toBeInTheDocument();
    expect(screen.queryByText("Metrics preview")).not.toBeInTheDocument();
  });
});
