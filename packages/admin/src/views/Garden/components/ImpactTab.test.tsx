/**
 * @vitest-environment jsdom
 */

import enMessages from "@green-goods/shared/i18n/en";
import { render, screen } from "@testing-library/react";
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

  it("shows View All once a list has items", () => {
    renderImpact({
      assessments: [{ id: "a-1", title: "Canopy baseline", createdAt: 1_700_000_000 }],
    });

    expect(screen.getAllByRole("link", { name: "View All" })).toHaveLength(1);
  });
});
