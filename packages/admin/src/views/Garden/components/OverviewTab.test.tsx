/**
 * @vitest-environment jsdom
 */

import type { GardenActivityEvent } from "@green-goods/shared/types/garden-detail";
import type { KarmaIntegrationController } from "@green-goods/shared/hooks/garden/useKarmaIntegration";
import pt from "@green-goods/shared/i18n/pt.json";
import { render, screen } from "@testing-library/react";
import { IntlProvider } from "react-intl";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { OverviewTab } from "./OverviewTab";

const karmaIntegration = {
  status: {
    status: "synced",
    chainId: 42161,
    gardenAddress: "0x0000000000000000000000000000000000000001",
    projectUID: null,
    profileUrl: "https://www.karmahq.org/project/test-garden",
    syncVersion: 1,
    requiredSyncVersion: 1,
    reason: null,
  },
  profileUrl: "https://www.karmahq.org/project/test-garden",
  canReconcile: true,
  isLoading: false,
  isFetching: false,
  isReconciling: false,
  isPending: false,
  error: null,
  reconcile: vi.fn(async () => "0x1" as const),
} satisfies KarmaIntegrationController;

const DAY_MS = 24 * 60 * 60 * 1000;

function renderOverview({
  activity = [],
  medianReviewLatencyMs = null,
}: {
  activity?: GardenActivityEvent[];
  medianReviewLatencyMs?: number | null;
}) {
  return render(
    <IntlProvider locale="pt" messages={pt}>
      <MemoryRouter>
        <OverviewTab
          mode="health"
          section={undefined}
          selectedItem={undefined}
          selectedRange="30d"
          clearSection={vi.fn()}
          openSection={vi.fn()}
          updateQueryState={vi.fn()}
          overviewAlerts={[]}
          gardenHealthLabel="Saudável"
          approvedInRangeCount={1}
          impactVelocityDelta={0}
          medianReviewLatencyMs={medianReviewLatencyMs}
          activityFilter="all"
          setActivityFilter={vi.fn()}
          filteredActivityEvents={activity}
          pendingWorkCount={0}
          assessmentCount30d={0}
          gardenerCount={1}
          treasuryBalance="0"
          karmaIntegration={karmaIntegration}
        />
      </MemoryRouter>
    </IntlProvider>
  );
}

describe("OverviewTab", () => {
  it("localizes canonical work titles and relative times in Portuguese", () => {
    const activity: GardenActivityEvent[] = [
      {
        id: "work-harvest",
        category: "work",
        title: "Harvest & Yield Record - 2026-07-08T12:34:00.000Z",
        description: "Aprovado · 8 de jul. de 2026",
        timestamp: Date.now() - 31 * DAY_MS,
        itemId: "work-harvest",
      },
    ];

    renderOverview({ activity });

    expect(screen.getByText(/^Registro de colheita/)).toBeInTheDocument();
    expect(screen.queryByText(/^Harvest & Yield Record/)).not.toBeInTheDocument();
    // Last Activity reads as an age; an activity row older than a week reads as its date.
    expect(screen.getAllByText("há 1 mês")).toHaveLength(1);
    expect(
      screen.getByText(
        new Intl.DateTimeFormat("pt", { dateStyle: "medium" }).format(activity[0].timestamp)
      )
    ).toBeInTheDocument();
    expect(screen.queryByText("1 month ago")).not.toBeInTheDocument();
  });

  it.each([
    [null, "Não disponível"],
    [5 * 60 * 60 * 1000, "Menos de um dia"],
    [3 * DAY_MS, "3 dias"],
    [21 * DAY_MS, "3 semanas"],
  ])("shows a %s ms median review time as %s", (medianReviewLatencyMs, label) => {
    renderOverview({ medianReviewLatencyMs });

    expect(screen.getByText(label)).toBeInTheDocument();
  });
});
