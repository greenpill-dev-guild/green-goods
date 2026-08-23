/** @vitest-environment jsdom */

import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useHubConfirmQueueController } from "../../../hooks/admin-ui/pool/useHubConfirmQueueController";
import type { CommitmentJobInput } from "../../../hooks/commitment-pooling/useCommitmentJobs";
import type { CommitmentMutationInput } from "../../../hooks/commitment-pooling/useCommitmentMutations";
import {
  DEMO_CHAIN_ID,
  DEMO_GARDEN,
  MARIA,
  TUNDE,
} from "../../../modules/commitment-pooling/demo/demo-builders";
import type { HexString } from "../../../modules/commitment-pooling/types";
import { commitmentFixture, toConfirmFixture } from "../../test-utils/commitment-pooling-fixtures";

type Enqueue = (input: CommitmentJobInput) => Promise<string>;
type Mutate = (input: CommitmentMutationInput) => Promise<HexString>;

const mocks = vi.hoisted(() => ({
  isOnline: true,
  jobsPending: false,
  mutationPending: false,
  enqueue: vi.fn<Enqueue>(),
  mutate: vi.fn<Mutate>(),
  metadata: vi.fn(),
}));

vi.mock("../../../hooks/app/useOnlineStatus", () => ({
  useOnlineStatus: () => mocks.isOnline,
}));

vi.mock("../../../hooks/commitment-pooling/useCommitmentJobs", () => ({
  useCommitmentJobs: () => ({
    enqueue: mocks.enqueue,
    isPending: mocks.jobsPending,
    error: null,
    viewer: TUNDE,
  }),
}));

vi.mock("../../../hooks/commitment-pooling/useCommitmentMutations", () => ({
  useCommitmentMutation: () => ({
    mutateAsync: mocks.mutate,
    isPending: mocks.mutationPending,
  }),
}));

vi.mock("../../../hooks/commitment-pooling/useCommitmentMetadata", () => ({
  useCommitmentMetadata: mocks.metadata,
}));

const ordinary = commitmentFixture({
  commitmentId: 1001n,
  metadataCID: "bafy-ordinary",
  onchainState: "READY_FOR_CONFIRMATION",
});
const fallback = commitmentFixture({
  commitmentId: 1002n,
  metadataCID: "bafy-fallback",
  onchainState: "READY_FOR_CONFIRMATION",
});
const disputed = commitmentFixture({
  commitmentId: 1003n,
  metadataCID: "bafy-disputed",
  onchainState: "DISPUTED",
});

function confirmationInput() {
  return toConfirmFixture({
    groups: [
      {
        garden: TUNDE,
        gardenName: "River Garden",
        rows: [
          {
            commitment: ordinary,
            seat: "confirmer",
            needsYou: true,
            poolGarden: MARIA,
            canDispute: false,
          },
        ],
      },
    ],
    fallback: [
      {
        commitment: fallback,
        path: "PROTOCOL_FALLBACK",
        garden: MARIA,
        gardenName: "Protocol Garden",
        activeContributors: [],
        poolGarden: DEMO_GARDEN,
        canDispute: true,
      },
    ],
    disputed: [
      {
        commitment: disputed,
        garden: DEMO_GARDEN,
        gardenName: "Orchard Garden",
      },
    ],
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.isOnline = true;
  mocks.jobsPending = false;
  mocks.mutationPending = false;
  mocks.enqueue.mockResolvedValue("job-123");
  mocks.mutate.mockResolvedValue("0x123");
  mocks.metadata.mockReturnValue({
    byCID: new Map([
      ["bafy-ordinary", { version: 1, title: "Repair tool handles" }],
      ["bafy-fallback", { version: 1, title: "Restore the tool shed" }],
    ]),
    isLoading: false,
  });
});

describe("useHubConfirmQueueController", () => {
  it("orders ordinary, fallback, and disputed rows with metadata and pool authority", () => {
    const toConfirm = confirmationInput();
    const { result } = renderHook(() =>
      useHubConfirmQueueController({ chainId: DEMO_CHAIN_ID, toConfirm, search: "" })
    );

    expect(result.current.rows.map((row) => row.eligibility)).toEqual([
      "ORDINARY",
      "PROTOCOL_FALLBACK",
      "DISPUTED",
    ]);
    expect(result.current.rows.map((row) => row.title)).toEqual([
      "Repair tool handles",
      "Restore the tool shed",
      null,
    ]);
    expect(result.current.rows[0]).toMatchObject({
      garden: TUNDE,
      poolGarden: MARIA,
      canDispute: false,
    });
    expect(result.current.rows[2]).toMatchObject({
      garden: DEMO_GARDEN,
      poolGarden: DEMO_GARDEN,
      canDispute: true,
    });
    expect(mocks.metadata).toHaveBeenCalledWith([ordinary, fallback, disputed]);
  });

  it("filters case-insensitively by title or garden name", () => {
    const toConfirm = confirmationInput();
    const { result, rerender } = renderHook(
      ({ search }) => useHubConfirmQueueController({ chainId: DEMO_CHAIN_ID, toConfirm, search }),
      { initialProps: { search: "rEpAiR" } }
    );

    expect(result.current.rows.map((row) => row.commitment.commitmentId)).toEqual([1001n]);

    rerender({ search: " ORCHARD " });
    expect(result.current.rows.map((row) => row.commitment.commitmentId)).toEqual([1003n]);

    rerender({ search: "missing" });
    expect(result.current.rows).toEqual([]);
  });

  it("confirms with the row authority garden rather than its pool garden", async () => {
    const toConfirm = confirmationInput();
    const { result } = renderHook(() =>
      useHubConfirmQueueController({ chainId: DEMO_CHAIN_ID, toConfirm, search: "" })
    );
    const row = result.current.rows[0]!;

    await act(async () => {
      await result.current.acts.confirm(row);
    });

    expect(mocks.enqueue).toHaveBeenCalledWith({
      act: "confirm",
      commitmentId: ordinary.commitmentId,
      gardenAddress: TUNDE,
    });
  });

  it("raises a reasoned dispute with the row authority garden", async () => {
    const toConfirm = confirmationInput();
    const { result } = renderHook(() =>
      useHubConfirmQueueController({ chainId: DEMO_CHAIN_ID, toConfirm, search: "" })
    );
    const row = result.current.rows[1]!;

    await act(async () => {
      await result.current.acts.notYet(row, "The evidence is incomplete");
    });

    expect(mocks.mutate).toHaveBeenCalledWith({
      action: "raiseDispute",
      commitmentId: fallback.commitmentId,
      reason: "The evidence is incomplete",
      gardenAddress: MARIA,
    });
  });

  it("combines loading and pending state and tolerates missing disputed rows", () => {
    mocks.isOnline = false;
    mocks.jobsPending = true;
    mocks.mutationPending = true;
    mocks.metadata.mockReturnValue({ byCID: new Map(), isLoading: true });
    const toConfirm = toConfirmFixture({
      disputed: undefined,
      isLoading: false,
      isError: true,
    });
    const { result } = renderHook(() =>
      useHubConfirmQueueController({ chainId: DEMO_CHAIN_ID, toConfirm, search: "" })
    );

    expect(result.current.rows).toHaveLength(2);
    expect(result.current).toMatchObject({
      isOnline: false,
      isLoading: true,
      isError: true,
      isConfirming: true,
      isDisputing: true,
    });
  });
});
