import { beforeEach, expect, it, vi } from "vitest";
import {
  queueDraftWrite,
  deleteWorkDraft,
  registerDraftFormReset,
} from "../../modules/work/draft-lifecycle";
import { useWorkFlowStore } from "../../stores/useWorkFlowStore";
const mocks = vi.hoisted(() => ({ remove: vi.fn(), get: vi.fn() }));
vi.mock("../../modules/job-queue/draft-db", () => ({
  draftDB: { getDraft: mocks.get, deleteDraft: mocks.remove },
}));
beforeEach(() => {
  useWorkFlowStore.getState().reset();
  useWorkFlowStore.setState({
    activeDraftId: "active",
    draftScope: "owner:chain",
    draftHydrated: true,
    images: [new File(["photo"], "photo.jpg")],
  });
  mocks.get.mockResolvedValue(undefined);
  mocks.remove.mockReset().mockResolvedValue(undefined);
});
it("waits for an in-flight write and clears the form only after deletion commits", async () => {
  let release!: () => void;
  const write = queueDraftWrite(
    () =>
      new Promise<void>((resolve) => {
        release = resolve;
      })
  );
  await Promise.resolve();
  await Promise.resolve();
  const reset = vi.fn();
  const unregister = registerDraftFormReset(reset);
  const deletion = deleteWorkDraft("active");
  expect(useWorkFlowStore.getState().draftDeleting).toBe(true);
  expect(mocks.remove).not.toHaveBeenCalled();
  release();
  await write;
  await deletion;
  expect(reset).toHaveBeenCalledOnce();
  expect(useWorkFlowStore.getState().images).toEqual([]);
  unregister();
});
it("preserves the composer after a failed deletion without reviving its old generation", async () => {
  const epoch = useWorkFlowStore.getState().draftEpoch;
  mocks.remove.mockRejectedValue(new Error("quota"));
  await expect(deleteWorkDraft("active")).rejects.toThrow("quota");
  expect(useWorkFlowStore.getState()).toMatchObject({
    activeDraftId: "active",
    draftDeleting: false,
    draftSaveState: "failed",
  });
  expect(useWorkFlowStore.getState().images).toHaveLength(1);
  expect(useWorkFlowStore.getState().draftEpoch).toBeGreaterThan(epoch);
});
it("does not reset the active composer when deleting another draft", async () => {
  await deleteWorkDraft("another");
  expect(useWorkFlowStore.getState().activeDraftId).toBe("active");
  expect(useWorkFlowStore.getState().images).toHaveLength(1);
});
it("does not clear a new account after deletion completes", async () => {
  let release!: () => void;
  mocks.remove.mockImplementation(
    () =>
      new Promise<void>((resolve) => {
        release = resolve;
      })
  );
  const deletion = deleteWorkDraft("active");
  for (let n = 0; n < 6; n++) await Promise.resolve();
  useWorkFlowStore.setState((state) => ({
    draftEpoch: state.draftEpoch + 1,
    draftScope: "new:chain",
    feedback: "new account",
  }));
  release();
  await deletion;
  expect(useWorkFlowStore.getState().feedback).toBe("new account");
});
