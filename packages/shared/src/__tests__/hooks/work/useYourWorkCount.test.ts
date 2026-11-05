/**
 * The Your Work count (D1): everything still on this phone, and nothing that
 * has left it, for the active garden (DL-129).
 *
 * @vitest-environment happy-dom
 */

import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useYourWorkCount } from "../../../hooks/work/useYourWorkCount";
import { type GardenListScope, isInGardenListScope } from "../../../modules/garden/active-garden";
import {
  type CommitmentProofDraft,
  commitmentProofDraftKey,
  useCommitmentProofDraftStore,
} from "../../../stores/useCommitmentProofDraftStore";
import type { Job } from "../../../types/job-queue";

const VIEWER = "0x1111111111111111111111111111111111111111";
const CHAIN = 42161;
const GARDEN_A = "0xa000000000000000000000000000000000000001";
const GARDEN_B = "0xb000000000000000000000000000000000000002";
const LEFT_GARDEN = "0xc000000000000000000000000000000000000003";

const mocks = vi.hoisted(() => ({
  drafts: [] as Array<{ id: string; gardenAddress: string | null }>,
  jobs: [] as Array<Pick<Job, "id" | "kind" | "chainId"> & { payload?: unknown }>,
  scope: { activeGardenId: null, memberGardenIds: null } as GardenListScope,
}));

vi.mock("../../../hooks/auth/usePrimaryAddress", () => ({ usePrimaryAddress: () => VIEWER }));
vi.mock("../../../hooks/blockchain/useChainConfig", () => ({ useCurrentChain: () => CHAIN }));
vi.mock("../../../hooks/work/useDrafts", () => ({ useDrafts: () => ({ drafts: mocks.drafts }) }));
// The queue's own filter keeps synced jobs and other readers out; the hook gets what it asked for.
vi.mock("../../../hooks/utils/useLiveQuery", () => ({
  useLiveQuery: () => ({ data: mocks.jobs }),
}));
// Which garden is active is the edge; the scope rule itself runs for real.
vi.mock("../../../hooks/garden/useActiveGarden", () => ({
  useActiveGarden: () => ({
    inScope: (gardens: readonly (string | null | undefined)[]) =>
      isInGardenListScope(mocks.scope, gardens),
  }),
}));

function proofDraft(overrides: Partial<CommitmentProofDraft> = {}): CommitmentProofDraft {
  return {
    note: "",
    links: [],
    credited: null,
    clientEvidenceId: "p-1",
    updatedAt: 1,
    ...overrides,
  };
}

const key = (commitmentId: number, viewer = VIEWER, chainId = CHAIN) =>
  commitmentProofDraftKey({ chainId, viewer, commitmentId: BigInt(commitmentId) });

const draft = (id: string, gardenAddress: string | null = GARDEN_A) => ({ id, gardenAddress });

const job = (id: string, kind: string, gardenAddress?: string) => ({
  id,
  kind,
  payload: gardenAddress ? { gardenAddress } : {},
});

const count = () => renderHook(() => useYourWorkCount()).result.current.count;

describe("useYourWorkCount", () => {
  beforeEach(() => {
    mocks.drafts = [];
    mocks.jobs = [];
    mocks.scope = { activeGardenId: null, memberGardenIds: null };
    useCommitmentProofDraftStore.setState({ drafts: {} });
  });

  it("counts work drafts", () => {
    mocks.drafts = [draft("d1"), draft("d2")];
    expect(count()).toBe(2);
  });

  it("counts work and decisions waiting to upload or being checked, and queued proof", () => {
    mocks.jobs = [
      job("w1", "work"),
      job("w2", "work"),
      job("a1", "approval"),
      job("e1", "evidence"),
    ];
    expect(count()).toBe(4);
  });

  it("leaves out other promise acts still queued, and another chain's work", () => {
    mocks.jobs = [
      job("c1", "claim"),
      job("c2", "confirmation"),
      job("c3", "commitment"),
      { ...job("w9", "work"), chainId: 11155111 },
    ];
    expect(count()).toBe(0);
  });

  it("counts a proof draft once it holds words, a link or a file", () => {
    useCommitmentProofDraftStore.setState({
      drafts: {
        [key(1)]: proofDraft({ note: "Posts replaced" }),
        [key(2)]: proofDraft({ links: ["https://example.org"] }),
        [key(3)]: proofDraft({ files: { photos: 2, videos: 0, voiceNotes: 0 } }),
      },
    });
    expect(count()).toBe(3);
  });

  it("leaves out an empty proof draft, and another reader's or chain's", () => {
    useCommitmentProofDraftStore.setState({
      drafts: {
        [key(1)]: proofDraft({ note: "   ", files: { photos: 0, videos: 0, voiceNotes: 0 } }),
        [key(2, "0x2222222222222222222222222222222222222222")]: proofDraft({ note: "Theirs" }),
        [key(3, VIEWER, 11155111)]: proofDraft({ note: "Other chain" }),
        // A credit choice alone is kept for the composer, and is no draft.
        [key(4)]: proofDraft({ credited: [VIEWER] }),
      },
    });
    expect(count()).toBe(0);
  });

  it("adds them all together", () => {
    mocks.drafts = [draft("d1")];
    mocks.jobs = [job("w1", "work")];
    useCommitmentProofDraftStore.setState({ drafts: { [key(1)]: proofDraft({ note: "x" }) } });
    expect(count()).toBe(3);
  });

  it("counts the active garden's, and what no other garden of the member's can show", () => {
    mocks.scope = {
      activeGardenId: GARDEN_A,
      memberGardenIds: new Set([GARDEN_A, GARDEN_B]),
    };
    // A draft not yet given a garden is counted wherever the member is.
    mocks.drafts = [draft("dA", GARDEN_A), draft("dB", GARDEN_B), draft("dNone", null)];
    mocks.jobs = [
      job("wA", "work", GARDEN_A),
      job("wB", "work", GARDEN_B),
      job("aA", "approval", GARDEN_A),
      job("aB", "approval", GARDEN_B),
      job("eA", "evidence", GARDEN_A),
      job("eB", "evidence", GARDEN_B),
      // Proof queued before jobs named their garden.
      job("eOld", "evidence"),
      // Work for a garden the member left: the chip cannot reach it.
      job("wLeft", "work", LEFT_GARDEN),
    ];
    useCommitmentProofDraftStore.setState({
      drafts: {
        [key(1)]: proofDraft({ note: "A", garden: GARDEN_A }),
        [key(2)]: proofDraft({ note: "B", garden: GARDEN_B }),
        [key(3)]: proofDraft({ note: "Older, with no garden" }),
      },
    });

    // Drafts dA and dNone, jobs wA, aA, eA, eOld and wLeft, proof drafts 1 and 3.
    expect(count()).toBe(9);
  });
});
