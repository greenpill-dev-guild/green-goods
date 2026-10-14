/**
 * The Your Work count (D1): everything still on this phone, and nothing that
 * has left it.
 *
 * @vitest-environment happy-dom
 */

import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useYourWorkCount } from "../../../hooks/work/useYourWorkCount";
import {
  type CommitmentProofDraft,
  commitmentProofDraftKey,
  useCommitmentProofDraftStore,
} from "../../../stores/useCommitmentProofDraftStore";
import type { Job } from "../../../types/job-queue";

const VIEWER = "0x1111111111111111111111111111111111111111";
const CHAIN = 42161;

const mocks = vi.hoisted(() => ({
  draftCount: 0,
  jobs: [] as Array<Pick<Job, "id" | "kind" | "chainId">>,
}));

vi.mock("../../../hooks/auth/usePrimaryAddress", () => ({ usePrimaryAddress: () => VIEWER }));
vi.mock("../../../hooks/blockchain/useChainConfig", () => ({ useCurrentChain: () => CHAIN }));
vi.mock("../../../hooks/work/useDrafts", () => ({
  useDrafts: () => ({ draftCount: mocks.draftCount }),
}));
// The queue's own filter keeps synced jobs and other readers out; the hook gets what it asked for.
vi.mock("../../../hooks/utils/useLiveQuery", () => ({
  useLiveQuery: () => ({ data: mocks.jobs }),
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

const count = () => renderHook(() => useYourWorkCount()).result.current.count;

describe("useYourWorkCount", () => {
  beforeEach(() => {
    mocks.draftCount = 0;
    mocks.jobs = [];
    useCommitmentProofDraftStore.setState({ drafts: {} });
  });

  it("counts work drafts", () => {
    mocks.draftCount = 2;
    expect(count()).toBe(2);
  });

  it("counts work and decisions waiting to upload or being checked, and queued proof", () => {
    mocks.jobs = [
      { id: "w1", kind: "work" },
      { id: "w2", kind: "work" },
      { id: "a1", kind: "approval" },
      { id: "e1", kind: "evidence" },
    ];
    expect(count()).toBe(4);
  });

  it("leaves out other promise acts still queued, and another chain's work", () => {
    mocks.jobs = [
      { id: "c1", kind: "claim" },
      { id: "c2", kind: "confirmation" },
      { id: "c3", kind: "commitment" },
      { id: "w9", kind: "work", chainId: 11155111 },
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
      },
    });
    expect(count()).toBe(0);
  });

  it("adds them all together", () => {
    mocks.draftCount = 1;
    mocks.jobs = [{ id: "w1", kind: "work" }];
    useCommitmentProofDraftStore.setState({ drafts: { [key(1)]: proofDraft({ note: "x" }) } });
    expect(count()).toBe(3);
  });
});
