/** @vitest-environment happy-dom */

/**
 * The issuer's acts in the Promises console (PRD-1297 surface 6): a booking
 * under way offers its act on its own row in Offers and Requests, grouped or
 * past due, each act's dialog sends exactly what it reviewed and waits while
 * the console can't act, a return above the issuer's terms or below the
 * escrow's ceiling is refused, a failed return needs recovery, and a short
 * allowance is repaired from the reserve card with enough for what waits.
 */

import { commitmentFixture } from "@green-goods/shared/__tests__/test-utils/commitment-pooling-fixtures";
import { buildCommitmentMetadata } from "@green-goods/shared/modules/commitment-pooling/metadata";
import {
  poolConsoleControllerFixture,
  voucherConsoleViewFixture,
} from "@green-goods/shared/__tests__/test-utils/controller-fixtures";
import type {
  PoolConsoleController,
  VoucherConsoleView,
} from "@green-goods/shared/hooks/admin-ui/pool/controller.types";
import type { CommitmentReadModel } from "@green-goods/shared/modules/commitment-pooling/types-core";
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

const SAFE = {
  safe: ISSUER.safe,
  status: "observed",
  threshold: 1,
  owners: 1,
  signers: [],
} as const;

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
  stage: { kind: "ended-early", returnLimit: 6n * VOUCHER, returnCeiling: 0n },
};

function offers(
  bookings: VoucherBooking[],
  acts: Partial<VoucherConsoleView["acts"]> = {},
  options: { commitments?: CommitmentReadModel[]; titles?: PoolConsoleController["titles"] } = {}
) {
  const viewOf = (read: VoucherBooking[]) => {
    const vouchers = voucherConsoleViewFixture({
      now: NOW,
      snapshot: {
        status: "observed",
        observedAt: NOW,
        bookings: read,
        issuer: ISSUER,
      },
    });
    return { ...vouchers, acts: { ...vouchers.acts, ...acts } };
  };
  const view = viewOf(bookings);
  const commitments =
    options.commitments ??
    bookings.map((booking) =>
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
    titles:
      options.titles ??
      new Map(
        bookings.map((booking) => [
          `bafy-${booking.commitmentId}`,
          { version: 1 as const, title: `Booking ${booking.commitmentId}` },
        ])
      ),
  });
  const render = (console: PoolConsoleController, vouchers: VoucherConsoleView = view) => (
    <PoolCommitmentsCard
      console={console}
      vouchers={vouchers}
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
  const result = renderWithProviders(render(pool));
  return {
    /** The console as read again, and optionally the voucher read with it. */
    rerender: (next: Partial<PoolConsoleController>, read?: VoucherBooking[]) =>
      result.rerender(render({ ...pool, ...next }, read ? viewOf(read) : view)),
  };
}

/** Shared by the short-allowance cases and the open-dialog ones. */
const reserve = (left: bigint): VoucherIssuerReserve => ({
  issuer: ISSUER,
  inReserve: 8n * VOUCHER,
  promised: 3n * VOUCHER,
  allowance: { garden: "Riverside Commons", limit: 4n * VOUCHER, left },
  openBookings: 3,
  terms: { version: 2n, returns: { kind: "usable-hours", of: 4 } },
  cap: { issued: 20n * VOUCHER, ceiling: 20n * VOUCHER },
  waitingReward: { recipient: LINA, units: 2n * VOUCHER, title: "Map the water lines" },
});
const card = (left: bigint, disabled = false) => {
  const onRaiseAllowance = vi.fn().mockResolvedValue(undefined);
  const props = { reserve: reserve(left), safe: SAFE, onRaiseAllowance };
  const view = renderWithProviders(<VoucherReserveCard {...props} disabled={disabled} />);
  return {
    onRaiseAllowance,
    setDisabled: (next: boolean) =>
      view.rerender(<VoucherReserveCard {...props} disabled={next} />),
  };
};

describe("the issuer's acts in the Promises console", () => {
  // An open dialog kept its confirm while its row's act went quiet (Codex on #1320).
  it("holds an open booking dialog's confirm while the console can't act", async () => {
    const reportVisit = vi.fn().mockResolvedValue(undefined);
    const view = offers([visit], { reportVisit });
    fireEvent.click(screen.getAllByRole("button", { name: "Report Visit…" })[0]!);
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("button", { name: "Report Visit" })).toBeEnabled();

    view.rerender({ isOnline: false });
    expect(within(dialog).getByRole("button", { name: "Report Visit" })).toBeDisabled();
    view.rerender({ isOnline: true, isActing: true });
    expect(within(dialog).getByRole("button", { name: "Report Visit" })).toBeDisabled();
  });

  it("holds the open raise's confirm while the console can't act", async () => {
    const { setDisabled } = card(0n);
    fireEvent.click(screen.getByRole("button", { name: "Raise Allowance…" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("button", { name: "Raise Allowance" })).toBeEnabled();
    setDisabled(true);
    expect(within(dialog).getByRole("button", { name: "Raise Allowance" })).toBeDisabled();
  });

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

  // A visit that stopped early used to fall through to the visit's own row, with no act
  // (Codex on #1320); its return counts usable hours, not days.
  it("offers Propose Return on a visit that ended early, counting its usable hours", async () => {
    const proposeReturn = vi.fn().mockResolvedValue(undefined);
    const stopped: VoucherBooking = {
      ...visit,
      service: {
        ...(visit.service as Extract<VoucherBooking["service"], { kind: "visit" }>),
        report: { checkedIn: true, usableHours: 2, ofHours: 4, photos: 1 },
      },
      stage: { kind: "ended-early", returnLimit: VOUCHER / 2n, returnCeiling: 0n },
    };
    offers([stopped], { proposeReturn });

    expect(screen.getByText("Ended early · 2 of 4 hours")).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: "Propose Return…" })[0]!);
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Booking 43 · stopped after 2 of 4 hours")).toBeInTheDocument();
    expect(within(dialog).getByLabelText(/Back to Mara/)).toHaveValue("0.5");
    fireEvent.click(within(dialog).getByRole("button", { name: "Propose Return" }));
    await waitFor(() => expect(proposeReturn).toHaveBeenCalledWith(stopped, 500_000n));
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

  // `authorizeReturn` keeps a ceiling that only rises (Codex on #1320).
  it("refuses a return that doesn't raise the ceiling the escrow already keeps", async () => {
    const proposeReturn = vi.fn().mockResolvedValue(undefined);
    const proposed: VoucherBooking = {
      ...endedEarly,
      stage: { kind: "ended-early", returnLimit: 6n * VOUCHER, returnCeiling: 4n * VOUCHER },
    };
    offers([proposed], { proposeReturn });

    fireEvent.click(screen.getAllByRole("button", { name: "Propose Return…" })[0]!);
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText(/Back to Lina/), { target: { value: "4" } });
    expect(within(dialog).getByText("More than the 4 already proposed")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Propose Return" })).toBeDisabled();
    expect(proposeReturn).not.toHaveBeenCalled();
  });

  it.each([
    "return-failed",
    "transfer-failed",
  ] as const)("counts %s as needing recovery, and retries that transfer", async (kind) => {
    const retryTransfer = vi.fn().mockResolvedValue(undefined);
    const failed: VoucherBooking = {
      ...endedEarly,
      stage: { kind, units: 6n * VOUCHER },
    };
    offers([failed], { retryTransfer });

    expect(screen.getByRole("button", { name: "Needs recovery (1)" })).toBeInTheDocument();
    expect(
      screen.getByText(
        kind === "return-failed" ? "Return didn’t go through" : "Voucher transfer didn’t go through"
      )
    ).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: "Retry Transfer" })[0]!);
    await waitFor(() => expect(retryTransfer).toHaveBeenCalledWith(failed));
  });

  // An open dialog checked the booking as it was when it opened (Codex on #1352).
  it("checks an open return against the ceiling the read has now", async () => {
    const proposeReturn = vi.fn().mockResolvedValue(undefined);
    const view = offers([endedEarly], { proposeReturn });
    fireEvent.click(screen.getAllByRole("button", { name: "Propose Return…" })[0]!);
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText(/Back to Lina/), { target: { value: "4" } });
    expect(within(dialog).getByRole("button", { name: "Propose Return" })).toBeEnabled();

    // Another owner of the issuer's Safe lets 4 come back meanwhile.
    view.rerender({}, [
      {
        ...endedEarly,
        stage: { kind: "ended-early", returnLimit: 6n * VOUCHER, returnCeiling: 4n * VOUCHER },
      },
    ]);
    expect(within(dialog).getByText("More than the 4 already proposed")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Propose Return" })).toBeDisabled();
    expect(proposeReturn).not.toHaveBeenCalled();
  });

  // Past due used to win the row's one slot, and Expire Now repays no one (Codex on #1320).
  it("keeps Retry Transfer on a return that failed past its due date", () => {
    const failed: VoucherBooking = {
      ...endedEarly,
      stage: { kind: "return-failed", units: 6n * VOUCHER },
    };
    const overdue = commitmentFixture({
      id: "42161-51",
      commitmentId: 51n,
      onchainState: "ACCEPTED",
      derivedState: "ACTIVE",
      state: "ACCEPTED",
      counterparty: LINA,
      metadataCID: "bafy-51",
      dueDate: 1n,
    });
    offers([failed], {}, { commitments: [overdue] });

    const row = screen.getByTestId("pool-commitment-51");
    expect(within(row).getAllByRole("button", { name: "Retry Transfer" })).not.toHaveLength(0);
    expect(within(row).queryByRole("button", { name: "Expire Now…" })).not.toBeInTheDocument();
    expect(within(row).getByText("Needs recovery")).toBeInTheDocument();
  });

  // Copies made together fold into one row, which carried no voucher act (Codex on #1320).
  it("gives a grouped copy whose booking needs the steward its own row, act and all", () => {
    const metadata = buildCommitmentMetadata({
      title: "Hub day, up to 4 hours",
      displayGroup: { version: 1, id: "group-hubdays01" },
    });
    const copy = (commitmentId: bigint, taken: boolean) =>
      commitmentFixture({
        id: `42161-${commitmentId}`,
        commitmentId,
        direction: "OFFER",
        onchainState: taken ? "ACCEPTED" : "OFFERED",
        derivedState: taken ? "ACTIVE" : "OFFERED",
        state: taken ? "ACCEPTED" : "OFFERED",
        counterparty: taken ? MARA : null,
        metadataCID: "bafy-hub-days",
      });
    offers(
      [visit],
      {},
      {
        commitments: [copy(43n, true), copy(44n, false), copy(45n, false)],
        titles: new Map([["bafy-hub-days", metadata]]),
      }
    );

    expect(screen.getByTestId("pool-group-group-hubdays01")).toBeInTheDocument();
    const own = screen.getByTestId("pool-commitment-43");
    expect(within(own).getAllByRole("button", { name: "Report Visit…" })).not.toHaveLength(0);
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
        safe={SAFE}
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

  describe("a short allowance", () => {
    // A raise below the waiting reward leaves its retry short again (Codex on #1320).
    it("raises only to enough for the reward that waits", async () => {
      const { onRaiseAllowance } = card(0n);
      fireEvent.click(screen.getByRole("button", { name: "Raise Allowance…" }));
      const dialog = await screen.findByRole("dialog");
      fireEvent.change(within(dialog).getByLabelText(/New allowance/), { target: { value: "1" } });
      expect(
        within(dialog).getByText("At least 2, so the waiting reward can be sent")
      ).toBeInTheDocument();
      expect(within(dialog).getByRole("button", { name: "Raise Allowance" })).toBeDisabled();
      expect(onRaiseAllowance).not.toHaveBeenCalled();
    });

    // One left against a reward of two read "used up" beside a fact row saying 1 left (Codex on #1320).
    it("says how much is left when the allowance is short of the reward, not that it's used up", () => {
      card(VOUCHER);
      expect(
        screen.getByText(
          "The allowance for Riverside Commons has 1 left, less than the reward needs.",
          { exact: false }
        )
      ).toBeInTheDocument();
      expect(screen.queryByText("is used up", { exact: false })).not.toBeInTheDocument();
    });
  });
});
