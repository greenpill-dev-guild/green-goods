/** @vitest-environment happy-dom */

/**
 * The issuer's acts in the Promises console (PRD-1297 surface 6): a booking
 * under way offers its act on its own row in Offers and Requests, each act's
 * dialog sends exactly what it reviewed, a return above the issuer's terms is
 * refused, a failed return needs recovery, and a used-up allowance is repaired
 * from the reserve card.
 */

import { commitmentFixture } from "@green-goods/shared/__tests__/test-utils/commitment-pooling-fixtures";
import {
  poolConsoleControllerFixture,
  voucherConsoleViewFixture,
} from "@green-goods/shared/__tests__/test-utils/controller-fixtures";
import type { VoucherConsoleView } from "@green-goods/shared/hooks/admin-ui/pool/controller.types";
import type {
  VoucherBooking,
  VoucherIssuerReserve,
} from "@green-goods/shared/modules/commitment-pooling/pool-console";
import type { Address } from "@green-goods/shared/types/domain";
import { describe, expect, it, vi } from "vitest";
import { PoolCommitmentsCard } from "@/views/Garden/Pool/PoolCommitmentsCard";
import { VoucherReserveCard } from "@/views/Garden/Pool/VoucherReserveCard";
import { fireEvent, renderWithProviders, screen, waitFor, within } from "../test-utils";

const MARA = "0x7c40000000000000000000000000000000005c3d" as Address;
const LINA = "0x52a0000000000000000000000000000000009a1a" as Address;

vi.mock("@green-goods/shared/hooks/ens/useGreenGoodsEnsName", () => ({
  useGreenGoodsEnsName: (address?: string | null) => ({
    data:
      (
        {
          "0x7c40000000000000000000000000000000005c3d": "Mara",
          "0x52a0000000000000000000000000000000009a1a": "Lina",
        } as Record<string, string>
      )[address?.toLowerCase() ?? ""] ?? null,
  }),
}));
vi.mock("@green-goods/shared/hooks/blockchain/useEnsName", () => ({
  useEnsName: () => ({ data: null }),
}));

const NOW = 1_771_800_000;
const VOUCHER = 1_000_000n;
const ISSUER = {
  name: "Green Goods",
  chainId: 100,
  safe: "0x5afe00000000000000000000000000000000c3d4" as Address,
  decimals: 6,
};

const visit: VoucherBooking = {
  commitmentId: 43n,
  holder: MARA,
  setupId: `0x${"a4".repeat(32)}`,
  issuer: ISSUER,
  voucherUnits: VOUCHER,
  service: {
    kind: "visit",
    startsAt: NOW + 4 * 86_400,
    endsAt: NOW + 4 * 86_400 + 4 * 3_600,
    report: { checkedIn: true, usableHours: 4, ofHours: 4, photos: 2 },
  },
  stage: { kind: "in-progress" },
};
const endedEarly: VoucherBooking = {
  commitmentId: 51n,
  holder: LINA,
  setupId: `0x${"b5".repeat(32)}`,
  issuer: ISSUER,
  voucherUnits: 10n * VOUCHER,
  service: { kind: "access", daysUsed: 12, daysOf: 30 },
  stage: { kind: "ended-early", returnLimit: 6n * VOUCHER },
};

function offers(bookings: VoucherBooking[], acts: Partial<VoucherConsoleView["acts"]> = {}) {
  const vouchers = voucherConsoleViewFixture({
    now: NOW,
    snapshot: {
      status: "observed",
      observedAt: NOW,
      bookings,
      issuer: ISSUER,
    },
  });
  const view = { ...vouchers, acts: { ...vouchers.acts, ...acts } };
  const commitments = bookings.map((booking) =>
    commitmentFixture({
      id: `42161-${booking.commitmentId}`,
      commitmentId: booking.commitmentId,
      onchainState: "ACCEPTED",
      derivedState: "ACTIVE",
      state: "ACCEPTED",
      counterparty: booking.holder,
      metadataCID: `bafy-${booking.commitmentId}`,
    })
  );
  const pool = poolConsoleControllerFixture({
    commitments,
    titles: new Map(
      bookings.map((booking) => [
        `bafy-${booking.commitmentId}`,
        { version: 1 as const, title: `Booking ${booking.commitmentId}` },
      ])
    ),
  });
  renderWithProviders(
    <PoolCommitmentsCard
      console={pool}
      vouchers={view}
      target={{ gardenName: "Green Goods Community Garden", isProtocol: false }}
      scope="open"
      onScopeChange={() => undefined}
      focus={null}
      onFocusChange={() => undefined}
      onOpenCommitment={() => undefined}
      onOpenGroup={() => undefined}
      onSeed={() => undefined}
      canSeed
    />
  );
}

describe("the issuer's acts in the Promises console", () => {
  it("offers Report Visit on a visit under way, and reports that booking", async () => {
    const reportVisit = vi.fn().mockResolvedValue(undefined);
    offers([visit], { reportVisit });

    // The act and its narrow-row icon carry one name, as Expire Now… does.
    fireEvent.click(screen.getAllByRole("button", { name: "Report Visit…" })[0]!);
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Mara checked in")).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Report Visit" }));
    await waitFor(() => expect(reportVisit).toHaveBeenCalledWith(visit));
  });

  it("refuses a return above the issuer's terms, and proposes one within them", async () => {
    const proposeReturn = vi.fn().mockResolvedValue(undefined);
    offers([endedEarly], { proposeReturn });

    fireEvent.click(screen.getAllByRole("button", { name: "Propose Return…" })[0]!);
    const dialog = await screen.findByRole("dialog");
    const field = within(dialog).getByLabelText(/Back to Lina/);
    expect(field).toHaveValue("6");
    fireEvent.change(field, { target: { value: "7" } });
    expect(
      within(dialog).getByText("Above the 6 your terms allow after 12 days")
    ).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Propose Return" })).toBeDisabled();

    fireEvent.change(field, { target: { value: "5.5" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Propose Return" }));
    await waitFor(() => expect(proposeReturn).toHaveBeenCalledWith(endedEarly, 5_500_000n));
  });

  it("counts a return that didn't go through as needing recovery, and retries that transfer", async () => {
    const retryTransfer = vi.fn().mockResolvedValue(undefined);
    const failed: VoucherBooking = {
      ...endedEarly,
      stage: { kind: "return-failed", units: 6n * VOUCHER },
    };
    offers([failed], { retryTransfer });

    expect(screen.getByRole("button", { name: "Needs recovery (1)" })).toBeInTheDocument();
    expect(screen.getByText("Return didn’t go through")).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: "Retry Transfer" })[0]!);
    await waitFor(() => expect(retryTransfer).toHaveBeenCalledWith(failed));
  });

  it("shows a reward waiting on a used-up allowance, and raises the allowance to what the steward enters", async () => {
    const onRaiseAllowance = vi.fn().mockResolvedValue(undefined);
    const reserve: VoucherIssuerReserve = {
      issuer: ISSUER,
      inReserve: 8n * VOUCHER,
      promised: 3n * VOUCHER,
      allowance: { garden: "Riverside Commons", limit: 4n * VOUCHER, left: 0n },
      openBookings: 3,
      terms: { version: 2n, returns: { kind: "usable-hours", of: 4 } },
      cap: { issued: 20n * VOUCHER, ceiling: 20n * VOUCHER },
      waitingReward: { recipient: LINA, units: 2n * VOUCHER, title: "Map the water lines" },
    };
    renderWithProviders(
      <VoucherReserveCard
        reserve={reserve}
        safe={{ safe: ISSUER.safe, status: "observed", threshold: 1, owners: 1 }}
        disabled={false}
        onRaiseAllowance={onRaiseAllowance}
      />
    );

    expect(screen.getByText("Lina’s reward of 2 vouchers is waiting.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Raise Allowance…" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Your Safe needs 1 signature.")).toBeInTheDocument();
    fireEvent.change(within(dialog).getByLabelText(/New allowance/), { target: { value: "3" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Raise Allowance" }));
    await waitFor(() => expect(onRaiseAllowance).toHaveBeenCalledWith(reserve, 3n * VOUCHER));
  });
});
