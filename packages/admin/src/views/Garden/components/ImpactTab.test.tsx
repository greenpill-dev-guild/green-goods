/**
 * @vitest-environment happy-dom
 */

import enMessages from "@green-goods/shared/i18n/en";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { IntlProvider } from "react-intl";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { ImpactTab, type ImpactTabProps } from "./ImpactTab";

const GARDEN_ID = "0x0a1b2c3d4e5f60718293a4b5c6d7e8f901234567";

function renderImpact(overrides: Partial<ImpactTabProps> = {}) {
  render(
    <IntlProvider locale="en" messages={enMessages}>
      <MemoryRouter>
        <ImpactTab
          garden={{ id: GARDEN_ID, chainId: 42161 }}
          gardenId={GARDEN_ID}
          canManage={false}
          canReview
          canCertify
          section={undefined}
          selectedItem={undefined}
          clearSection={vi.fn()}
          openSection={vi.fn()}
          assessments={[]}
          fetchingAssessments={false}
          assessmentsError={null}
          hypercerts={[]}
          hypercertsLoading={false}
          hypercertsError={null}
          domainLabels={[]}
          approvedInLastThirtyDays={0}
          {...overrides}
        />
      </MemoryRouter>
    </IntlProvider>
  );
}

describe("ImpactTab", () => {
  it("offers no View All for empty lists and points to where each is made", () => {
    renderImpact();

    expect(screen.queryByRole("link", { name: "View All" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Create Hypercert" })).toHaveAttribute(
      "href",
      expect.stringContaining("/hub/certify/create")
    );
    expect(screen.getByRole("link", { name: "Create Assessment" })).toHaveAttribute(
      "href",
      expect.stringContaining("/hub/assess/create")
    );
  });

  it("keeps the Hub links from viewers who cannot create", () => {
    renderImpact({ canReview: false, canCertify: false });

    expect(screen.queryByRole("link", { name: "Create Hypercert" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Create Assessment" })).not.toBeInTheDocument();
  });

  it("opens a recent assessment from its row and marks it current only while it is open", () => {
    const openSection = vi.fn();
    const assessments = [
      { id: "a-1", title: "Canopy baseline", createdAt: 1_700_000_000 },
      { id: "a-2", title: "Soil health check", createdAt: 1_700_000_000 },
    ];
    // An activity-feed link names the item without opening the assessments section.
    renderImpact({ openSection, selectedItem: "a-1", assessments });
    expect(screen.getByRole("button", { name: /Canopy baseline/ })).not.toHaveAttribute(
      "aria-current"
    );
    cleanup();

    renderImpact({ openSection, section: "assessments", selectedItem: "a-1", assessments });
    // The list row and the opened assessments panel both mark the one the steward picked.
    const picked = screen.getAllByText("Canopy baseline");
    expect(picked).toHaveLength(2);
    for (const title of picked) {
      expect(title.closest("[aria-current]")).toHaveAttribute("aria-current", "true");
    }
    const other = screen.getByRole("button", { name: /Soil health check/ });
    expect(other).not.toHaveAttribute("aria-current");

    fireEvent.click(other);
    expect(openSection).toHaveBeenCalledWith("impact", "assessments", "a-2");
  });

  it("identifies assessment domains in recent rows and the opened list without guessing unknown domains", () => {
    renderImpact({
      section: "assessments",
      assessments: [
        { id: "a-solar", title: "Energy access", domain: 0, createdAt: 1_700_000_000 },
        { id: "a-edu", title: "Garden learning", domain: 2, createdAt: 1_700_000_000 },
        { id: "a-unknown", title: "Imported assessment", domain: 9, createdAt: 1_700_000_000 },
      ],
    });

    expect(screen.getAllByText("Solar")).toHaveLength(2);
    expect(screen.getAllByText("Education")).toHaveLength(2);
    expect(screen.queryByText("Agroforestry")).not.toBeInTheDocument();
    expect(screen.getAllByText("Imported assessment")).toHaveLength(2);
  });

  it("says a failed assessments read failed, rather than reading as an empty list", () => {
    renderImpact({ assessmentsError: new Error("indexer unavailable") });

    expect(screen.getByRole("alert")).toHaveTextContent("Failed to load assessments");
    expect(screen.queryByText("No assessments found")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Create Assessment" })).not.toBeInTheDocument();
    // The summary does not count a list it could not read.
    expect(screen.getByText("Total Assessments").nextElementSibling).toHaveTextContent("—");
  });

  it("says a failed hypercerts read failed, rather than reading as an empty list", () => {
    renderImpact({ hypercertsError: new Error("indexer unavailable") });

    expect(screen.getByRole("alert")).toHaveTextContent("Failed to load hypercerts");
    expect(screen.queryByRole("link", { name: "Create Hypercert" })).not.toBeInTheDocument();
    expect(screen.getByText("Total Hypercerts").nextElementSibling).toHaveTextContent("—");
  });

  it("shows View All once a list has items", () => {
    renderImpact({
      assessments: [{ id: "a-1", title: "Canopy baseline", createdAt: 1_700_000_000 }],
    });

    expect(screen.getAllByRole("link", { name: "View All" })).toHaveLength(1);
  });

  it("dates a recent assessment by when EAS recorded it, in Unix seconds", () => {
    // Noon local time reads as Sep 23 in every time zone.
    const recordedAtSeconds = new Date(2026, 8, 23, 12).getTime() / 1000;
    renderImpact({
      assessments: [{ id: "a-1", title: "Canopy baseline", createdAt: recordedAtSeconds }],
    });

    expect(screen.getByText("Sep 23, 2026")).toBeInTheDocument();
  });
});
