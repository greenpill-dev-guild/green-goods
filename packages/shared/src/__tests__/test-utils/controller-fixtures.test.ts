import { describe, expect, it } from "vitest";

import type {
  CommitmentDialogController,
  HubConfirmQueueController,
  PoolConsoleController,
} from "../../hooks/admin-ui/pool";
import {
  commitmentDialogControllerFixture,
  commitmentDetailFixture,
  commitmentFixture,
  contributorFixture,
  createSharedBarrelMock,
  cycleFixture,
  gardenCommitmentControllerFixture,
  hubConfirmQueueControllerFixture,
  poolClaimRowFixture,
  poolConsoleControllerFixture,
  poolFixture,
  claimFixture,
  toConfirmFixture,
} from "./index";

describe("pool controller fixtures", () => {
  it("builds controller contracts from real domain fixtures and selectors", () => {
    const pool = poolFixture();
    const commitment = commitmentFixture();
    const cycle = cycleFixture({ poolId: pool.poolId });
    const contributor = contributorFixture({ commitmentId: commitment.commitmentId });
    const claim = claimFixture({ commitmentId: commitment.commitmentId });
    const detail = commitmentDetailFixture({ commitment, contributors: [contributor] });
    const claimRow = poolClaimRowFixture({ commitment, claim });
    const poolConsole: PoolConsoleController = poolConsoleControllerFixture({
      pool,
      cycles: [cycle],
      commitments: [commitment],
      claims: [claimRow],
    });
    const confirmQueue: HubConfirmQueueController = hubConfirmQueueControllerFixture({
      toConfirm: toConfirmFixture(),
    });
    const gardenCommitment = gardenCommitmentControllerFixture({ detail });
    const dialog: CommitmentDialogController = commitmentDialogControllerFixture({ commitment });

    expect(poolConsole.model.status).toBe("open");
    expect(poolConsole.model.groups.open).toEqual([commitment]);
    expect(poolConsole.model.counts.claimsWaiting).toBe(1);
    expect(detail.contributors).toEqual([contributor]);
    expect(confirmQueue.rows.map((row) => row.eligibility)).toEqual([
      "ORDINARY",
      "POOL_FALLBACK",
      "DISPUTED",
    ]);
    expect(dialog.can.cancel).toBe(true);
    expect(gardenCommitment.status).toBe("ready");
    expect(gardenCommitment.detail).toBe(detail);
    expect(dialog.confirmation).toEqual({
      allowed: false,
      path: null,
      reason: "wrong-state",
    });
  });

  it("can omit the default shared hook mocks", () => {
    const actual = { useAuth: () => "actual" };
    const withoutDefaults = createSharedBarrelMock(actual, {}, { defaults: false });
    const withDefaults = createSharedBarrelMock(actual);

    expect(withoutDefaults.useAuth).toBe(actual.useAuth);
    expect(withDefaults.useAuth).not.toBe(actual.useAuth);
  });
});
