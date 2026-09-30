/** @vitest-environment happy-dom */

/**
 * Waiting for approval holds steady for a visit: asks keep the place they were
 * first seen in, a new one joins the end marked new, a decision stays as its
 * outcome after the index moves on, and the card and the inspector share one
 * approval line and one set of decisions.
 */

import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useClaimDecisions, useClaimDecisionVisit } from "../hooks/admin-ui/pool/useClaimDecisions";
import { useWaitingForApproval } from "../hooks/admin-ui/pool/useWaitingForApproval";
import {
  claimRowKey,
  EMPTY_WAITING_VISIT,
  isStillWaiting,
  reconcileWaitingVisit,
  waitingRowState,
} from "../modules/commitment-pooling/waiting-for-approval";
import type { PoolClaimRequestRow } from "../modules/commitment-pooling/types-core";
import { IDLE_ACT_PHASE } from "../modules/transactions/act-phase";
import { useClaimDecisionStore } from "../stores/useClaimDecisionStore";
import type { Address } from "../types/domain";
import { claimFixture, commitmentFixture } from "./test-utils/commitment-pooling-fixtures";

const GARDEN = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as Address;
const INES = "0x1111111111111111111111111111111111111111" as Address;
const KWAME = "0x2222222222222222222222222222222222222222" as Address;
const LENA = "0x3333333333333333333333333333333333333333" as Address;

function ask(commitmentId: bigint, claimant: Address): PoolClaimRequestRow {
  return {
    claim: claimFixture({ commitmentId, claimant }),
    commitment: commitmentFixture({ commitmentId, direction: "REQUEST" }),
  };
}

const ines = ask(3n, INES);
const kwame = ask(3n, KWAME);
const lena = ask(7n, LENA);
const none = { live: new Set<string>(), decisions: {}, phase: IDLE_ACT_PHASE };

beforeEach(() => {
  useClaimDecisionStore.getState().beginVisit("test");
});

describe("the visit's rows", () => {
  it("keeps first-read asks in place, appends a later one as new, and keeps one that left", () => {
    const first = reconcileWaitingVisit(EMPTY_WAITING_VISIT, [ines, kwame]);
    // The index lists the new ask first; it still joins the end.
    const later = reconcileWaitingVisit(first, [lena, kwame]);

    expect(later.entries.map((entry) => [entry.key, entry.isNew])).toEqual([
      [claimRowKey(ines), false],
      [claimRowKey(kwame), false],
      [claimRowKey(lena), true],
    ]);
    const live = new Set([claimRowKey(lena), claimRowKey(kwame)]);
    const [gone, waiting, arrived] = later.entries.map((entry) =>
      waitingRowState(entry, { ...none, live })
    );
    expect(gone).toEqual({ status: "gone" });
    expect(waiting).toEqual({ status: "waiting", isNew: false });
    expect(arrived).toEqual({ status: "waiting", isNew: true });
  });

  it("closes the other asks on an approved promise and keeps each decision's time", () => {
    const visit = reconcileWaitingVisit(EMPTY_WAITING_VISIT, [ines, kwame, lena]);
    const decisions = {
      [claimRowKey(ines)]: { kind: "approved" as const, commitmentId: "3", at: 1_000 },
      [claimRowKey(lena)]: { kind: "declined" as const, commitmentId: "7", at: 2_000 },
    };
    const live = new Set(visit.entries.map((entry) => entry.key));

    expect(
      visit.entries.map((entry) => waitingRowState(entry, { ...none, live, decisions }))
    ).toEqual([
      { status: "approved", at: 1_000 },
      { status: "not-chosen", at: 1_000 },
      { status: "declined", at: 2_000 },
    ]);
  });

  it("puts an approval in flight, or one that failed, on its own row, which still waits", () => {
    const [entry] = reconcileWaitingVisit(EMPTY_WAITING_VISIT, [ines]).entries;
    const live = new Set([claimRowKey(ines)]);
    const key = claimRowKey(ines);

    const signing = waitingRowState(entry!, { ...none, live, phase: { status: "signing", key } });
    const failed = waitingRowState(entry!, { ...none, live, phase: { status: "failed", key } });
    expect(signing).toEqual({ status: "signing" });
    expect(failed).toEqual({ status: "failed" });
    expect(isStillWaiting(failed)).toBe(true);
    expect(isStillWaiting({ status: "not-chosen", at: 1 })).toBe(false);
  });
});

describe("decisions shared by the card and the inspector", () => {
  it("settles an approval into a decision both surfaces read, and a decline beside it", async () => {
    const card = renderHook(() => useClaimDecisions());
    const inspector = renderHook(() => useClaimDecisions());

    await act(() => card.result.current.approve(3n, INES, async () => "0xabc"));
    await act(() => inspector.result.current.decline(7n, LENA, async () => "0xdef"));

    for (const surface of [card, inspector]) {
      expect(surface.result.current.decisions[claimRowKey(ines)]).toMatchObject({
        kind: "approved",
        commitmentId: "3",
      });
      expect(surface.result.current.decisions[claimRowKey(lena)]?.kind).toBe("declined");
    }
    expect(inspector.result.current.phase).toMatchObject({
      status: "confirmed",
      key: claimRowKey(ines),
    });
  });

  it("leaves a failed approval on its line, undecided, and passes the error on", async () => {
    const { result } = renderHook(() => useClaimDecisions());
    const refused = new Error("User rejected the request");

    await act(async () => {
      await expect(result.current.approve(3n, INES, () => Promise.reject(refused))).rejects.toBe(
        refused
      );
    });
    expect(result.current.phase).toEqual({ status: "failed", key: claimRowKey(ines) });
    expect(result.current.decisions).toEqual({});
  });

  it("starts each visit to a pool's tab with nothing decided", async () => {
    const { result } = renderHook(() => useClaimDecisions());
    await act(() => result.current.approve(3n, INES, async () => "0xabc"));

    const visit = renderHook(({ garden }) => useClaimDecisionVisit(42161, garden), {
      initialProps: { garden: GARDEN },
    });
    expect(result.current.decisions).toEqual({});
    expect(result.current.phase).toEqual(IDLE_ACT_PHASE);
    visit.unmount();
  });
});

describe("useWaitingForApproval", () => {
  function source(
    claims: PoolClaimRequestRow[],
    overrides: { isLoading?: boolean; garden?: Address } = {}
  ) {
    return {
      chainId: 42161,
      garden: overrides.garden ?? GARDEN,
      claims,
      claimDecisions: {},
      claimPhase: vi.fn(() => IDLE_ACT_PHASE),
      isLoading: overrides.isLoading ?? false,
    };
  }

  it("marks nothing new from the first settled read, then marks what the refresh brings", () => {
    const { result, rerender } = renderHook((props) => useWaitingForApproval(props), {
      initialProps: source([], { isLoading: true }),
    });
    expect(result.current.rows).toEqual([]);

    rerender(source([ines, kwame]));
    expect(result.current.rows.map((row) => row.state)).toEqual([
      { status: "waiting", isNew: false },
      { status: "waiting", isNew: false },
    ]);

    rerender(source([ines, kwame, lena]));
    expect(result.current.rows[2]?.state).toEqual({ status: "waiting", isNew: true });
    expect(result.current).toMatchObject({ waiting: 3, decided: 0 });
  });

  it("keeps an ask that left as a row for the visit, and starts over for another pool", () => {
    const { result, rerender } = renderHook((props) => useWaitingForApproval(props), {
      initialProps: source([ines, kwame]),
    });
    rerender(source([kwame]));
    expect(result.current.rows.map((row) => row.state.status)).toEqual(["gone", "waiting"]);
    expect(result.current).toMatchObject({ waiting: 1, decided: 1 });

    rerender(source([lena], { garden: KWAME }));
    expect(result.current.rows.map((row) => [row.key, row.state])).toEqual([
      [claimRowKey(lena), { status: "waiting", isNew: false }],
    ]);
  });
});
