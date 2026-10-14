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
import { poolConsoleControllerFixture } from "@green-goods/shared/__tests__/test-utils/controller-fixtures";
import type { PoolConsoleController } from "@green-goods/shared/hooks/admin-ui/pool/controller.types";
import { claimRowKey } from "@green-goods/shared/hooks/admin-ui/pool/useWaitingForApproval";
import type { PoolClaimRequestRow } from "@green-goods/shared/modules/commitment-pooling/types-core";
import type { Address } from "@green-goods/shared/types/domain";
import { describe, expect, it, vi } from "vitest";
import { PoolClaimsCard } from "@/views/Garden/Pool/PoolClaimsCard";
import { fireEvent, renderWithProviders, screen, within } from "../test-utils";

// The card proves decisions; names resolve under their own tests.
vi.mock("@green-goods/shared/hooks/blockchain/useEnsName", () => ({
  useEnsName: () => ({ data: null }),
}));
vi.mock("@green-goods/shared/hooks/ens/useGreenGoodsEnsName", () => ({
  useGreenGoodsEnsName: () => ({ data: null }),
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

function card(overrides: Partial<PoolConsoleController> = {}) {
  const pool = poolConsoleControllerFixture({ claims: [ines, kwame, lena], titles, ...overrides });
  const handlers = { onDecline: vi.fn(), onOpen: vi.fn() };
  const view = renderWithProviders(<PoolClaimsCard console={pool} {...handlers} />);
  return {
    ...handlers,
    pool,
    rerender: (next: Partial<PoolConsoleController>) =>
      view.rerender(<PoolClaimsCard console={{ ...pool, ...next }} {...handlers} />),
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
        "Neighbours asking to take a promise up. Approving one closes the others on that promise."
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
});
