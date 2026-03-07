/**
 * @vitest-environment jsdom
 */

import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { IntlProvider } from "react-intl";
import enMessages from "@green-goods/shared/i18n/en";

import { GardenStatsGrid } from "../../../components/Garden/GardenStatsGrid";

describe("components/Garden/GardenStatsGrid", () => {
  it("shows the real community name alongside the weight scheme", () => {
    render(
      <IntlProvider locale="en" messages={enMessages}>
        <GardenStatsGrid
          gardenerCount={3}
          operatorCount={2}
          workCount={4}
          assessmentCount={1}
          hasVaults={false}
          vaultNetDeposited={0n}
          vaultHarvestCount={0}
          vaultDepositorCount={0}
          communityLoading={false}
          communityName="River Keepers Council"
          communityLabel="Linear"
        />
      </IntlProvider>
    );

    expect(screen.getByText("River Keepers Council")).toBeInTheDocument();
    expect(screen.getByText("Linear (1-2-3)")).toBeInTheDocument();
  });
});
