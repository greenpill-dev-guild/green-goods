/**
 * @vitest-environment jsdom
 */

import enMessages from "@green-goods/shared/i18n/en";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { IntlProvider } from "react-intl";
import { MemoryRouter, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CommunityPayoutsTab } from "./CommunityPayoutsTab";
import { storyAllocations, storyGarden } from "./communityStoryFixtures";

const access = vi.hoisted(() => ({ isDeployer: false, isProtocolGarden: false }));

vi.mock("@green-goods/shared/hooks/gardener/useRole", () => ({
  useRole: () => ({ isDeployer: access.isDeployer, loading: false }),
}));

vi.mock("@green-goods/shared/hooks/commitment-pooling/useProtocolPool", () => ({
  useIsProtocolGarden: () => ({ isProtocolGarden: access.isProtocolGarden }),
}));

// The panel reads its jars from the chain; this suite covers the tab.
vi.mock("@/views/Hub/components/CookieJarPayoutPanel", () => ({
  CookieJarPayoutPanel: (props: { allocationCount: number; allocationCountAtLeast?: boolean }) => (
    <div
      data-testid="payout-panel"
      data-count={props.allocationCount}
      data-at-least={String(Boolean(props.allocationCountAtLeast))}
    />
  ),
}));

vi.mock("@/views/Cookies/components/CampaignCookieJar", () => ({
  CampaignCookieJarPanel: ({ headerAction }: { headerAction?: ReactNode }) => (
    <div data-testid="campaign-jars">{headerAction}</div>
  ),
  CampaignCookieJarCreateDialog: ({ open }: { open: boolean }) =>
    open ? <div role="dialog" aria-label="Create Cookie Jar" /> : null,
}));

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{`${location.pathname}${location.search}`}</output>;
}

function renderPayouts({
  allocationCount = 1,
  allocationsAtLimit = false,
  selectedItem = null,
}: {
  allocationCount?: number;
  allocationsAtLimit?: boolean;
  selectedItem?: string | null;
} = {}) {
  const allocations = Array.from({ length: allocationCount }, () => storyAllocations[0]);
  render(
    <IntlProvider locale="en" messages={enMessages}>
      <MemoryRouter initialEntries={["/community/payouts"]}>
        <CommunityPayoutsTab
          garden={storyGarden}
          allocations={allocations}
          allocationsAtLimit={allocationsAtLimit}
          selectedItem={selectedItem}
        />
        <LocationProbe />
      </MemoryRouter>
    </IntlProvider>
  );
}

describe("CommunityPayoutsTab", () => {
  beforeEach(() => {
    access.isDeployer = false;
    access.isProtocolGarden = false;
  });

  it("counts payouts so far as at least the list when the list filled its limit", () => {
    renderPayouts({ allocationCount: 20, allocationsAtLimit: true });

    expect(screen.getByText("Payouts so far").nextElementSibling).toHaveTextContent("20+");
    expect(screen.getByTestId("payout-panel")).toHaveAttribute("data-at-least", "true");
  });

  it("counts payouts so far exactly below the limit", () => {
    renderPayouts({ allocationCount: 3 });

    expect(screen.getByText("Payouts so far").nextElementSibling).toHaveTextContent(/^3$/);
    expect(screen.getByTestId("payout-panel")).toHaveAttribute("data-at-least", "false");
  });

  it("holds the campaign cookie jars for a deployer in the protocol garden (DL-046)", async () => {
    const user = userEvent.setup();
    access.isDeployer = true;
    access.isProtocolGarden = true;
    renderPayouts();

    expect(screen.getByRole("region", { name: "Campaign Cookie Jars" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Create Cookie Jar" }));
    expect(screen.getByTestId("location")).toHaveTextContent("item=create-campaign-jar");
  });

  it.each([
    { isDeployer: true, isProtocolGarden: false },
    { isDeployer: false, isProtocolGarden: true },
  ])("shows no campaign cookie jars elsewhere (%o)", (who) => {
    Object.assign(access, who);
    renderPayouts({ selectedItem: "create-campaign-jar" });

    expect(screen.queryByTestId("campaign-jars")).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("opens Create Cookie Jar from its route item", () => {
    access.isDeployer = true;
    access.isProtocolGarden = true;
    renderPayouts({ selectedItem: "create-campaign-jar" });

    expect(screen.getByRole("dialog", { name: "Create Cookie Jar" })).toBeInTheDocument();
  });
});
