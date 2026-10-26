/** @vitest-environment happy-dom */

/**
 * Review Promises holds steady for the visit: one quiet line when nothing
 * waits, a decided row stays as its outcome after the index moves on, a failed
 * approval brings the pair back as Try Again, and a new ask joins the end.
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
import { claimRowKey } from "@green-goods/shared/hooks/admin-ui/pool/useWaitingForApproval";
import type { VoucherAsk } from "@green-goods/shared/modules/commitment-pooling/pool-console";
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
  vouchers: VoucherConsoleView = voucherConsoleViewFixture()
) {
  const pool = poolConsoleControllerFixture({ claims: [ines, kwame, lena], titles, ...overrides });
  const handlers = { onDecline: vi.fn(), onOpen: vi.fn() };
  const view = renderWithProviders(
    <PoolClaimsCard console={pool} vouchers={vouchers} target={TARGET} {...handlers} />
  );
  return {
    ...handlers,
    pool,
    rerender: (next: Partial<PoolConsoleController>) =>
      view.rerender(
        <PoolClaimsCard
          console={{ ...pool, ...next }}
          vouchers={vouchers}
          target={TARGET}
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
        issuer: { name: "Tech and Sun", chainId: 100, safe: LINA, decimals: 6 },
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
        },
      });
    const bookingTitles = new Map([
      ["bafy-41", { version: 1, title: "Hub day, up to 4 hours" }],
      ["bafy-42", { version: 1, title: "Hub day, up to 4 hours" }],
    ]);

    it("never approves a booking in one tap: the Safe approves it first, then the steward accepts it through acceptServiceClaim", async () => {
      const acceptClaim = vi.fn().mockResolvedValue("0x1");
      const acceptServiceClaim = vi.fn().mockResolvedValue("0x2");
      card(
        {
          claims: [linaRow, kwesiRow],
          titles: bookingTitles,
          acts: { ...poolConsoleControllerFixture().acts, acceptClaim, acceptServiceClaim },
        },
        vouchersFor([linaAsk, kwesiAsk])
      );
      const [lina, kwesi] = screen.getAllByRole("listitem");
      expect(within(lina!).getByText("Needs your approval")).toBeInTheDocument();
      expect(within(lina!).getByRole("button", { name: "Approve…" })).toBeEnabled();
      expect(within(kwesi!).getByText("Deposit confirmed")).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /^approve$/i })).not.toBeInTheDocument();

      fireEvent.click(within(kwesi!).getByRole("button", { name: "Accept…" }));
      const dialog = await screen.findByRole("dialog");
      expect(within(dialog).getByText("Accept Kwesi?")).toBeInTheDocument();
      expect(
        within(dialog)
          .getByTestId("voucher-acceptance-checks")
          .querySelectorAll('[data-holds="true"]')
      ).toHaveLength(4);
      fireEvent.click(within(dialog).getByRole("button", { name: "Accept Kwesi" }));
      await waitFor(() => expect(acceptServiceClaim).toHaveBeenCalledWith(kwesiAsk, NOW));
      expect(acceptClaim).not.toHaveBeenCalled();
    });

    it("keeps Accept off while a check fails, saying which", async () => {
      const acceptServiceClaim = vi.fn().mockResolvedValue("0x2");
      // The deposit landed, but the consent the acceptance must name can't be read.
      const unnamed = { ...kwesiAsk, claimHash: `0x${"00".repeat(32)}` } satisfies VoucherAsk;
      card(
        {
          claims: [kwesiRow],
          titles: bookingTitles,
          acts: { ...poolConsoleControllerFixture().acts, acceptServiceClaim },
        },
        vouchersFor([unnamed])
      );
      fireEvent.click(screen.getByRole("button", { name: "Accept…" }));
      const dialog = await screen.findByRole("dialog");
      expect(
        within(dialog)
          .getByTestId("voucher-acceptance-checks")
          .querySelector('[data-check="consent"]')
      ).toHaveAttribute("data-holds", "false");
      expect(within(dialog).getByRole("button", { name: "Accept Kwesi" })).toBeDisabled();
      expect(acceptServiceClaim).not.toHaveBeenCalled();
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
  });
});
