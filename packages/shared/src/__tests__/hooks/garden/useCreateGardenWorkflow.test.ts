/** @vitest-environment happy-dom */
import { act, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { useCreateGardenWorkflow } from "../../../hooks/garden/useCreateGardenWorkflow";
import { resetCreateGardenStore, useCreateGardenStore } from "../../../stores/useCreateGardenStore";
import { renderHookWithProviders } from "../../test-utils/render-helpers";

const mocks = vi.hoisted(() => ({
  address: "0x1111111111111111111111111111111111111111",
  chainId: 11155111,
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
      selectedChainId: mocks.chainId,
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
  mocks.chainId = 11155111;
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
  useCreateGardenStore.getState().recordPendingSubmission(pending);
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
    expect(
      useCreateGardenStore.getState().getPendingSubmission(pending.accountAddress, pending.chainId)
    ).toBeUndefined();
    expect(mocks.clearDraft).toHaveBeenCalled();
    expect(mocks.updateStatus).toHaveBeenCalledWith(pending.result.hash, "confirmed");
  } else {
    expect(
      useCreateGardenStore.getState().getPendingSubmission(pending.accountAddress, pending.chainId)
    ).toBe(pending);
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
  useCreateGardenStore.getState().recordPendingSubmission(pending);
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
  if (replaced)
    useCreateGardenStore
      .getState()
      .recordPendingSubmission({ ...other, accountAddress: pending.accountAddress });
  rerender();
  await act(async () => finish({ status: "confirmed", transactionHash: `0x${"ab".repeat(32)}` }));
  await waitFor(() => expect(result.current.state.matches("collecting")).toBe(true));
  expect(
    useCreateGardenStore.getState().getPendingSubmission(pending.accountAddress, pending.chainId)
  ).toEqual(replaced ? { ...other, accountAddress: pending.accountAddress } : pending);
  expect(mocks.clearDraft).not.toHaveBeenCalled();
  expect(mocks.updateStatus).not.toHaveBeenCalled();
  expect(mocks.create).not.toHaveBeenCalled();
});

it.each([
  "account",
  "chain",
])("keeps another %s's proposal while admitting a new scoped deployment", async (change) => {
  const oldAccount = mocks.address as `0x${string}`;
  const oldChain = mocks.chainId;
  const pending = {
    accountAddress: oldAccount,
    chainId: oldChain,
    gardenName: "First",
    result: {
      hash: "0xFirstProposal" as const,
      sponsored: false,
      confirmation: "pending" as const,
    },
  };
  useCreateGardenStore.getState().recordPendingSubmission(pending);
  if (change === "account") mocks.address = "0x2222222222222222222222222222222222222222";
  else mocks.chainId = 42161;
  const store = useCreateGardenStore.getState();
  store.setField("name", "Second garden");
  store.setField("slug", "second-garden");
  store.setField("description", "Second description");
  store.setField("location", "Earth");
  store.setField("domains", [0]);
  store.addGardener(mocks.address);
  mocks.create.mockResolvedValueOnce({ hash: "0xSecondExecution", sponsored: false });
  const { result, unmount } = renderHookWithProviders(() => useCreateGardenWorkflow());
  act(() => {
    result.current.openFlow();
    result.current.goToReview();
  });
  act(() => {
    result.current.submitCreation();
  });
  await waitFor(() => expect(result.current.state.matches("success")).toBe(true));
  expect(mocks.create).toHaveBeenCalledWith(
    expect.objectContaining({ accountAddress: mocks.address, chainId: mocks.chainId }),
    expect.anything()
  );
  expect(useCreateGardenStore.getState().getPendingSubmission(oldAccount, oldChain)).toBe(pending);
  unmount();
  mocks.address = oldAccount;
  mocks.chainId = oldChain;
  const restored = renderHookWithProviders(() => useCreateGardenWorkflow());
  act(() => restored.result.current.openFlow());
  expect(restored.result.current.state.matches("pending")).toBe(true);
});
