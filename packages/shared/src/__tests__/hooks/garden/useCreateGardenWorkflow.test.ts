/** @vitest-environment happy-dom */
import { act, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { useCreateGardenWorkflow } from "../../../hooks/garden/useCreateGardenWorkflow";
import { resetCreateGardenStore, useCreateGardenStore } from "../../../stores/useCreateGardenStore";
import { renderHookWithProviders } from "../../test-utils/render-helpers";

const mocks = vi.hoisted(() => ({
  address: "0x1111111111111111111111111111111111111111",
  reconcile: vi.fn(),
  clearDraft: vi.fn(),
  create: vi.fn(),
  updateStatus: vi.fn(),
}));
vi.mock("../../../hooks/auth/usePrimaryAddress", () => ({
  usePrimaryAddress: () => mocks.address,
}));
vi.mock("../../../hooks/blockchain/useTransactionSender", () => ({
  useTransactionSender: () => ({ sendContractCall: vi.fn() }),
}));
vi.mock("../../../stores/useAdminStore", () => ({
  useAdminStore: (select: (state: unknown) => unknown) =>
    select({
      selectedChainId: 11155111,
      addPendingTransaction: vi.fn(),
      updateTransactionStatus: mocks.updateStatus,
    }),
}));
vi.mock("../../../hooks/garden/useGardenDraft", () => ({
  useGardenDraft: () => ({ clearDraft: mocks.clearDraft }),
}));
vi.mock("../../../modules/garden/create-garden-command", () => ({
  createGarden: mocks.create,
  estimateGardenCreation: vi.fn(),
  createDefaultCreateGardenPorts: () => ({ sender: { reconcile: mocks.reconcile } }),
}));
vi.mock("../../../utils/blockchain/contracts", () => ({
  getNetworkContracts: () => ({ gardenToken: "0x3333333333333333333333333333333333333333" }),
}));
vi.mock("../../../modules/app/analytics-events", () => ({
  trackAdminGardenCreateStarted: vi.fn(),
  trackAdminGardenCreateSuccess: vi.fn(),
  trackAdminGardenCreateFailed: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  resetCreateGardenStore();
  mocks.address = "0x1111111111111111111111111111111111111111";
});

it.each([
  "confirmed",
  "unavailable",
])("settles only positively confirmed execution: %s", async (outcome) => {
  const pending = {
    accountAddress: mocks.address as `0x${string}`,
    chainId: 11155111,
    gardenName: "Pending garden",
    result: {
      hash: "0xPendingProposal" as const,
      sponsored: false,
      confirmation: "pending" as const,
    },
  };
  useCreateGardenStore.setState({ pendingSubmission: pending });
  if (outcome === "confirmed") {
    mocks.reconcile.mockResolvedValueOnce({
      status: "confirmed",
      transactionHash: `0x${"ab".repeat(32)}`,
    });
  } else {
    mocks.reconcile.mockRejectedValueOnce(new Error("RPC unavailable"));
  }
  const { result } = renderHookWithProviders(() => useCreateGardenWorkflow());
  act(() => result.current.openFlow());
  await waitFor(() => expect(result.current.state.matches("pending")).toBe(true));
  act(() => result.current.checkConfirmation());
  await waitFor(() =>
    expect(result.current.state.value).toBe(outcome === "confirmed" ? "success" : "pending")
  );
  if (outcome === "confirmed") {
    expect(useCreateGardenStore.getState().pendingSubmission).toBeUndefined();
    expect(mocks.clearDraft).toHaveBeenCalled();
    expect(mocks.updateStatus).toHaveBeenCalledWith(pending.result.hash, "confirmed");
  } else {
    expect(useCreateGardenStore.getState().pendingSubmission).toBe(pending);
    expect(mocks.clearDraft).not.toHaveBeenCalled();
    expect(mocks.updateStatus).not.toHaveBeenCalled();
  }
  expect(mocks.create).not.toHaveBeenCalled();
});

it.each([
  true,
  false,
])("does not clear another session after late confirmation (record replaced: %s)", async (replaced) => {
  const pending = {
    accountAddress: mocks.address as `0x${string}`,
    chainId: 11155111,
    gardenName: "First garden",
    result: {
      hash: "0xFirstProposal" as const,
      sponsored: false,
      confirmation: "pending" as const,
    },
  };
  useCreateGardenStore.setState({ pendingSubmission: pending });
  let finish!: (value: { status: "confirmed"; transactionHash: `0x${string}` }) => void;
  mocks.reconcile.mockReturnValue(
    new Promise((resolve) => {
      finish = resolve;
    })
  );
  const { result, rerender } = renderHookWithProviders(() => useCreateGardenWorkflow());
  act(() => result.current.openFlow());
  await waitFor(() => expect(result.current.state.matches("pending")).toBe(true));
  act(() => result.current.checkConfirmation());
  await waitFor(() => expect(mocks.reconcile).toHaveBeenCalledOnce());
  mocks.address = "0x2222222222222222222222222222222222222222";
  const other = {
    ...pending,
    accountAddress: mocks.address as `0x${string}`,
    result: { ...pending.result, hash: "0xSecondProposal" as const },
  };
  if (replaced) useCreateGardenStore.setState({ pendingSubmission: other });
  rerender();
  await act(async () => finish({ status: "confirmed", transactionHash: `0x${"ab".repeat(32)}` }));
  await waitFor(() => expect(result.current.state.matches("pending")).toBe(true));
  expect(useCreateGardenStore.getState().pendingSubmission).toBe(replaced ? other : pending);
  expect(mocks.clearDraft).not.toHaveBeenCalled();
  expect(mocks.updateStatus).not.toHaveBeenCalled();
  expect(mocks.create).not.toHaveBeenCalled();
});
