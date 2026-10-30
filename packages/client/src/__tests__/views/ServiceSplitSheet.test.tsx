/**
 * @vitest-environment happy-dom
 */
// TEST-QUALITY: allow-small-test-file - the split sheet is a dialog that needs the DOM, which ServiceBooking.test.ts (node) doesn't load, and GardenCommitment.test.tsx stubs the service reads a full return would need.
import type { ServiceAccessSnapshot } from "@green-goods/shared/commitment-pooling";
import en from "@green-goods/shared/i18n/en";
import userEvent from "@testing-library/user-event";
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

/** Claude access as a service in general words: 30 sessions for 10 vouchers, its return proposed. */
function genericView(ceiling: bigint) {
  const proposed = bookingStorySnapshot("access", "returnProposed");
  const snapshot: ServiceAccessSnapshot = {
    ...proposed,
    offer: proposed.offer && { ...proposed.offer, unitLabel: "sessions" },
    voucherSetups: proposed.voucherSetups.map((row) => ({
      ...row,
      destination: row.destination && { ...row.destination, issuerReturnCeiling: ceiling },
    })),
  };
  const view = serviceBookingView(
    {
      snapshot,
      coreState: "ACCEPTED",
      issuer: VOUCHER_STORY_ISSUERS.greenGoods,
      approval: VOUCHER_STORY_APPROVALS.greenGoods,
      held: vouchers(0),
    },
    intl
  );
  if (!view) throw new Error("No generic booking view");
  return view;
}

function sheet(view: NonNullable<ReturnType<typeof serviceBookingView>>) {
  return (
    <ServiceSplitSheet
      open
      onOpenChange={() => undefined}
      view={view}
      title="Thirty sessions"
      isPending={false}
      onApprove={() => undefined}
      onReport={null}
    />
  );
}

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
      onOpenChange={() => undefined}
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

  it("never calls a hub day cut short the full hub day", () => {
    const proposed = bookingStorySnapshot("hubDay", "returnProposed");
    // Tech and Sun proposes half the voucher back.
    const view = serviceBookingView(
      {
        snapshot: {
          ...proposed,
          voucherSetups: proposed.voucherSetups.map((row) => ({
            ...row,
            destination: row.destination && {
              ...row.destination,
              issuerReturnCeiling: vouchers(0.5),
            },
          })),
        },
        coreState: "ACCEPTED",
        issuer: VOUCHER_STORY_ISSUERS.techAndSun,
        approval: VOUCHER_STORY_APPROVALS.techAndSunBootstrap,
        held: vouchers(10),
      },
      intl
    );
    if (!view) throw new Error("No hub day view");
    renderWithProviders(sheet(view));
    expect(screen.getByRole("checkbox", { name: "I had part of the hub day" })).toBeTruthy();
    expect(screen.getByText("Part of the hub day")).toBeTruthy();
    expect(screen.queryByText("The full hub day")).toBeNull();
  });

  it("counts a partial delivery against the units the booking authorized", () => {
    // 6 of 10 vouchers come back, so 12 of the 30 authorized sessions were delivered.
    renderWithProviders(sheet(genericView(vouchers(6))));
    expect(screen.getByRole("checkbox", { name: "You received: 12 of 30" })).toBeTruthy();
    expect(screen.queryByText(/12 of 12/)).toBeNull();
  });

  it("asks again when the proposed split changes while the sheet is open", async () => {
    const first = genericView(vouchers(6));
    const { rerender } = renderWithProviders(sheet(first));
    await userEvent.click(screen.getByRole("checkbox"));
    expect(screen.getByRole("button", { name: "Approve Split" })).toBeEnabled();
    // The issuer raises the return: fewer sessions delivered, so the box no longer holds.
    rerender(sheet(genericView(vouchers(7))));
    expect(screen.getByRole("checkbox")).not.toBeChecked();
    expect(screen.getByRole("button", { name: "Approve Split" })).toBeDisabled();
  });
});
