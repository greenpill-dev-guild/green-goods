/**
 * @vitest-environment jsdom
 */

import { act, renderHook, waitFor } from "@testing-library/react";
import React from "react";
import { IntlProvider } from "react-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useActionEditorController } from "../../../hooks/admin-ui/actions/useActionEditorController";

const mocks = vi.hoisted(() => ({
  clearDraft: vi.fn(),
  getFileByHash: vi.fn(),
  loggerError: vi.fn(),
  navigate: vi.fn(),
  restoreDraft: vi.fn(() => null),
  setDraft: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
  updateEndTime: vi.fn(),
  updateInstructions: vi.fn(),
  updateStartTime: vi.fn(),
  updateTitle: vi.fn(),
  uploadFile: vi.fn(),
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
    updateActionEndTime: mocks.updateEndTime,
    updateActionInstructions: mocks.updateInstructions,
    updateActionStartTime: mocks.updateStartTime,
    updateActionTitle: mocks.updateTitle,
  }),
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
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.restoreDraft.mockReturnValue(null);
    mocks.updateEndTime.mockResolvedValue({ success: true });
    mocks.updateInstructions.mockResolvedValue({ success: true });
    mocks.updateStartTime.mockResolvedValue({ success: true });
    mocks.updateTitle.mockResolvedValue({ success: true });
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
});
