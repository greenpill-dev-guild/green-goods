/**
 * @vitest-environment happy-dom
 */
import en from "@green-goods/shared/i18n/en";
import { createIntl } from "react-intl";
import { describe, expect, it } from "vitest";
import {
  bookingStoryCoreState,
  bookingStorySnapshot,
} from "../../../../shared/.storybook/voucherBookingFixtures";
import {
  VOUCHER_STORY_APPROVALS,
  VOUCHER_STORY_ISSUERS,
  vouchers,
} from "../../../../shared/.storybook/voucherPilotFixtures";
import { serviceBookingView } from "../../views/Home/Garden/Commitment/serviceBooking";
import { ServiceSplitSheet } from "../../views/Home/Garden/Commitment/ServiceSplitSheet";
import { renderWithProviders, screen } from "../test-utils";

const intl = createIntl({ locale: "en", messages: en as Record<string, string> });

function openSheet(stage: "readyToClose" | "returnProposed") {
  const view = serviceBookingView(
    {
      snapshot: bookingStorySnapshot("hubDay", stage),
      coreState: bookingStoryCoreState("hubDay", stage),
      issuer: VOUCHER_STORY_ISSUERS.techAndSun,
      approval: VOUCHER_STORY_APPROVALS.techAndSunBootstrap,
      held: vouchers(10),
    },
    intl
  );
  if (!view) throw new Error(`No hub day view at ${stage}`);
  return renderWithProviders(
    <ServiceSplitSheet
      open
      view={view}
      title="Hub day, up to 4 hours"
      isPending={false}
      onApprove={() => undefined}
      onReport={null}
    />
  );
}

describe("Approve the Final Split", () => {
  it("asks the reader to confirm the hub day only when the split says it happened", () => {
    const delivered = openSheet("readyToClose");
    expect(screen.getByRole("checkbox", { name: "I had the hub day" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Approve Split" })).toBeDisabled();
    delivered.unmount();

    // Tech and Sun proposes the whole voucher back: the hub day didn't happen.
    openSheet("returnProposed");
    expect(screen.queryByRole("checkbox")).toBeNull();
    expect(screen.queryByText("The full hub day")).toBeNull();
    expect(screen.queryByText("For the hub day")).toBeNull();
    expect(screen.getByRole("button", { name: "Approve Split" })).toBeEnabled();
  });
});
