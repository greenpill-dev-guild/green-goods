/**
 * @vitest-environment jsdom
 */

import enMessages from "@green-goods/shared/i18n/en";
import { render, screen } from "@testing-library/react";
import { IntlProvider } from "react-intl";
import { describe, expect, it, vi } from "vitest";
import { CommunityPayoutsTab } from "./CommunityPayoutsTab";
import { storyAllocations, storyGarden } from "./communityStoryFixtures";

// The panel reads its jars from the chain; this suite covers the tab's rail.
vi.mock("@/views/Hub/components/CookieJarPayoutPanel", () => ({
  CookieJarPayoutPanel: (props: { allocationCount: number; allocationCountAtLeast?: boolean }) => (
    <div
      data-testid="payout-panel"
      data-count={props.allocationCount}
      data-at-least={String(Boolean(props.allocationCountAtLeast))}
    />
  ),
}));

function renderPayouts(allocationCount: number, allocationsAtLimit: boolean) {
  const allocations = Array.from({ length: allocationCount }, () => storyAllocations[0]);
  render(
    <IntlProvider locale="en" messages={enMessages}>
      <CommunityPayoutsTab
        garden={storyGarden}
        allocations={allocations}
        allocationsAtLimit={allocationsAtLimit}
        selectedItem={null}
      />
    </IntlProvider>
  );
}

describe("CommunityPayoutsTab", () => {
  it("counts payouts so far as at least the list when the list filled its limit", () => {
    renderPayouts(20, true);

    expect(screen.getByText("Payouts so far").nextElementSibling).toHaveTextContent("20+");
    expect(screen.getByTestId("payout-panel")).toHaveAttribute("data-at-least", "true");
  });

  it("counts payouts so far exactly below the limit", () => {
    renderPayouts(3, false);

    expect(screen.getByText("Payouts so far").nextElementSibling).toHaveTextContent(/^3$/);
    expect(screen.getByTestId("payout-panel")).toHaveAttribute("data-at-least", "false");
  });
});
