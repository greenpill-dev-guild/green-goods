/** @vitest-environment happy-dom */

/**
 * Review Promises holds steady for the visit: one quiet line when nothing
 * waits, a decided row stays as its outcome after the index moves on, a failed
 * approval brings the pair back as Try Again, and a new ask joins the end. It is
 * the one queue for every booking act too: a visit to report, a return to
 * propose and a transfer to retry wait there beside the asks, one row a person.
 */

import {
  claimFixture,
  commitmentFixture,
} from "@green-goods/shared/__tests__/test-utils/commitment-pooling-fixtures";
import {
  poolConsoleControllerFixture,
  voucherConsoleViewFixture,
} from "@green-goods/shared/__tests__/test-utils/controller-fixtures";
import type {
  PoolConsoleController,
  VoucherConsoleView,
} from "@green-goods/shared/hooks/admin-ui/pool/controller.types";
import { toastService } from "@green-goods/shared/components/Toast/toast.service";
import { claimRowKey } from "@green-goods/shared/hooks/admin-ui/pool/useWaitingForApproval";
import type {
  IssuerSafeThreshold,
  VoucherAsk,
  VoucherBooking,
} from "@green-goods/shared/modules/commitment-pooling/pool-console";
import type { PoolClaimRequestRow } from "@green-goods/shared/modules/commitment-pooling/types-core";
import type { Address } from "@green-goods/shared/types/domain";
import { describe, expect, it, vi } from "vitest";
import { PoolClaimsCard } from "@/views/Garden/Pool/PoolClaimsCard";
import { fireEvent, renderWithProviders, screen, waitFor, within } from "../test-utils";

// The card proves decisions; names resolve under their own tests.
vi.mock("@green-goods/shared/hooks/blockchain/useEnsName", () => ({
  useEnsName: () => ({ data: null }),
}));
// The voucher members go by their Green Goods names; the neighbors here by their addresses.
vi.mock("@green-goods/shared/hooks/ens/useGreenGoodsEnsName", () => ({
  useGreenGoodsEnsName: (address?: string | null) => ({
    data:
      (
        {
          "0x4444444444444444444444444444444444444444": "Lina",
          "0x5555555555555555555555555555555555555555": "Kwesi",
          "0x6666666666666666666666666666666666666666": "Mara",
        } as Record<string, string>
      )[address?.toLowerCase() ?? ""] ?? null,
  }),
}));
vi.mock("@green-goods/shared/hooks/blockchain/useBaseLists", () => ({
  useGardens: () => ({ data: [] }),
}));

const INES = "0x1111111111111111111111111111111111111111" as Address;
const KWAME = "0x2222222222222222222222222222222222222222" as Address;
const LENA = "0x3333333333333333333333333333333333333333" as Address;

function ask(commitmentId: bigint, claimant: Address, cid: string): PoolClaimRequestRow {
  return {
    claim: claimFixture({ commitmentId, claimant }),
    commitment: commitmentFixture({ commitmentId, direction: "REQUEST", metadataCID: cid }),
  };
}

const ines = ask(3n, INES, "bafy-3");
const kwame = ask(3n, KWAME, "bafy-3");
const lena = ask(7n, LENA, "bafy-7");
const titles = new Map([
  ["bafy-3", { version: 1, title: "Compost workshop" }],
  ["bafy-7", { version: 1, title: "Wheelbarrow loan" }],
]);

const TARGET = { gardenName: "Tech and Sun", isProtocol: false };

function card(
  overrides: Partial<PoolConsoleController> = {},
  vouchers: VoucherConsoleView = voucherConsoleViewFixture(),
  safe?: IssuerSafeThreshold
) {
  const pool = poolConsoleControllerFixture({ claims: [ines, kwame, lena], titles, ...overrides });
  const handlers = { onDecline: vi.fn(), onOpen: vi.fn(), onOpenPromise: vi.fn() };
  const view = renderWithProviders(
    <PoolClaimsCard console={pool} vouchers={vouchers} target={TARGET} safe={safe} {...handlers} />
  );
  return {
    ...handlers,
    pool,
    rerender: (next: Partial<PoolConsoleController>, nextVouchers = vouchers) =>
      view.rerender(
        <PoolClaimsCard
          console={{ ...pool, ...next }}
          vouchers={nextVouchers}
          target={TARGET}
          safe={safe}
          {...handlers}
        />
      ),
  };
}

describe("PoolClaimsCard (Review Promises)", () => {
  it("stays in place with one quiet line when nothing waits, and says whose decision it is once someone asks", () => {
    const view = card({ claims: [] });
    const review = screen.getByTestId("pool-claims");
    expect(within(review).getByRole("heading", { name: "Review Promises" })).toBeVisible();
    expect(within(review).getByText("Nothing to review.")).toBeInTheDocument();
    expect(within(review).queryByRole("list")).not.toBeInTheDocument();

    view.rerender({ claims: [ines] });
    expect(within(review).getByRole("heading", { name: "Review Promises" })).toBeVisible();
    expect(
      within(review).getByText(
        "Neighbors asking to take a promise up. Approving one closes the others on that promise."
      )
    ).toBeInTheDocument();
    expect(within(review).queryByText("Nothing to review.")).not.toBeInTheDocument();
  });

  it("approves from the row in one click, asks a reason to decline, and opens the ask's promise", () => {
    const acceptClaim = vi.fn().mockResolvedValue("0x1");
    const view = card({ acts: { ...poolConsoleControllerFixture().acts, acceptClaim } });
    const first = screen.getAllByRole("listitem")[0]!;
    fireEvent.click(within(first).getByRole("button", { name: /^approve$/i }));
    expect(acceptClaim).toHaveBeenCalledWith(3n, INES);

    fireEvent.click(within(first).getByRole("button", { name: /^decline/i }));
    expect(view.onDecline).toHaveBeenCalledWith(ines);

    fireEvent.click(within(first).getByRole("button", { name: /compost workshop/i }));
    expect(view.onOpen).toHaveBeenCalledWith(ines);
  });

  it("keeps a decided ask as its outcome after the index stops listing it, and closes its sibling", () => {
    const view = card();
    const at = Date.UTC(2026, 8, 28, 22, 42);
    // The approval landed, then the refresh stopped listing both asks on the workshop.
    view.rerender({
      claims: [lena],
      claimDecisions: { [claimRowKey(ines)]: { kind: "approved", commitmentId: "3", at } },
    });

    const [first, second, third] = screen.getAllByRole("listitem");
    expect(first).toHaveAttribute("data-state", "approved");
    expect(within(first!).getByText("Approved")).toBeInTheDocument();
    expect(within(first!).getByText(/will do this/)).toBeInTheDocument();
    // Decided this visit: a clock time, with the full moment behind it.
    expect(first!.querySelector("time")).toHaveAttribute("datetime", new Date(at).toISOString());
    expect(second).toHaveAttribute("data-state", "not-chosen");
    expect(within(second!).getByText("Not chosen")).toBeInTheDocument();
    expect(third).toHaveAttribute("data-state", "waiting");
    expect(
      screen.getByText(
        "1 waiting. 2 decided this visit; they clear when you leave the Promises tab."
      )
    ).toBeInTheDocument();
  });

  it("brings the pair back as Try Again after a failure, and holds every row while one is in flight", () => {
    const view = card({
      claimPhase: (commitmentId) =>
        commitmentId === 7n ? { status: "failed", key: claimRowKey(lena) } : { status: "idle" },
    });
    const failed = screen.getAllByRole("listitem")[2]!;
    expect(within(failed).getByRole("status")).toHaveTextContent(/didn’t go through/i);
    expect(within(failed).getByRole("button", { name: /^try again$/i })).toBeEnabled();

    view.rerender({ claimInFlight: true });
    for (const button of screen.getAllByRole("button", {
      name: /^(approve|try again|decline…)$/i,
    })) {
      expect(button).toBeDisabled();
    }
  });

  it("appends an ask the refresh brings to the end, marked New", () => {
    const view = card({ claims: [ines, kwame] });
    view.rerender({ claims: [lena, ines, kwame] });

    const rows = screen.getAllByRole("listitem");
    expect(rows).toHaveLength(3);
    expect(within(rows[2]!).getByText("New")).toBeInTheDocument();
    expect(within(rows[2]!).getByText(/wheelbarrow loan/i)).toBeInTheDocument();
    expect(within(rows[0]!).queryByText("New")).not.toBeInTheDocument();
  });

  describe("voucher bookings", () => {
    const LINA = "0x4444444444444444444444444444444444444444" as Address;
    const KWESI = "0x5555555555555555555555555555555555555555" as Address;
    const NOW = 1_771_800_000;
    const ISSUER = {
      kind: "collective" as const,
      name: "Tech and Sun",
      chainId: 100,
      safe: "0x5afe00000000000000000000000000000000a1b2" as Address,
      decimals: 6,
    };
    const VIEWER = poolConsoleControllerFixture().viewer!;
    /** The issuer's Safe as read, with who owns it. */
    const safeOwnedBy = (...signers: Address[]): IssuerSafeThreshold => ({
      safe: ISSUER.safe,
      status: "observed",
      threshold: 1,
      owners: signers.length,
      signers,
    });
    const linaRow = {
      claim: claimFixture({ commitmentId: 41n, claimant: LINA }),
      commitment: commitmentFixture({
        commitmentId: 41n,
        direction: "OFFER",
        metadataCID: "bafy-41",
      }),
    };
    const kwesiRow = {
      claim: claimFixture({ commitmentId: 42n, claimant: KWESI }),
      commitment: commitmentFixture({
        commitmentId: 42n,
        direction: "OFFER",
        metadataCID: "bafy-42",
      }),
    };
    const booking = (
      commitmentId: bigint,
      buyer: Address,
      setup: Partial<VoucherAsk["setup"]> = {}
    ) =>
      ({
        commitmentId,
        buyer,
        claimHash: `0x${"c1".repeat(32)}`,
        agreed: { revision: 2n, termsHash: `0x${"7e".repeat(32)}` },
        current: { revision: 2n, termsHash: `0x${"7e".repeat(32)}` },
        agreedAt: NOW - 172_800,
        issuer: ISSUER,
        setup: {
          voucherUnits: 1_000_000n,
          approvedAt: NOW - 86_400,
          depositedUnits: 1_000_000n,
          depositConfirmed: true,
          acceptBy: NOW + 432_000,
          ...setup,
        },
      }) satisfies VoucherAsk;
    const linaAsk = booking(41n, LINA, {
      approvedAt: null,
      depositedUnits: 0n,
      depositConfirmed: false,
    });
    const kwesiAsk = booking(42n, KWESI);
    const vouchersFor = (asks: VoucherAsk[]) =>
      voucherConsoleViewFixture({
        now: NOW,
        snapshot: {
          status: "observed",
          observedAt: NOW,
          asks,
          issuer: ISSUER,
        },
      });
    const bookingTitles = new Map([
      ["bafy-41", { version: 1, title: "Hub day, up to 4 hours" }],
      ["bafy-42", { version: 1, title: "Hub day, up to 4 hours" }],
    ]);

    it("never approves a booking in one tap: the Safe approves it first, then the steward accepts and starts it", async () => {
      const acceptClaim = vi.fn().mockResolvedValue("0x1");
      const acceptAndStartBooking = vi.fn().mockResolvedValue("started");
      const info = vi.spyOn(toastService, "info");
      card(
        {
          claims: [linaRow, kwesiRow],
          titles: bookingTitles,
          acts: { ...poolConsoleControllerFixture().acts, acceptClaim, acceptAndStartBooking },
        },
        vouchersFor([
          linaAsk,
          { ...kwesiAsk, setup: { ...kwesiAsk.setup!, startFee: 41_000_000_000_000n } },
        ]),
        safeOwnedBy(VIEWER)
      );
      const [lina, kwesi] = screen.getAllByRole("listitem");
      expect(within(lina!).getByText("Needs your approval")).toBeInTheDocument();
      expect(within(lina!).getByRole("button", { name: "Approve…" })).toBeEnabled();
      expect(within(kwesi!).getByText("Deposit confirmed")).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /^approve$/i })).not.toBeInTheDocument();

      fireEvent.click(within(kwesi!).getByRole("button", { name: "Accept and Start…" }));
      const dialog = await screen.findByRole("dialog");
      expect(within(dialog).getByText("Accept Kwesi?")).toBeInTheDocument();
      expect(
        within(dialog)
          .getByTestId("voucher-acceptance-checks")
          .querySelectorAll('[data-holds="true"]')
      ).toHaveLength(4);
      // Three approvals, said up front, with the start's network fee before the confirm (DL-193).
      expect(
        within(dialog).getByText("Your wallet will ask you to approve three times.")
      ).toBeInTheDocument();
      const sends = within(dialog).getByTestId("voucher-accept-start");
      expect(
        within(sends)
          .getAllByRole("listitem")
          .map((row) => row.dataset.status)
      ).toEqual(["waiting", "waiting", "waiting"]);
      expect(within(sends).getByText(/Network fee: about 0\.000041 ETH/)).toBeInTheDocument();
      fireEvent.click(within(dialog).getByRole("button", { name: "Accept and Start" }));
      await waitFor(() =>
        expect(acceptAndStartBooking).toHaveBeenCalledWith(
          expect.objectContaining({ commitmentId: kwesiAsk.commitmentId }),
          NOW
        )
      );
      expect(acceptClaim).not.toHaveBeenCalled();
      expect(info).not.toHaveBeenCalled();
      info.mockRestore();
    });

    it("says when the start didn't go, and that the booking stays accepted", async () => {
      const acceptAndStartBooking = vi.fn().mockResolvedValue("notSent");
      const info = vi.spyOn(toastService, "info");
      card(
        {
          claims: [kwesiRow],
          titles: bookingTitles,
          acts: { ...poolConsoleControllerFixture().acts, acceptAndStartBooking },
        },
        vouchersFor([kwesiAsk])
      );
      fireEvent.click(screen.getByRole("button", { name: "Accept and Start…" }));
      const dialog = await screen.findByRole("dialog");
      fireEvent.click(within(dialog).getByRole("button", { name: "Accept and Start" }));
      await waitFor(() =>
        expect(info).toHaveBeenCalledWith({
          title: "Accepted. The start wasn’t sent",
          message:
            "The booking stays accepted. The member can start it from the app 15 minutes after you accepted.",
        })
      );
      info.mockRestore();
    });

    // The row read "Deposit confirmed" with Accept… although its dialog refused (Codex on #1320).
    it("reads an ask with no consent to name as missing its agreement, with no Accept", () => {
      const acceptAndStartBooking = vi.fn().mockResolvedValue("started");
      // The deposit landed, but the consent the acceptance must name can't be read.
      const unnamed = { ...kwesiAsk, claimHash: `0x${"00".repeat(32)}` } satisfies VoucherAsk;
      card(
        {
          claims: [kwesiRow],
          titles: bookingTitles,
          acts: { ...poolConsoleControllerFixture().acts, acceptAndStartBooking },
        },
        vouchersFor([unnamed])
      );
      const row = screen.getByRole("listitem");
      expect(within(row).getByText("Agreement missing")).toBeInTheDocument();
      expect(within(row).getByText("No agreement to accept · they book again")).toBeInTheDocument();
      expect(within(row).queryByText("Deposit confirmed")).not.toBeInTheDocument();
      expect(
        within(row).queryByRole("button", { name: "Accept and Start…" })
      ).not.toBeInTheDocument();
      expect(acceptAndStartBooking).not.toHaveBeenCalled();
    });

    // Approving is the issuer Safe's act; the card offered it to any steward (Codex on #1320).
    it("offers Approve only to an owner of the booking issuer's Safe; anyone else sees it wait", () => {
      const other = "0x9999999999999999999999999999999999999999" as Address;
      card(
        { claims: [linaRow], titles: bookingTitles },
        vouchersFor([linaAsk]),
        safeOwnedBy(other)
      );
      const row = screen.getByRole("listitem");
      expect(within(row).getByText("Waiting for Tech and Sun")).toBeInTheDocument();
      expect(within(row).queryByRole("button", { name: "Approve…" })).not.toBeInTheDocument();
    });

    it("waits for the issuer when the booking is another issuer's, whose Safe the console doesn't read", () => {
      const theirs = { ...linaAsk, issuer: { ...ISSUER, name: "Teo", safe: KWESI } };
      card(
        { claims: [linaRow], titles: bookingTitles },
        vouchersFor([theirs]),
        safeOwnedBy(VIEWER)
      );
      const row = screen.getByRole("listitem");
      expect(within(row).getByText("Waiting for Teo")).toBeInTheDocument();
      expect(within(row).queryByRole("button", { name: "Approve…" })).not.toBeInTheDocument();
    });

    // The deposit returns only after an abort, never by itself at the deadline (Codex on #1320).
    it("says a deposit past the deadline comes back once the booking is canceled", () => {
      const late = booking(42n, KWESI, { acceptBy: NOW - 60 });
      card({ claims: [kwesiRow], titles: bookingTitles }, vouchersFor([late]));
      const row = screen.getByRole("listitem");
      expect(within(row).getByText("Deadline passed")).toBeInTheDocument();
      expect(
        within(row).getByText(/the deposit comes back once it’s canceled$/)
      ).toBeInTheDocument();
    });

    // The read drops an accepted ask; the row read "Approved" and lost its booking line (Codex on #1320).
    it("keeps an accepted booking reading Accepted, as a booking, after the refresh drops its ask", () => {
      const view = card({ claims: [kwesiRow], titles: bookingTitles }, vouchersFor([kwesiAsk]));
      view.rerender(
        {
          claims: [],
          claimDecisions: {
            [claimRowKey(kwesiRow)]: {
              kind: "approved",
              commitmentId: "42",
              at: Date.UTC(2026, 9, 25),
            },
          },
        },
        vouchersFor([])
      );
      const row = screen.getByRole("listitem");
      expect(row).toHaveAttribute("data-state", "approved");
      expect(within(row).getByText("Accepted")).toBeInTheDocument();
      expect(within(row).queryByText("Approved")).not.toBeInTheDocument();
      expect(within(row).getByText("Booking · Hub day, up to 4 hours")).toBeInTheDocument();
    });

    it("reads an accepted booking as Accepted, never Approved", () => {
      card(
        {
          claims: [kwesiRow],
          titles: bookingTitles,
          claimDecisions: {
            [claimRowKey(kwesiRow)]: {
              kind: "approved",
              commitmentId: "42",
              at: Date.UTC(2026, 9, 25),
            },
          },
        },
        vouchersFor([kwesiAsk])
      );
      const row = screen.getByRole("listitem");
      expect(within(row).getByText("Accepted")).toBeInTheDocument();
      expect(within(row).queryByText("Approved")).not.toBeInTheDocument();
    });

    describe("booking acts", () => {
      const MARA = "0x6666666666666666666666666666666666666666" as Address;
      const VOUCHER = 1_000_000n;
      const started = (commitmentId: bigint, holder: Address, startsAt = NOW - 86_400) =>
        ({
          commitmentId,
          holder,
          setupId: `0x${"a4".repeat(32)}`,
          issuer: ISSUER,
          voucherUnits: VOUCHER,
          service: {
            kind: "visit",
            startsAt,
            endsAt: startsAt + 4 * 3_600,
            report: { checkedIn: true, usableHours: 4, ofHours: 4, photos: 2 },
          },
          stage: { kind: "in-progress" },
        }) satisfies VoucherBooking;
      const visited = started(43n, MARA);
      const upcoming = started(44n, MARA, NOW + 86_400);
      const endedEarly: VoucherBooking = {
        ...started(51n, LINA),
        voucherUnits: 10n * VOUCHER,
        service: { kind: "access", daysUsed: 12, daysOf: 30 },
        stage: { kind: "ended-early", returnLimit: 6n * VOUCHER, returnCeiling: 0n },
      };
      const failed: VoucherBooking = {
        ...endedEarly,
        commitmentId: 52n,
        holder: KWESI,
        stage: { kind: "return-failed", units: 6n * VOUCHER },
      };
      const promises = [41n, 43n, 44n, 51n, 52n].map((commitmentId) =>
        commitmentFixture({
          commitmentId,
          direction: "OFFER",
          onchainState: "ACCEPTED",
          metadataCID: `bafy-${commitmentId}`,
        })
      );
      const promiseTitles = new Map(
        [41n, 43n, 44n, 51n, 52n].map((id) => [
          `bafy-${id}`,
          { version: 1, title: id === 41n || id > 50n ? "Claude access" : "Hub day" },
        ])
      );
      const bookingsFor = (
        bookings: VoucherBooking[],
        acts: Partial<VoucherConsoleView["acts"]> = {},
        asks: VoucherAsk[] = []
      ) => {
        const view = voucherConsoleViewFixture({
          now: NOW,
          snapshot: { status: "observed", observedAt: NOW, asks, bookings, issuer: ISSUER },
        });
        return { ...view, acts: { ...view.acts, ...acts } };
      };
      const queue = (
        vouchers: VoucherConsoleView,
        overrides: Partial<PoolConsoleController> = {}
      ) =>
        card(
          { claims: [], commitments: promises, titles: promiseTitles, ...overrides },
          vouchers,
          safeOwnedBy(VIEWER)
        );

      it("lists each booking act that waits on the steward: a visit to report once it has begun, a return to propose, a transfer to retry", () => {
        queue(bookingsFor([visited, upcoming, endedEarly, failed]));
        const report = screen.getByTestId("pool-booking-43");
        expect(within(report).getByText("Visit to report")).toBeInTheDocument();
        expect(within(report).getByRole("button", { name: "Report Visit…" })).toBeEnabled();
        expect(screen.queryByTestId("pool-booking-44")).not.toBeInTheDocument();
        expect(
          within(screen.getByTestId("pool-booking-51")).getByRole("button", {
            name: "Propose Return…",
          })
        ).toBeEnabled();
        expect(
          within(screen.getByTestId("pool-booking-52")).getByRole("button", {
            name: "Retry Transfer",
          })
        ).toBeEnabled();
        // A booking is the member's already: there is nothing to decline.
        expect(screen.queryByRole("button", { name: "Decline…" })).not.toBeInTheDocument();
      });

      // DL-195: in a pool with voucher bookings the subline names every kind of row it can hold.
      it("reads DL-195's subline in a pool with voucher bookings, beside ordinary asks too", () => {
        queue(bookingsFor([visited]), { claims: [ines] });
        expect(
          screen.getByText(
            "Everything waiting on you: people asking to take a promise up, bookings to approve, deposits to accept and visits to report."
          )
        ).toBeInTheDocument();
      });

      it("reports a visit through its dialog, and keeps the row as Reported once the read moves on", async () => {
        const reportVisit = vi.fn().mockResolvedValue(undefined);
        const view = queue(bookingsFor([visited], { reportVisit }));
        fireEvent.click(screen.getByRole("button", { name: "Report Visit…" }));
        const dialog = await screen.findByRole("dialog");
        expect(within(dialog).getByText("Mara checked in")).toBeInTheDocument();
        fireEvent.click(within(dialog).getByRole("button", { name: "Report Visit" }));
        await waitFor(() => expect(reportVisit).toHaveBeenCalledWith(visited));

        const row = await screen.findByTestId("pool-booking-43");
        await waitFor(() => expect(within(row).getByText("Reported")).toBeInTheDocument());
        // The pill names a person, so it can truncate and carries its words as a title (Rule 4).
        expect(within(row).getByTitle("Waiting for Mara to confirm")).toBeInTheDocument();
        view.rerender({}, bookingsFor([]));
        expect(within(screen.getByTestId("pool-booking-43")).getByText("Reported")).toBeVisible();
        expect(screen.queryByRole("button", { name: "Report Visit…" })).not.toBeInTheDocument();
      });

      it("lists the asks before the bookings it first reads with them", () => {
        queue(bookingsFor([visited], {}, [linaAsk]), { claims: [linaRow] });
        const rows = screen.getAllByRole("listitem");
        expect(rows.map((row) => row.getAttribute("data-testid"))).toEqual([
          "pool-claim-41",
          "pool-booking-43",
        ]);
      });

      it("draws a booking's row as text until its promise is read, so nothing focuses that can't open", () => {
        queue(bookingsFor([{ ...failed, commitmentId: 99n }]));
        const row = screen.getByTestId("pool-booking-99");
        expect(
          within(row)
            .getAllByRole("button")
            .map((button) => button.textContent)
        ).toEqual(["Retry Transfer"]);
        expect(within(row).getByText("Booking · Promise 99")).toBeInTheDocument();
      });

      it("keeps a booking whose act was settled elsewhere in its place, no longer waiting", () => {
        const view = queue(bookingsFor([failed]));
        view.rerender({}, bookingsFor([{ ...failed, stage: { kind: "in-progress" } }]));
        const row = screen.getByTestId("pool-booking-52");
        expect(within(row).getByText("No longer waiting")).toBeInTheDocument();
        expect(
          within(row).queryByRole("button", { name: "Retry Transfer" })
        ).not.toBeInTheDocument();
      });

      it("appends a booking act that comes due during the visit at the end, marked New", () => {
        const view = queue(bookingsFor([]), { claims: [ines] });
        view.rerender({}, bookingsFor([failed]));
        const rows = screen.getAllByRole("listitem");
        expect(rows).toHaveLength(2);
        expect(rows[1]).toHaveAttribute("data-testid", "pool-booking-52");
        expect(within(rows[1]!).getByText("New")).toBeInTheDocument();
      });

      it("carries a person's booking act on the row their ask held: one row a person", () => {
        const linaVisit = { ...started(41n, LINA), setupId: `0x${"d7".repeat(32)}` as const };
        const view = queue(bookingsFor([], {}, [kwesiAsk]), { claims: [linaRow] });
        view.rerender(
          {
            claims: [],
            claimDecisions: {
              [claimRowKey(linaRow)]: { kind: "approved", commitmentId: "41", at: NOW * 1000 },
            },
          },
          bookingsFor([linaVisit])
        );
        const rows = screen.getAllByRole("listitem");
        expect(rows).toHaveLength(1);
        expect(within(rows[0]!).getByRole("button", { name: "Report Visit…" })).toBeEnabled();
        expect(within(rows[0]!).queryByText("Accepted")).not.toBeInTheDocument();
      });

      it("shows the Safe's approval made this visit as Approved, until the deposit lets the steward accept", async () => {
        const approveBooking = vi.fn().mockResolvedValue(undefined);
        const view = queue(bookingsFor([], { approveBooking }, [linaAsk]), {
          claims: [linaRow],
          titles: bookingTitles,
        });
        fireEvent.click(screen.getByRole("button", { name: "Approve…" }));
        const dialog = await screen.findByRole("dialog");
        fireEvent.click(within(dialog).getByRole("button", { name: "Approve Booking" }));
        await waitFor(() => expect(approveBooking).toHaveBeenCalledWith(linaAsk));

        const row = screen.getByRole("listitem");
        await waitFor(() => expect(within(row).getByText("Approved")).toBeInTheDocument());
        expect(within(row).queryByRole("button", { name: "Approve…" })).not.toBeInTheDocument();
        // Until the read catches up, no pill says it still needs the approval just given.
        expect(within(row).queryByText("Needs your approval")).not.toBeInTheDocument();
        // The read catches up: the Safe approved, and the deposit is not in yet.
        const approved = { ...linaAsk, setup: { ...linaAsk.setup!, approvedAt: NOW } };
        view.rerender({}, bookingsFor([], {}, [approved]));
        expect(within(row).getByText("Approved")).toBeInTheDocument();
        expect(within(row).getByText("Waiting for the deposit")).toBeInTheDocument();
        // Her deposit lands: accepting is a new act.
        view.rerender({}, bookingsFor([], {}, [{ ...kwesiAsk, commitmentId: 41n, buyer: LINA }]));
        expect(within(row).getByRole("button", { name: "Accept and Start…" })).toBeEnabled();
      });

      // While the pool is paused, only the acts that write to the pool wait (PR #1740 review).
      it("keeps the escrow's acts while the pool is paused, and holds the ones that write to the pool", () => {
        const paused = { ...poolConsoleControllerFixture().model, isPaused: true };
        queue(bookingsFor([visited, endedEarly, failed], {}, [linaAsk, kwesiAsk]), {
          claims: [linaRow, kwesiRow],
          titles: bookingTitles,
          model: paused,
        });
        expect(screen.getByRole("button", { name: "Approve…" })).toBeEnabled();
        expect(screen.getByRole("button", { name: "Propose Return…" })).toBeEnabled();
        expect(screen.getByRole("button", { name: "Retry Transfer" })).toBeEnabled();
        expect(screen.queryByRole("button", { name: "Accept and Start…" })).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Report Visit…" })).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Decline…" })).not.toBeInTheDocument();
      });

      // A fresh ask by the same person reuses the row's key (PR #1740, Codex).
      it("offers Approve… again when the same person asks afresh after an approval this visit", async () => {
        const approveBooking = vi.fn().mockResolvedValue(undefined);
        const view = queue(bookingsFor([], { approveBooking }, [linaAsk]), {
          claims: [linaRow],
          titles: bookingTitles,
        });
        fireEvent.click(screen.getByRole("button", { name: "Approve…" }));
        const dialog = await screen.findByRole("dialog");
        fireEvent.click(within(dialog).getByRole("button", { name: "Approve Booking" }));
        await waitFor(() => expect(screen.getByText("Approved")).toBeInTheDocument());

        // Lina asks again: a new consent, so a new ask waiting on the Safe.
        const again = { ...linaAsk, claimHash: `0x${"c2".repeat(32)}` as const };
        view.rerender({}, bookingsFor([], { approveBooking }, [again]));
        expect(screen.getByRole("button", { name: "Approve…" })).toBeEnabled();
        expect(screen.queryByText("Approved")).not.toBeInTheDocument();
      });

      it("keeps Approve… on a booking whose Safe needs more signatures than the steward's", async () => {
        const approveBooking = vi.fn().mockResolvedValue(undefined);
        const pool = poolConsoleControllerFixture({ claims: [linaRow], titles: bookingTitles });
        renderWithProviders(
          <PoolClaimsCard
            console={pool}
            vouchers={bookingsFor([], { approveBooking }, [linaAsk])}
            target={TARGET}
            safe={{ ...safeOwnedBy(VIEWER, KWESI), threshold: 2 }}
            onDecline={vi.fn()}
            onOpen={vi.fn()}
            onOpenPromise={vi.fn()}
          />
        );
        fireEvent.click(screen.getByRole("button", { name: "Approve…" }));
        const dialog = await screen.findByRole("dialog");
        fireEvent.click(within(dialog).getByRole("button", { name: "Approve Booking" }));
        await waitFor(() => expect(approveBooking).toHaveBeenCalledWith(linaAsk));
        await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
        expect(screen.queryByText("Approved")).not.toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Approve…" })).toBeEnabled();
      });
    });

    // An open dialog kept its confirm after the row went quiet (Codex on #1320).
    it("holds the open approval's confirm while the console can't act", async () => {
      const view = card(
        { claims: [linaRow], titles: bookingTitles },
        vouchersFor([linaAsk]),
        safeOwnedBy(VIEWER)
      );
      fireEvent.click(screen.getByRole("button", { name: "Approve…" }));
      const dialog = await screen.findByRole("dialog");
      expect(within(dialog).getByRole("button", { name: "Approve Booking" })).toBeEnabled();
      view.rerender({ isOnline: false });
      expect(within(dialog).getByRole("button", { name: "Approve Booking" })).toBeDisabled();
    });

    // The account behind an open approval can change; the dialog follows it (Codex on #1352).
    it("holds an open approval once the account no longer owns the issuer's Safe", async () => {
      const approveBooking = vi.fn().mockResolvedValue(undefined);
      const vouchers = vouchersFor([linaAsk]);
      const view = card(
        { claims: [linaRow], titles: bookingTitles },
        { ...vouchers, acts: { ...vouchers.acts, approveBooking } },
        safeOwnedBy(VIEWER)
      );
      fireEvent.click(screen.getByRole("button", { name: "Approve…" }));
      const dialog = await screen.findByRole("dialog");
      expect(within(dialog).getByRole("button", { name: "Approve Booking" })).toBeEnabled();

      view.rerender({ viewer: "0x9999999999999999999999999999999999999999" as Address });
      expect(within(dialog).getByRole("button", { name: "Approve Booking" })).toBeDisabled();
      expect(approveBooking).not.toHaveBeenCalled();
    });
  });
});
