/** @vitest-environment happy-dom */
import type { CommitmentCreationPayload } from "@green-goods/shared/commitment-pooling";
import type { jobQueue } from "@green-goods/shared/modules/job-queue/default-instance";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, renderWithProviders, screen, waitFor, within } from "../test-utils";

const STEWARD = "0x1111111111111111111111111111111111111111" as const;
const GARDEN = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as const;
const HASH = `0x${"12".repeat(32)}` as const;
type ProcessJobResult = Awaited<ReturnType<typeof jobQueue.processJob>>;
const boundary = vi.hoisted(() => ({
  jobs: [] as Array<{ id: string; payload: CommitmentCreationPayload; synced: boolean }>,
  retry: false,
  release: null as (() => void) | null,
  addJob: vi.fn(),
  retryJob: vi.fn(),
  walletConfig: {},
  writeContractAsync: vi.fn(() => {
    throw new Error("This regression must use the queue substitute, never a live wallet");
  }),
}));
// Keep the actual dialog, hook, payload builder and creation-send coordinator.
// Only chain reads, wallet capability and the persistent queue port are scripted.
vi.mock("@green-goods/shared/hooks/auth/useUser", () => ({
  useUser: () => ({ authMode: "wallet", primaryAddress: STEWARD }),
}));
vi.mock("wagmi", () => ({
  useConfig: () => boundary.walletConfig,
  useWriteContract: () => ({ writeContractAsync: boundary.writeContractAsync }),
}));
vi.mock("@wagmi/core", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  getCapabilities: async () => ({}),
}));
vi.mock("@green-goods/shared/hooks/blockchain/useBaseLists", () => ({
  useGardens: () => ({ data: [{ id: GARDEN, name: "Test Garden" }] }),
}));
vi.mock("@green-goods/shared/utils/blockchain/contracts", () => ({
  CommitmentPoolingModuleABI: [],
  getNetworkContracts: () => ({
    commitmentPoolingModule: "0x9999999999999999999999999999999999999999",
  }),
  createClients: () => ({
    publicClient: {
      readContract: async ({ functionName }: { functionName: string }) =>
        functionName === "getConfirmers"
          ? []
          : {
              poolId: 7n,
              cycleId: 12n,
              commitmentSeriesId: 0n,
              creator: STEWARD,
              direction: 1,
              commitmentType: 1,
              claimType: 0,
              claimMode: 0,
              contributorPolicy: 0,
              requirements: [],
              dueDate: 4_000_000_000n,
              unitLabel: "survey",
              targetUnits: 1n,
              confirmationThreshold: 1,
              protocolFallbackEnabled: false,
              requiresAssessment: false,
              needUID: `0x${"00".repeat(32)}`,
              counterCommitmentId: 0n,
              metadataCID: "bafy-survey",
              consideration: { rail: 0, source: GARDEN, token: GARDEN, amount: 0n },
              declaredUnitValue: 0n,
              declaredValueBasis: "",
            },
    },
  }),
}));
vi.mock("@green-goods/shared/modules/job-queue/default-instance", () => ({
  jobQueue: {
    addJob: (...args: unknown[]) => boundary.addJob(...args),
    getJobs: async () => boundary.jobs.filter((job) => !job.synced),
    retryJob: (...args: unknown[]) => boundary.retryJob(...args),
    discardJob: async () => true,
    processJob: async (
      id: string,
      context: { onPhase?: (phase: { stage: "wallet" }) => void }
    ): Promise<ProcessJobResult> => {
      const index = boundary.jobs.findIndex((job) => job.id === id);
      context.onPhase?.({ stage: "wallet" });
      if (index === 0 && !boundary.retry)
        await new Promise<void>((resolve) => {
          boundary.release = resolve;
        });
      if (boundary.retry || index < 2) {
        boundary.jobs[index]!.synced = true;
        return { success: true, txHash: HASH };
      }
      if (index === 2) return { success: false, skipped: true, txHash: HASH };
      return { success: false, error: "User rejected the request" };
    },
  },
}));

vi.mock("@green-goods/shared/hooks/commitment-pooling/useProtocolPool", () => ({
  useProtocolPool: () => ({ rootGarden: null }),
}));

const { AddToGroupDialog } = await import("@/views/Garden/Pool/Group/AddToGroupDialog");
const props = {
  open: true,
  onClose: vi.fn(),
  onBack: vi.fn(),
  onAdded: vi.fn(),
  chainId: 42161,
  garden: GARDEN,
  owner: STEWARD,
  title: "Water survey",
  group: {
    displayGroupId: "group-00000001",
    dueDate: 4_000_000_000n,
    templateCommitmentId: 21n,
    metadata: {
      version: 1,
      title: "Water survey",
      displayGroup: { version: 1 as const, id: "group-00000001" },
    },
    gardenAddress: GARDEN,
  },
  counts: { published: 10, available: 4, inProgress: 3, kept: 2, ended: 1 },
  terms: [["Asks for", "1 survey"]] as const,
  rewardCents: 500n,
};

beforeEach(() => {
  boundary.jobs = [];
  boundary.retry = false;
  boundary.release = null;
  boundary.addJob.mockReset().mockImplementation(async (_kind, payload) => {
    const id = `job-${boundary.jobs.length}`;
    boundary.jobs.push({ id, payload, synced: false });
    return id;
  });
  boundary.retryJob.mockReset();
  props.onAdded.mockClear();
});

describe("Add dialog with its real hook", () => {
  it("retains chosen and typed counts through rerenders, then retries only unsent identities", async () => {
    const view = renderWithProviders(<AddToGroupDialog {...props} />);
    const dialog = () => within(screen.getByRole("dialog"));
    await waitFor(() =>
      expect(screen.getByTestId("add-prompt-count")).toHaveTextContent(/wallet will ask/i)
    );
    for (const count of [5, 10]) {
      fireEvent.click(dialog().getByRole("button", { name: new RegExp(`^${count}$`) }));
      view.rerender(<AddToGroupDialog {...props} group={{ ...props.group }} />);
      expect(dialog().getByLabelText("Promises")).toHaveValue(String(count));
      expect(dialog().getByRole("button", { name: `Add ${count} Promises` })).toBeEnabled();
    }
    fireEvent.change(dialog().getByLabelText("Promises"), { target: { value: "7" } });
    view.rerender(<AddToGroupDialog {...props} group={{ ...props.group }} />);
    expect(dialog().getByLabelText("Promises")).toHaveValue("7");
    expect(screen.getByTestId("add-to-group")).toHaveTextContent("10 → 17");
    fireEvent.click(dialog().getByRole("button", { name: "Add 7 Promises" }));
    await waitFor(() => expect(boundary.release).not.toBeNull());
    expect(dialog().getByLabelText("Promises")).toBeDisabled();
    expect(dialog().getByLabelText("Promises")).toHaveValue("7");
    const ids = boundary.jobs.map((job) => job.payload.clientCommitmentId);
    await act(async () => boundary.release?.());
    await waitFor(() =>
      expect(dialog().getByRole("button", { name: "Try Again (4)" })).toBeEnabled()
    );
    expect(props.onAdded).not.toHaveBeenCalled();
    expect(dialog().getByLabelText("Promises")).toHaveValue("7");
    boundary.retry = true;
    fireEvent.click(dialog().getByRole("button", { name: "Try Again (4)" }));
    await waitFor(() => expect(props.onAdded).toHaveBeenCalledWith(7));
    expect(boundary.addJob).toHaveBeenCalledTimes(7);
    expect(boundary.retryJob.mock.calls.map(([id]) => id)).toEqual([
      "job-3",
      "job-4",
      "job-5",
      "job-6",
    ]);
    expect(boundary.jobs.map((job) => job.payload.clientCommitmentId)).toEqual(ids);
    expect(new Set(ids).size).toBe(7);
    expect(new Set(boundary.jobs.map((job) => job.payload.dueDate))).toEqual(
      new Set([4_000_000_000n])
    );
  });

  it.each([
    { boundary: "account", next: { owner: GARDEN } },
    { boundary: "chain", next: { chainId: 11155111 } },
    {
      boundary: "group",
      next: { group: { ...props.group, displayGroupId: "group-00000002" } },
    },
  ])("starts a fresh addition when the $boundary identity changes", async ({ next }) => {
    const view = renderWithProviders(<AddToGroupDialog {...props} />);
    await waitFor(() =>
      expect(screen.getByTestId("add-prompt-count")).toHaveTextContent(/wallet will ask/i)
    );
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: /^10$/ }));
    expect(screen.getByLabelText("Promises")).toHaveValue("10");
    view.rerender(<AddToGroupDialog {...props} {...next} />);
    expect(screen.getByLabelText("Promises")).toHaveValue("1");
    expect(screen.getByRole("button", { name: "Add Promise" })).toBeEnabled();
    expect(boundary.addJob).not.toHaveBeenCalled();
  });

  it("starts a fresh addition when the mounted dialog opens again", async () => {
    const view = renderWithProviders(<AddToGroupDialog {...props} />);
    await waitFor(() =>
      expect(screen.getByTestId("add-prompt-count")).toHaveTextContent(/wallet will ask/i)
    );
    fireEvent.change(screen.getByLabelText("Promises"), { target: { value: "7" } });
    expect(screen.getByLabelText("Promises")).toHaveValue("7");
    view.rerender(<AddToGroupDialog {...props} open={false} />);
    view.rerender(<AddToGroupDialog {...props} />);
    expect(screen.getByLabelText("Promises")).toHaveValue("1");
    expect(boundary.addJob).not.toHaveBeenCalled();
  });
});
