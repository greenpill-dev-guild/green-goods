/**
 * @vitest-environment happy-dom
 */

import { act, renderHook, waitFor } from "@testing-library/react";
import React from "react";
import { IntlProvider } from "react-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useActionEditorController } from "../../../hooks/admin-ui/actions/useActionEditorController";

const mocks = vi.hoisted(() => ({
  assertReady: vi.fn(),
  pendingEdits: [] as unknown[],
  reconcileEdits: vi.fn(),
  clearCompletedEdits: vi.fn(),
  clearDraft: vi.fn(),
  getFileByHash: vi.fn(),
  loggerError: vi.fn(),
  navigate: vi.fn(),
  restoreDraft: vi.fn<() => { formState: Record<string, unknown> } | null>(() => null),
  setDraft: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
  updateEndTime: vi.fn(),
  updateInstructions: vi.fn(),
  updateStartTime: vi.fn(),
  updateTitle: vi.fn(),
  uploadFile: vi.fn(),
}));

const batch = vi.hoisted(() => ({
  available: false,
  hold: null as unknown,
  holdFeedback: null as unknown,
  saved: [] as unknown[],
  lastReadAt: 0,
  isSettlingHold: false,
  isSending: false,
  send: vi.fn(),
  order: vi.fn(),
  checkAgain: vi.fn(),
  moveOn: vi.fn(),
}));

const originalStart = new Date("2026-08-01T00:00:00.000Z");
const originalEnd = new Date("2026-08-31T00:00:00.000Z");

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useLocation: () => ({ pathname: "/actions/action-42/edit", search: "" }),
    useNavigate: () => mocks.navigate,
    useParams: () => ({ id: "action-42" }),
  };
});

vi.mock("../../../utils/navigation/admin-routes", () => ({
  adminRoutes: {
    actions: () => "/actions",
    actionDetail: (id: string) => `/actions/${id}`,
  },
}));

vi.mock("../../../hooks/admin-ui/actions/actions.utils", () => ({
  getActionsListSearch: () => ({}),
}));

vi.mock("../../../hooks/blockchain/useBaseLists", () => ({
  useActions: () => ({
    data: [
      {
        id: "action-42",
        title: "Original action",
        slug: "original-action",
        startTime: originalStart.getTime(),
        endTime: originalEnd.getTime(),
        instructions: "",
        translations: {},
      },
    ],
    isLoading: false,
  }),
}));

vi.mock("../../../hooks/action/useActionOperations", () => ({
  useActionOperations: () => ({
    isLoading: false,
    registrationScope: "11155111:owner",
    pendingEdits: mocks.pendingEdits,
    reconcileEdits: mocks.reconcileEdits,
    clearCompletedEdits: mocks.clearCompletedEdits,
    assertReady: mocks.assertReady,
    updateActionEndTime: mocks.updateEndTime,
    updateActionInstructions: mocks.updateInstructions,
    updateActionStartTime: mocks.updateStartTime,
    updateActionTitle: mocks.updateTitle,
  }),
}));

vi.mock("../../../hooks/action/useActionEditBatch", () => ({
  useActionEditBatch: () => batch,
}));

vi.mock("../../../modules/data/ipfs/resolve", () => ({
  getFileByHash: mocks.getFileByHash,
}));

vi.mock("../../../modules/data/ipfs/upload", () => ({
  uploadFileToIPFS: mocks.uploadFile,
}));

vi.mock("../../../components/Toast/toast.service", () => ({
  toastService: {
    dismiss: vi.fn(),
    error: mocks.toastError,
    loading: vi.fn(),
    success: mocks.toastSuccess,
  },
}));

vi.mock("../../../modules/app/logger", () => ({
  logger: { error: mocks.loggerError },
}));

vi.mock("../../../stores/useSheetOrchestratorStore", () => ({
  useSheetOrchestratorStore: Object.assign(
    (selector: (state: Record<string, unknown>) => unknown) =>
      selector({ clearViewState: mocks.clearDraft, setFormState: mocks.setDraft }),
    { getState: () => ({ restoreViewState: mocks.restoreDraft }) }
  ),
}));

function wrapper({ children }: { children: React.ReactNode }) {
  return React.createElement(IntlProvider, { locale: "en", messages: {} }, children);
}

describe("useActionEditorController", () => {
  it("keeps an accepted edit pending without a failure toast or draft cleanup", async () => {
    mocks.updateTitle.mockResolvedValueOnce({ success: false, confirmation: "pending" });
    const { result } = renderHook(() => useActionEditorController(), { wrapper });
    await waitFor(() => expect(result.current.form.getValues("title")).toBe("Original action"));
    await act(() =>
      result.current.submit({
        title: "Updated action",
        startTime: originalStart,
        endTime: originalEnd,
      })
    );
    expect(mocks.toastError).not.toHaveBeenCalled();
    expect(mocks.toastSuccess).not.toHaveBeenCalled();
    expect(mocks.clearDraft).not.toHaveBeenCalled();
    expect(mocks.navigate).not.toHaveBeenCalled();
    expect(mocks.updateInstructions).not.toHaveBeenCalled();
  });

  it("holds a restored edit for confirmation without another update", async () => {
    mocks.pendingEdits = [["pending", {}]];
    const { result } = renderHook(() => useActionEditorController(), { wrapper });
    await waitFor(() => expect(result.current.form.getValues("title")).toBe("Original action"));
    expect(result.current.isPendingEdit).toBe(true);
    await act(() =>
      result.current.submit({ title: "Updated", startTime: originalStart, endTime: originalEnd })
    );
    await act(() => result.current.checkConfirmation());
    expect(mocks.reconcileEdits).toHaveBeenCalledOnce();
    expect(mocks.updateTitle).not.toHaveBeenCalled();
    expect(mocks.toastError).not.toHaveBeenCalled();
  });

  beforeEach(() => {
    mocks.pendingEdits = [];
    mocks.reconcileEdits.mockReset();
    vi.clearAllMocks();
    mocks.restoreDraft.mockReset().mockReturnValue(null);
    mocks.setDraft.mockReset();
    mocks.clearDraft.mockReset();
    mocks.updateEndTime.mockResolvedValue({ success: true });
    mocks.updateInstructions.mockResolvedValue({ success: true });
    mocks.updateStartTime.mockResolvedValue({ success: true });
    mocks.updateTitle.mockResolvedValue({ success: true });
    Object.assign(batch, {
      available: false,
      hold: null,
      holdFeedback: null,
      saved: [],
      lastReadAt: 0,
    });
    batch.order.mockImplementation(async (changes: unknown[]) => changes);
  });

  it("updates changed fields through the production operations seam", async () => {
    const { result } = renderHook(() => useActionEditorController(), { wrapper });

    await waitFor(() => expect(result.current.form.getValues("title")).toBe("Original action"));

    const nextStart = new Date("2026-08-02T00:00:00.000Z");
    const nextEnd = new Date("2026-09-01T00:00:00.000Z");
    await act(async () => {
      await result.current.submit({
        title: "Updated action",
        startTime: nextStart,
        endTime: nextEnd,
      });
    });

    expect(mocks.updateTitle).toHaveBeenCalledWith("42", "Updated action");
    expect(mocks.updateStartTime).toHaveBeenCalledWith("42", nextStart.getTime() / 1000);
    expect(mocks.updateEndTime).toHaveBeenCalledWith("42", nextEnd.getTime() / 1000);
    expect(mocks.updateInstructions).not.toHaveBeenCalled();
    expect(mocks.toastSuccess).toHaveBeenCalledOnce();
    expect(mocks.clearDraft).toHaveBeenCalledWith("/actions/action-42/edit");
    expect(mocks.navigate).toHaveBeenCalledWith("/actions/action-42");
  });

  it("surfaces an operation failure without clearing or navigating", async () => {
    const failure = new Error("update failed");
    mocks.updateTitle.mockRejectedValue(failure);
    const { result } = renderHook(() => useActionEditorController(), { wrapper });

    await waitFor(() => expect(result.current.form.getValues("title")).toBe("Original action"));
    await act(async () => {
      await result.current.submit({
        title: "Updated action",
        startTime: originalStart,
        endTime: originalEnd,
      });
    });

    expect(mocks.loggerError).toHaveBeenCalledWith("Failed to update action", { error: failure });
    expect(mocks.toastError).toHaveBeenCalledOnce();
    expect(mocks.toastSuccess).not.toHaveBeenCalled();
    expect(mocks.clearDraft).not.toHaveBeenCalled();
    expect(mocks.navigate).not.toHaveBeenCalled();
  });
  it("retains the draft when an operation resolves with a failed result", async () => {
    mocks.updateTitle.mockResolvedValue({
      success: false,
      error: { message: "Simulation failed" },
    });
    const { result } = renderHook(() => useActionEditorController(), { wrapper });
    await waitFor(() => expect(result.current.form.getValues("title")).toBe("Original action"));
    await act(async () => {
      await result.current.submit({
        title: "Updated action",
        startTime: originalStart,
        endTime: originalEnd,
      });
    });
    expect(mocks.toastError).toHaveBeenCalledOnce();
    expect(mocks.toastSuccess).not.toHaveBeenCalled();
    expect(mocks.clearDraft).not.toHaveBeenCalled();
    expect(mocks.navigate).not.toHaveBeenCalled();
  });
  it.each([
    false,
    true,
  ])("consumes a confirmed edit without discarding remaining fields: %s", async (remaining) => {
    mocks.pendingEdits = [["pending", {}]];
    mocks.reconcileEdits.mockResolvedValue({
      confirmed: [
        {
          key: "11155111:owner:updateActionTitle:42",
          fingerprint: JSON.stringify(["42", "Updated action"]),
        },
      ],
      unresolved: false,
      reverted: false,
    });
    const view = renderHook(() => useActionEditorController(), { wrapper });
    await waitFor(() =>
      expect(view.result.current.form.getValues("title")).toBe("Original action")
    );
    const data = {
      title: "Updated action",
      startTime: remaining ? new Date(originalStart.getTime() + 3600000) : originalStart,
      endTime: originalEnd,
    };
    act(() => view.result.current.form.reset(data));
    await act(() => view.result.current.checkConfirmation());
    expect(mocks.clearCompletedEdits).toHaveBeenCalled();
    expect(mocks.updateTitle).not.toHaveBeenCalled();
    if (remaining) {
      expect(mocks.navigate).not.toHaveBeenCalled();
      expect(mocks.clearDraft).not.toHaveBeenCalled();
      mocks.pendingEdits = [];
      view.rerender();
      await act(() => view.result.current.submit(data));
      expect(mocks.updateTitle).not.toHaveBeenCalled();
      expect(mocks.updateStartTime).toHaveBeenCalledOnce();
    }
    expect(mocks.navigate).toHaveBeenCalledWith("/actions/action-42");
    expect(mocks.clearDraft).toHaveBeenCalledOnce();
  });

  it("retains same-save completion across a remount but expires it when the draft is consumed", async () => {
    let saved: Record<string, unknown> | null = null;
    mocks.setDraft.mockImplementation((_path, value) => {
      saved = value;
    });
    mocks.restoreDraft.mockImplementation(() => (saved ? { formState: saved } : null));
    mocks.clearDraft.mockImplementation(() => {
      saved = null;
    });
    mocks.updateStartTime.mockResolvedValueOnce({ success: false, confirmation: "pending" });
    const data = {
      title: "Updated action",
      startTime: new Date(originalStart.getTime() + 3600000),
      endTime: originalEnd,
    };
    const first = renderHook(() => useActionEditorController(), { wrapper });
    await waitFor(() =>
      expect(first.result.current.form.getValues("title")).toBe("Original action")
    );
    act(() => first.result.current.form.reset(data));
    await act(() => first.result.current.submit(data));
    expect(mocks.updateTitle).toHaveBeenCalledOnce();
    first.unmount();
    mocks.pendingEdits = [["pending", {}]];
    mocks.reconcileEdits.mockResolvedValueOnce({
      confirmed: [
        {
          key: "11155111:owner:updateActionStartTime:42",
          fingerprint: JSON.stringify(["42", String(data.startTime.getTime() / 1000)]),
        },
      ],
      unresolved: false,
      reverted: false,
    });
    const restored = renderHook(() => useActionEditorController(), { wrapper });
    await waitFor(() => expect(restored.result.current.form.getValues("title")).toBe(data.title));
    await act(() => restored.result.current.checkConfirmation());
    expect(mocks.updateTitle).toHaveBeenCalledOnce();
    expect(mocks.updateStartTime).toHaveBeenCalledOnce();
    expect(mocks.navigate).toHaveBeenCalledWith("/actions/action-42");
    expect(saved).toBeNull();
    restored.unmount();
    mocks.pendingEdits = [];
    const fresh = renderHook(() => useActionEditorController(), { wrapper });
    await waitFor(() =>
      expect(fresh.result.current.form.getValues("title")).toBe("Original action")
    );
    await act(() => fresh.result.current.submit(data));
    expect(mocks.updateTitle).toHaveBeenCalledTimes(2);
  });

  it("does not let a late confirmation navigate or clear a replacement screen", async () => {
    let finish!: (value: {
      confirmed: { key: string; fingerprint: string }[];
      unresolved: boolean;
      reverted: boolean;
    }) => void;
    mocks.pendingEdits = [["pending", {}]];
    mocks.reconcileEdits.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      })
    );
    const view = renderHook(() => useActionEditorController(), { wrapper });
    await waitFor(() =>
      expect(view.result.current.form.getValues("title")).toBe("Original action")
    );
    let checking!: Promise<void>;
    act(() => {
      checking = view.result.current.checkConfirmation();
    });
    view.unmount();
    await act(async () => {
      finish({ confirmed: [], unresolved: false, reverted: false });
      await checking;
    });
    expect(mocks.navigate).not.toHaveBeenCalled();
    expect(mocks.clearDraft).not.toHaveBeenCalled();
  });

  const UPDATED = {
    title: "Updated action",
    startTime: new Date("2026-10-01T00:00:00.000Z"),
    endTime: new Date("2026-10-31T00:00:00.000Z"),
  };
  const UPDATED_CHANGES = [
    { field: "title", value: UPDATED.title },
    { field: "startTime", value: UPDATED.startTime.getTime() / 1000 },
    { field: "endTime", value: UPDATED.endTime.getTime() / 1000 },
  ];
  const WRITES = [mocks.updateTitle, mocks.updateStartTime, mocks.updateEndTime];

  async function renderEditor() {
    const view = renderHook(() => useActionEditorController(), { wrapper });
    await waitFor(() =>
      expect(view.result.current.form.getValues("title")).toBe("Original action")
    );
    return view;
  }

  it("uploads the instructions before anything is written, so a failed upload sends nothing", async () => {
    mocks.uploadFile.mockRejectedValueOnce(new Error("upload failed"));
    const view = await renderEditor();
    act(() => view.result.current.setIsEditingInstructions(true));

    await act(() => view.result.current.submit(UPDATED));

    for (const write of WRITES) expect(write).not.toHaveBeenCalled();
    expect(mocks.toastError).toHaveBeenCalledOnce();
    expect(mocks.navigate).not.toHaveBeenCalled();
  });

  it("sends every change as one group where a batch can go", async () => {
    batch.available = true;
    mocks.uploadFile.mockResolvedValueOnce({ cid: "bafy-new" });
    batch.send.mockResolvedValueOnce({ status: "saved", transactionHash: "0xab" });
    const view = await renderEditor();
    act(() => view.result.current.setIsEditingInstructions(true));

    await act(() => view.result.current.submit(UPDATED));

    expect(batch.send).toHaveBeenCalledOnce();
    expect(batch.send).toHaveBeenCalledWith([
      ...UPDATED_CHANGES,
      { field: "instructions", value: "bafy-new" },
    ]);
    for (const write of [...WRITES, mocks.updateInstructions]) expect(write).not.toHaveBeenCalled();
    expect(mocks.navigate).toHaveBeenCalledWith("/actions/action-42");
    expect(mocks.clearDraft).toHaveBeenCalledWith("/actions/action-42/edit");
  });

  it("never sends a held save again: after a reload, the read that proves it finishes the edit", async () => {
    let saved: Record<string, unknown> | null = null;
    mocks.setDraft.mockImplementation((_path, value) => {
      saved = value;
    });
    mocks.restoreDraft.mockImplementation(() => (saved ? { formState: saved } : null));
    mocks.clearDraft.mockImplementation(() => {
      saved = null;
    });
    batch.available = true;
    batch.send.mockResolvedValueOnce({ status: "unknown" });
    const first = await renderEditor();
    act(() => first.result.current.form.reset(UPDATED));
    await act(() => first.result.current.submit(UPDATED));
    expect(mocks.navigate).not.toHaveBeenCalled();
    expect(mocks.toastError).not.toHaveBeenCalled();

    // The page reloads while the save is still held, so Save waits.
    first.unmount();
    batch.hold = { operationIds: ["held"], fields: ["title"], attempted: [], onChain: [] };
    const restored = renderHook(() => useActionEditorController(), { wrapper });
    await waitFor(() =>
      expect(restored.result.current.form.getValues("title")).toBe(UPDATED.title)
    );
    await act(() => restored.result.current.submit(UPDATED));

    // Checking again finds that it landed.
    Object.assign(batch, { hold: null, saved: UPDATED_CHANGES, lastReadAt: 1 });
    restored.rerender();

    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith("/actions/action-42"));
    expect(batch.send).toHaveBeenCalledOnce();
    for (const write of WRITES) expect(write).not.toHaveBeenCalled();
    expect(saved).toBeNull();
  });

  it.each([
    ["a plain wallet", false],
    ["an edit past its batch ceilings", true],
  ])("sends %s one write at a time, in the order the registry accepts", async (_case, available) => {
    batch.available = available;
    batch.send.mockResolvedValueOnce({ status: "not-batchable" });
    batch.order.mockImplementation(async (changes: unknown[]) => [...changes].reverse());
    const view = await renderEditor();

    await act(() => view.result.current.submit(UPDATED));

    expect(batch.order).toHaveBeenCalledWith(UPDATED_CHANGES);
    const sentAt = (write: (typeof WRITES)[number]) => write.mock.invocationCallOrder[0];
    expect(sentAt(mocks.updateEndTime)).toBeLessThan(sentAt(mocks.updateStartTime));
    expect(sentAt(mocks.updateStartTime)).toBeLessThan(sentAt(mocks.updateTitle));
    expect(mocks.navigate).toHaveBeenCalledWith("/actions/action-42");
  });
});
