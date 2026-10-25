/**
 * The arrival toast's one remaining orientation (PWA Home step 12): uploads still on this phone.
 * Home's chip and Continue show the member's garden and drafts, so those branches are gone. Where
 * the toast points is `orientUploads`, tested with the rest of Your Work on this phone; here the
 * queue's jobs reach it, and silence holds until the answer is known.
 */

import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useArrivalState } from "../../hooks/app/useArrivalState";
import type { Job } from "../../types/job-queue";

const { ACCOUNT, CHAIN, GARDEN, OTHER_GARDEN, THIRD_GARDEN, mocks } = vi.hoisted(() => ({
  ACCOUNT: "0xAbC0000000000000000000000000000000000001",
  CHAIN: 42161,
  GARDEN: "0x6a7de00000000000000000000000000000000aaa",
  OTHER_GARDEN: "0x0757e00000000000000000000000000000000bbb",
  THIRD_GARDEN: "0x7a1de00000000000000000000000000000000ccc",
  mocks: {
    account: null as string | null,
    queue: { data: undefined as Job[] | undefined, isSuccess: false },
    gardensLoaded: true,
  },
}));

vi.mock("../../hooks/auth/usePrimaryAddress", () => ({ usePrimaryAddress: () => mocks.account }));
vi.mock("../../hooks/blockchain/useChainConfig", () => ({ useCurrentChain: () => CHAIN }));
// The queue is this phone's IndexedDB; the live query is its edge.
vi.mock("../../hooks/utils/useLiveQuery", () => ({ useLiveQuery: () => mocks.queue }));
// The active garden's own rule over the member's gardens: GARDEN is active, the others switch.
vi.mock("../../hooks/garden/useActiveGarden", async () => {
  const { isInGardenListScope } = await vi.importActual<
    typeof import("../../modules/garden/active-garden")
  >("../../modules/garden/active-garden");
  const gardens = [
    { id: GARDEN, name: "TAS HUB" },
    { id: OTHER_GARDEN, name: "Vida Verde" },
    { id: THIRD_GARDEN, name: "Ilhas" },
  ];
  return {
    useActiveGarden: () => ({
      inScope: (named: readonly (string | null | undefined)[]) =>
        isInGardenListScope(
          {
            activeGardenId: GARDEN,
            memberGardenIds: mocks.gardensLoaded ? new Set(gardens.map(({ id }) => id)) : null,
          },
          named
        ),
      myGardens: {
        gardens: mocks.gardensLoaded
          ? gardens.map((garden) => ({ garden, membership: { roles: ["gardener"] } }))
          : [],
        isLoaded: mocks.gardensLoaded,
      },
    }),
  };
});

function job(kind: string, gardenAddress: string, createdAt: number, chainId = CHAIN): Job {
  return {
    id: `${kind}-${createdAt}`,
    kind,
    chainId,
    payload: { gardenAddress },
    meta: {},
    createdAt,
    attempts: 0,
    synced: false,
    userAddress: ACCOUNT,
  } as Job;
}

function arriveWith(jobs: Job[] | undefined) {
  mocks.queue = { data: jobs, isSuccess: jobs !== undefined };
  return renderHook(() => useArrivalState()).result.current;
}

describe("useArrivalState", () => {
  beforeEach(() => {
    mocks.account = ACCOUNT;
    mocks.gardensLoaded = true;
  });

  it("stays silent until the queue answers, and when nothing waits on this phone", () => {
    expect(arriveWith(undefined)).toEqual({ kind: "none" });
    expect(arriveWith([])).toEqual({ kind: "none" });

    mocks.account = null;
    expect(arriveWith([job("work", GARDEN, 1)])).toEqual({ kind: "none" });
  });

  it("speaks only for what Your Work lists: work, reviews and proof queued on this chain", () => {
    expect(
      arriveWith([
        job("claim", GARDEN, 1),
        job("commitment", GARDEN, 2),
        job("work", GARDEN, 3, 10),
      ])
    ).toEqual({ kind: "none" });

    for (const kind of ["work", "approval", "evidence"]) {
      expect(arriveWith([job(kind, GARDEN, 4)])).toEqual({
        kind: "queue",
        orientation: { target: "yourWork" },
      });
    }
  });

  it("names the garden the newest upload waits in when the active garden's list holds none of them", () => {
    expect(arriveWith([job("work", OTHER_GARDEN, 1), job("approval", THIRD_GARDEN, 2)])).toEqual({
      kind: "queue",
      orientation: { target: "switcher", gardenId: THIRD_GARDEN, gardenName: "Ilhas" },
    });
  });

  it("waits for the member's gardens before pointing at an upload outside the active garden", () => {
    mocks.gardensLoaded = false;
    expect(arriveWith([job("work", OTHER_GARDEN, 1)])).toEqual({ kind: "none" });
    expect(arriveWith([job("work", GARDEN, 1)])).toEqual({
      kind: "queue",
      orientation: { target: "yourWork" },
    });
  });
});
