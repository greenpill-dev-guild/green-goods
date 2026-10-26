import type { GardenAssessmentRecord } from "@green-goods/shared/hooks/assessment/useGardenAssessmentRecords";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { IntlProvider } from "react-intl";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";

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
  "app.garden.assessments.dateNotSet": "Date not set",
  "app.garden.assessments.listTitle": "Assessments",
  "app.garden.assessments.loadError.description": "Check your connection and try again.",
  "app.garden.assessments.loadError.title": "Assessments could not be loaded",
  "app.garden.assessments.noAssesment": "No assessments yet for this garden.",
  "app.domain.tab.education": "Education",
};

// A reader west of UTC, set on the provider so no case depends on the zone of
// the machine running it. The list draws on the garden's page by default, or on Home under
// the Insights sheet (DL-128), which is not a garden route.
const renderAssessments = (
  records: GardenAssessmentRecord[],
  assessmentFetchStatus: "pending" | "success" | "error" = "success",
  at: "/home/garden-1" | "/home" = "/home/garden-1"
) =>
  render(
    <MemoryRouter initialEntries={[at]}>
      <IntlProvider locale="en" messages={messages} defaultLocale="en" timeZone="America/Sao_Paulo">
        <Routes>
          <Route
            path={at}
            element={
              <GardenAssessments
                gardenId="garden-1"
                records={records}
                assessmentFetchStatus={assessmentFetchStatus}
                description={null}
              />
            }
          />
          <Route path="/home/garden-1/assessments/:id" element={<p>Assessment page</p>} />
        </Routes>
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

  it("lists each assessment as a row that opens its page, with its period and domain", () => {
    renderAssessments([loaded]);

    const row = screen.getByRole("button", { name: /Soil workshops, second stage/ });
    expect(row).toHaveAccessibleName(/Jul 1\s–\sSep 30, 2026.*Education/u);
    fireEvent.click(row);
    expect(screen.getByText("Assessment page")).toBeInTheDocument();
  });

  it("opens the assessment's page from the Insights sheet over Home, by the garden's own path", () => {
    renderAssessments([loaded], "success", "/home");

    fireEvent.click(screen.getByRole("button", { name: /Soil workshops, second stage/ }));
    expect(screen.getByText("Assessment page")).toBeInTheDocument();
  });

  // A domain the app does not know stays unlabelled rather than guessed.
  it("leaves an unknown domain unlabelled, whatever its stored detail", () => {
    renderAssessments([
      { summary: { ...summary, domain: 9 }, detail: { status: "unavailable" } },
      { summary: { ...summary, id: "assessment-2" }, detail: { status: "pending" } },
    ]);

    expect(screen.getAllByText(/^Jul 1\s–\sSep 30, 2026$/u)).toHaveLength(2);
    expect(screen.getAllByText("Education")).toHaveLength(1);
  });

  it.each([
    ["no assessment was read", "success", "No assessments yet for this garden."],
    ["the list could not be read", "error", "Assessments could not be loaded"],
  ] as const)("says so when %s", (_label, status, message) => {
    renderAssessments([], status);

    expect(screen.getByText(message)).toBeInTheDocument();
  });
});
