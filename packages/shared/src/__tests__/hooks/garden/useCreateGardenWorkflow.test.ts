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
  peekDraft: vi.fn(),
  create: vi.fn(),
  updateStatus: vi.fn(),
  ownership: vi.fn(),
  trackFailed: vi.fn(),
}));
vi.mock("../../../hooks/auth/usePrimaryAddress", () => ({
  usePrimaryAddress: () => mocks.address,
}));
vi.mock("../../../hooks/blockchain/useTransactionSender", () => ({
  useTransactionSender: () => ({ sendContractCall: vi.fn(), assertOwnership: mocks.ownership }),
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
  useGardenDraft: () => ({ clearDraft: mocks.clearDraft, peekDraft: mocks.peekDraft }),
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
  trackAdminGardenCreateFailed: mocks.trackFailed,
}));

beforeEach(() => {
  vi.clearAllMocks();
  resetCreateGardenStore();
  mocks.address = "0x1111111111111111111111111111111111111111";
  mocks.chainId = 11155111;
  mocks.clearDraft.mockResolvedValue(true);
  mocks.peekDraft.mockResolvedValue(null);
  useCreateGardenStore.getState().selectDraftScope(mocks.address as `0x${string}`, mocks.chainId);
});

it.each([
  "confirmed",
  "unavailable",
  "cleanup-failed",
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
  if (outcome === "cleanup-failed") mocks.clearDraft.mockResolvedValue(false);
  if (outcome !== "unavailable") {
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
    expect(result.current.state.value).toBe(outcome !== "unavailable" ? "success" : "pending")
  );
  if (outcome === "confirmed") {
    expect(
      useCreateGardenStore.getState().getPendingSubmission(pending.accountAddress, pending.chainId)
    ).toBeUndefined();
    expect(mocks.clearDraft).toHaveBeenCalled();
    expect(mocks.updateStatus).toHaveBeenCalledWith(pending.result.hash, "confirmed");
  } else if (outcome === "cleanup-failed") {
    expect(
      useCreateGardenStore.getState().getPendingSubmission(pending.accountAddress, pending.chainId)
        ?.result.confirmation
    ).toBeUndefined();
    expect(
      useCreateGardenStore.getState().getPendingSubmission(pending.accountAddress, pending.chainId)
    ).toBeDefined();
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
  store.selectDraftScope(mocks.address as `0x${string}`, mocks.chainId);
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

it("selects the remounted account's editable draft while retaining the previous account's proposal", () => {
  const account = mocks.address as `0x${string}`;
  useCreateGardenStore.getState().setField("name", "First account's garden");
  useCreateGardenStore.getState().recordPendingSubmission({
    accountAddress: account,
    chainId: mocks.chainId,
    gardenName: "First",
    result: { hash: "0xFirst", sponsored: false, confirmation: "pending" },
  });
  const first = renderHookWithProviders(() => useCreateGardenWorkflow());
  first.unmount();
  mocks.address = "0x2222222222222222222222222222222222222222";
  const second = renderHookWithProviders(() => useCreateGardenWorkflow());
  act(() => second.result.current.openFlow());
  expect(useCreateGardenStore.getState().form.name).toBe("");
  expect(
    useCreateGardenStore.getState().getPendingSubmission(account, mocks.chainId)?.result.hash
  ).toBe("0xFirst");
});

it("keeps a send that completes after scope switching recoverable without another deployment", async () => {
  const account = mocks.address as `0x${string}`;
  const chain = mocks.chainId;
  const store = useCreateGardenStore.getState();
  store.setField("name", "First garden");
  store.setField("slug", "first");
  store.setField("description", "Description");
  store.setField("location", "Earth");
  store.setField("domains", [0]);
  store.addGardener(account);
  let finish!: (result: { hash: `0x${string}`; sponsored: boolean }) => void;
  mocks.create.mockReturnValueOnce(
    new Promise((resolve) => {
      finish = resolve;
    })
  );
  const first = renderHookWithProviders(() => useCreateGardenWorkflow());
  act(() => {
    first.result.current.openFlow();
    first.result.current.goToReview();
  });
  act(() => {
    first.result.current.submitCreation();
  });
  await waitFor(() => expect(mocks.create).toHaveBeenCalledOnce());
  mocks.address = "0x2222222222222222222222222222222222222222";
  first.rerender();
  await act(async () => finish({ hash: "0xFirstExecution", sponsored: false }));
  expect(store.getPendingSubmission(account, chain)?.result.hash).toBe("0xFirstExecution");
  first.unmount();
  mocks.address = account;
  const restored = renderHookWithProviders(() => useCreateGardenWorkflow());
  act(() => restored.result.current.openFlow());
  expect(restored.result.current.state.matches("pending")).toBe(true);
  act(() => restored.result.current.checkConfirmation());
  await waitFor(() => expect(restored.result.current.state.matches("success")).toBe(true));
  expect(mocks.create).toHaveBeenCalledOnce();
});

it("starts a new deployment after Create Another even when draft cleanup failed", async () => {
  const account = mocks.address as `0x${string}`;
  const store = useCreateGardenStore.getState();
  store.recordPendingSubmission({
    accountAddress: account,
    chainId: mocks.chainId,
    gardenName: "Completed garden",
    result: { hash: "0xPreviousExecution", sponsored: false },
    successTracked: true,
  });
  mocks.clearDraft.mockResolvedValue(false);
  const { result } = renderHookWithProviders(() => useCreateGardenWorkflow());
  act(() => result.current.openFlow());
  act(() => result.current.checkConfirmation());
  await waitFor(() => expect(result.current.state.matches("success")).toBe(true));
  expect(store.getPendingSubmission(account, mocks.chainId)).toBeDefined();
  act(() => result.current.createAnother());
  expect(store.getPendingSubmission(account, mocks.chainId)).toBeUndefined();
  act(() => {
    store.setField("name", "New garden");
    store.setField("slug", "new-garden");
    store.setField("description", "New description");
    store.setField("location", "Earth");
    store.setField("domains", [0]);
    store.addGardener(account);
    result.current.goToReview();
  });
  mocks.create.mockResolvedValueOnce({ hash: "0xNewExecution", sponsored: false });
  act(() => result.current.submitCreation());
  await waitFor(() => expect(result.current.state.matches("success")).toBe(true));
  expect(mocks.create).toHaveBeenCalledOnce();
  expect(result.current.state.context.txHash).toBe("0xNewExecution");
});

it("records a recovered garden failure once before removing its checkpoint", async () => {
  const account = mocks.address as `0x${string}`;
  const store = useCreateGardenStore.getState();
  store.recordPendingSubmission({
    accountAddress: account,
    chainId: mocks.chainId,
    gardenName: "Rejected garden",
    result: { hash: "0xProposal", sponsored: false, confirmation: "pending" },
  });
  mocks.reconcile.mockResolvedValueOnce({ status: "reverted" });
  const { result } = renderHookWithProviders(() => useCreateGardenWorkflow());
  act(() => result.current.openFlow());
  act(() => result.current.checkConfirmation());
  await waitFor(() => expect(result.current.state.matches("error")).toBe(true));
  expect(store.getPendingSubmission(account, mocks.chainId)).toBeUndefined();
  act(() => result.current.checkConfirmation());
  expect(mocks.trackFailed).toHaveBeenCalledOnce();
  expect(mocks.trackFailed).toHaveBeenCalledWith({
    gardenName: "Rejected garden",
    chainId: mocks.chainId,
    error: "TransactionReverted",
  });
  expect(mocks.create).not.toHaveBeenCalled();
});

it("allows the owner to release a cancelled garden proposal without another send", async () => {
  const account = mocks.address as `0x${string}`;
  useCreateGardenStore
    .getState()
    .recordPendingSubmission({
      accountAddress: account,
      chainId: mocks.chainId,
      gardenName: "Cancelled garden",
      result: { hash: "0xProposal", sponsored: false, confirmation: "pending" },
    });
  const { result } = renderHookWithProviders(() => useCreateGardenWorkflow());
  act(() => result.current.openFlow());
  await expect(result.current.confirmWalletCancellation(false)).rejects.toThrow(
    "confirmation-required"
  );
  await act(() => result.current.confirmWalletCancellation(true));
  expect(mocks.ownership).toHaveBeenCalledWith(account, mocks.chainId);
  expect(
    useCreateGardenStore.getState().getPendingSubmission(account, mocks.chainId)
  ).toBeUndefined();
  expect(result.current.state.matches("pending")).toBe(false);
  expect(mocks.create).not.toHaveBeenCalled();
});
