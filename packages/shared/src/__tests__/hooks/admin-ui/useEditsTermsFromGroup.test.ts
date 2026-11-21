/**
 * @vitest-environment happy-dom
 */

import { waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useEditsTermsFromGroup } from "../../../hooks/admin-ui/pool/useEditsTermsFromGroup";
import type { CommitmentMetadataV1 } from "../../../modules/commitment-pooling/metadata";
import { commitmentFixture } from "../../test-utils/commitment-pooling-fixtures";
import { renderHookWithQueryClient } from "../../test-utils/query-client-render";

const CHAIN_ID = 42161;
const GROUP = "group-handles-01";
const WORDS: CommitmentMetadataV1 = {
  version: 1,
  title: "Repair tool handles",
  displayGroup: { version: 1, id: GROUP },
};

const mocks = vi.hoisted(() => ({ queued: [] as unknown[] }));

vi.mock("../../../hooks/auth/usePrimaryAddress", () => ({
  usePrimaryAddress: () => "0x3333333333333333333333333333333333333333",
}));
vi.mock("../../../hooks/commitment-pooling/useCommitmentMetadata", () => ({
  useCommitmentMetadataFor: () => WORDS,
  useCommitmentMetadata: () => ({
    byCID: new Map([["cid-handles", WORDS]]),
    isLoading: false,
    isError: false,
  }),
}));
vi.mock("../../../modules/job-queue/default-instance", () => ({
  jobQueue: { getJobs: async () => mocks.queued },
}));

// PRD-1548: a group's lone surviving copy is edited on its own, but not while the group still
// has copies queued on this device, as its group row would count them.
describe("useEditsTermsFromGroup", () => {
  const lone = commitmentFixture({ onchainState: "OFFERED", metadataCID: "cid-handles" });

  beforeEach(() => {
    mocks.queued = [];
  });

  it("edits a group's lone surviving copy on its own", async () => {
    const { result } = renderHookWithQueryClient(() =>
      useEditsTermsFromGroup(CHAIN_ID, lone, [lone])
    );
    await waitFor(() => expect(result.current).toBe(false));
  });

  it("leaves both edits to the group while its other copies are queued here", async () => {
    mocks.queued = [
      {
        id: "copy-2",
        kind: "commitment",
        chainId: CHAIN_ID,
        synced: false,
        attempts: 0,
        payload: { metadata: WORDS },
      },
    ];
    const { result } = renderHookWithQueryClient(() =>
      useEditsTermsFromGroup(CHAIN_ID, lone, [lone])
    );
    await waitFor(() => expect(result.current).toBe(true));
  });

  it("can't say while the pool's promises are being read", () => {
    const { result } = renderHookWithQueryClient(() =>
      useEditsTermsFromGroup(CHAIN_ID, lone, undefined)
    );
    expect(result.current).toBeNull();
  });
});
