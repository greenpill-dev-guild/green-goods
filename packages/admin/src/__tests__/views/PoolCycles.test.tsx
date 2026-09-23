/**
 * @vitest-environment jsdom
 */

/**
 * How a season or campaign ends (hub decision 29). End reconciles an Open cycle
 * once nothing in it is live, and until then the card says how many
 * commitments hold it open. Archive composts a Reconciled cycle, and its
 * confirmation says no certificate can be made afterwards. Both confirmations
 * name the cycle in its pool. Which cycle offers which act is
 * `selectCycleEndAct`'s to decide (commitment-pool-console.test.ts).
 */

import type { PoolConsoleController } from "@green-goods/shared/hooks/admin-ui/pool/controller.types";
import {
  cycleFixture,
  poolFixture,
} from "@green-goods/shared/__tests__/test-utils/commitment-pooling-fixtures";
import { poolConsoleControllerFixture } from "@green-goods/shared/__tests__/test-utils/controller-fixtures";
import type { CommitmentCycleRecord } from "@green-goods/shared/modules/commitment-pooling/types-core";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PoolCycleDialogs } from "@/views/Garden/Pool/PoolCycleDialogs";
import { PoolCyclesCard } from "@/views/Garden/Pool/PoolCyclesCard";
import type { CycleDialog } from "@/views/Garden/Pool/poolDialogState";
import { fireEvent, renderWithProviders, screen, waitFor, within } from "../test-utils";

const SEASON = 12n;
const CAMPAIGN = 13n;

function cycles(overrides: {
  season?: Partial<CommitmentCycleRecord>;
  campaign?: Partial<CommitmentCycleRecord>;
}): CommitmentCycleRecord[] {
  return [
    cycleFixture({ id: "42161-12", cycleId: SEASON, state: "OPEN", ...overrides.season }),
    cycleFixture({
      id: "42161-13",
      cycleId: CAMPAIGN,
      cycleType: "CAMPAIGN",
      state: "OPEN",
      ...overrides.campaign,
    }),
  ];
}

function controller(cycleRows: CommitmentCycleRecord[]): PoolConsoleController {
  const base = poolConsoleControllerFixture({
    pool: poolFixture({ poolId: 7n, state: "OPEN" }),
    cycles: cycleRows,
    commitments: [],
  });
  return {
    ...base,
    cycleNames: new Map([
      ["12", { status: "resolved" as const, name: "Season of First Rains" }],
      ["13", { status: "resolved" as const, name: "Market rides" }],
    ]),
    acts: {
      ...base.acts,
      closeCycle: vi.fn().mockResolvedValue("0xclose"),
      compostCycle: vi.fn().mockResolvedValue("0xcompost"),
    },
  };
}

/** The card and its dialogs, wired the way the pool tab wires them. */
function Harness({ pool }: { pool: PoolConsoleController }) {
  const [cycleDialog, setCycleDialog] = useState<CycleDialog>(null);
  const noop = () => undefined;
  return (
    <>
      <PoolCyclesCard
        console={pool}
        onStartSeason={noop}
        onOpenSeason={noop}
        onStartCampaign={noop}
        onOpenCampaign={noop}
        onCancelCycle={noop}
        onEndCycle={(cycle) => setCycleDialog({ kind: "end", cycle })}
        onArchiveCycle={(cycle) => setCycleDialog({ kind: "archive", cycle })}
      />
      <PoolCycleDialogs
        pool={pool}
        target={{ gardenName: "Rocinha", isProtocol: false }}
        tone="garden"
        cycleDialog={cycleDialog}
        setCycleDialog={setCycleDialog}
      />
    </>
  );
}

describe("ending a season or campaign", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("ends a season once nothing in it is live, naming the season in its pool first", async () => {
    const pool = controller(cycles({ season: { liveCommitmentCount: 0n } }));
    renderWithProviders(<Harness pool={pool} />);

    fireEvent.click(screen.getByRole("button", { name: "End Season…" }));
    const dialog = screen.getByRole("dialog", { name: "End This Season" });
    expect(dialog).toHaveTextContent("“Season of First Rains” in Rocinha’s pool");
    expect(pool.acts.closeCycle).not.toHaveBeenCalled();

    fireEvent.click(within(dialog).getByRole("button", { name: "End Season" }));
    await waitFor(() => expect(pool.acts.closeCycle).toHaveBeenCalledWith(SEASON));
    expect(pool.acts.compostCycle).not.toHaveBeenCalled();
  });

  it("says how many commitments still hold a cycle open, and offers no End until they finish", () => {
    const pool = controller(
      cycles({ season: { liveCommitmentCount: 3n }, campaign: { liveCommitmentCount: 1n } })
    );
    renderWithProviders(<Harness pool={pool} />);

    expect(screen.getByText(/^3 commitments are still live\./)).toBeInTheDocument();
    expect(
      within(screen.getByTestId("pool-cycle-13")).getByText(/^1 commitment is still live\./)
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^end/i })).not.toBeInTheDocument();
  });

  it("ends a campaign in its own words", async () => {
    const pool = controller(
      cycles({ season: { liveCommitmentCount: 2n }, campaign: { liveCommitmentCount: 0n } })
    );
    renderWithProviders(<Harness pool={pool} />);

    fireEvent.click(
      within(screen.getByTestId("pool-cycle-13")).getByRole("button", { name: "End Campaign…" })
    );
    const dialog = screen.getByRole("dialog", { name: "End This Campaign" });
    expect(dialog).toHaveTextContent("“Market rides” in Rocinha’s pool");
    fireEvent.click(within(dialog).getByRole("button", { name: "End Campaign" }));
    await waitFor(() => expect(pool.acts.closeCycle).toHaveBeenCalledWith(CAMPAIGN));
  });

  it("archives a reconciled season only after saying no certificate can be made afterwards", async () => {
    const pool = controller([
      cycleFixture({
        id: "42161-12",
        cycleId: SEASON,
        state: "RECONCILED",
        liveCommitmentCount: 0n,
      }),
    ]);
    renderWithProviders(<Harness pool={pool} />);

    fireEvent.click(
      within(screen.getByTestId("pool-cycle-12")).getByRole("button", { name: "Archive…" })
    );
    const dialog = screen.getByRole("alertdialog", { name: "Archive This Season" });
    expect(dialog).toHaveTextContent("“Season of First Rains” in Rocinha’s pool");
    expect(dialog).toHaveTextContent(/no impact certificate can be made for this season/);
    expect(pool.acts.compostCycle).not.toHaveBeenCalled();

    fireEvent.click(within(dialog).getByRole("button", { name: "Archive Season" }));
    await waitFor(() => expect(pool.acts.compostCycle).toHaveBeenCalledWith(SEASON));
    expect(pool.acts.closeCycle).not.toHaveBeenCalled();
  });
});
