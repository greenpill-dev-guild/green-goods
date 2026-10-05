/**
 * @vitest-environment happy-dom
 */

import React from "react";
import { act, renderHook } from "@testing-library/react";
import { IntlProvider } from "react-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createActionDefaultValues } from "../../../hooks/admin-ui/actions/createAction.utils";
import { useCreateActionController } from "../../../hooks/admin-ui/actions/useCreateActionController";

const mockNavigate = vi.fn();
const mockRegisterAction = vi.fn();
const mockUploadFileToIPFS = vi.fn();
const mockTrackStarted = vi.fn();
const mockTrackSuccess = vi.fn();
const mockTrackFailed = vi.fn();
const mockToastLoading = vi.fn();
const mockToastDismiss = vi.fn();
const mockToastError = vi.fn();
const mockLoggerError = vi.fn();
const mockSetFormState = vi.fn();
const mockClearViewState = vi.fn();
const mockRestoreViewState = vi.fn(() => null);

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useLocation: () => ({ pathname: "/actions/create", search: "" }),
    useNavigate: () => mockNavigate,
  };
});

vi.mock("../../../utils/navigation/admin-routes", () => ({
  adminRoutes: {
    actions: () => "/actions",
  },
}));

vi.mock("../../../utils/action/translations", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../utils/action/translations")>()),
  buildActionInstructionsV2: vi.fn(() => ({ version: 2, fields: [] })),
}));

vi.mock("../../../types/domain", () => ({
  Domain: { SOLAR: 0, AGRO: 1, EDU: 2, WASTE: 3 },
}));

vi.mock("../../../hooks/admin-ui/actions/actions.utils", () => ({
  getActionsListSearch: vi.fn(() => ({})),
}));

vi.mock("../../../utils/blockchain/contracts", () => ({
  getNetworkContracts: vi.fn(() => ({
    gardenToken: "0x1111111111111111111111111111111111111111",
  })),
}));

vi.mock("../../../modules/app/logger", () => ({
  logger: { error: (...args: unknown[]) => mockLoggerError(...args) },
}));

vi.mock("../../../utils/errors/contract-errors", () => ({
  // Minimal double: the controller only forwards `.name` as the parsed family.
  parseContractError: (error: unknown) => ({
    name: (error as { name?: string } | null)?.name ?? "Unknown",
  }),
}));

vi.mock("../../../components/Toast/toast.service", () => ({
  toastService: {
    loading: (...args: unknown[]) => mockToastLoading(...args),
    dismiss: (...args: unknown[]) => mockToastDismiss(...args),
    error: (...args: unknown[]) => mockToastError(...args),
  },
}));

vi.mock("../../../modules/app/analytics-events", () => ({
  trackAdminActionCreateFailed: (...args: unknown[]) => mockTrackFailed(...args),
  trackAdminActionCreateStarted: (...args: unknown[]) => mockTrackStarted(...args),
  trackAdminActionCreateSuccess: (...args: unknown[]) => mockTrackSuccess(...args),
}));

vi.mock("../../../modules/data/ipfs/upload", () => ({
  uploadFileToIPFS: (...args: unknown[]) => mockUploadFileToIPFS(...args),
}));

vi.mock("../../../hooks/action/useActionOperations", () => ({
  useActionOperations: () => ({
    registerAction: (...args: unknown[]) => mockRegisterAction(...args),
    isLoading: false,
  }),
}));

vi.mock("../../../hooks/ui/useFormWizardStepValidation", () => ({
  useFormWizardStepValidation: ({
    onBack,
    onValidNext,
  }: {
    onBack?: () => void;
    onValidNext: () => void;
  }) => ({
    handleBack: () => onBack?.(),
    handleNext: () => onValidNext(),
  }),
}));

vi.mock("../../../stores/useSheetOrchestratorStore", () => ({
  useSheetOrchestratorStore: Object.assign(
    (selector: (state: Record<string, unknown>) => unknown) =>
      selector({
        setFormState: mockSetFormState,
        clearViewState: mockClearViewState,
      }),
    {
      getState: () => ({
        restoreViewState: mockRestoreViewState,
      }),
    }
  ),
}));

vi.mock("@hookform/resolvers/zod", () => ({
  zodResolver: () => async (values: unknown) => ({ values, errors: {} }),
}));

vi.mock("../../../hooks/admin-ui/actions/createAction.utils", async () => {
  const actual = await vi.importActual<
    typeof import("../../../hooks/admin-ui/actions/createAction.utils")
  >("../../../hooks/admin-ui/actions/createAction.utils");
  return {
    ...actual,
    CREATE_ACTION_DEFAULT_CHAIN_ID: 42161,
    createActionResolver: async (values: unknown) => ({ values, errors: {} }),
  };
});

function wrapper({ children }: { children: React.ReactNode }) {
  return React.createElement(IntlProvider, { locale: "en", messages: {} }, children);
}

function createFormData() {
  return {
    ...createActionDefaultValues(),
    title: "Repair Event",
    slug: " Repair.Event ",
    domain: 2 as const,
    startTime: new Date("2026-06-02T00:00:00.000Z"),
    endTime: new Date("2026-06-09T00:00:00.000Z"),
  };
}

describe("useCreateActionController telemetry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUploadFileToIPFS.mockResolvedValue({ cid: "bafy-instructions" });
    mockRegisterAction.mockResolvedValue({ success: true, hash: "0xabc" });
  });

  it("emits started and success analytics around action registration", async () => {
    const { result } = renderHook(() => useCreateActionController(), { wrapper });

    await act(async () => {
      await result.current.onSubmit(createFormData());
    });

    const expectedBase = {
      gardenAddress: "0x1111111111111111111111111111111111111111",
      chainId: 42161,
      actionTitle: "Repair Event",
      actionSlug: "repair.event",
      actionDomain: 2,
    };

    expect(mockTrackStarted).toHaveBeenCalledWith(expectedBase);
    expect(mockRegisterAction).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Repair Event", slug: "repair.event", domain: 2 })
    );
    expect(mockTrackSuccess).toHaveBeenCalledWith({ ...expectedBase, txHash: "0xabc" });
    expect(mockTrackFailed).not.toHaveBeenCalled();
  });

  it("emits failed analytics when action registration returns an unsuccessful result", async () => {
    mockRegisterAction.mockResolvedValue({
      success: false,
      error: { name: "SimulationFailed", message: "Simulation failed" },
    });
    const { result } = renderHook(() => useCreateActionController(), { wrapper });

    await act(async () => {
      await result.current.onSubmit(createFormData());
    });

    expect(mockTrackStarted).toHaveBeenCalledOnce();
    // Telemetry carries the parsed error family, never the raw message.
    expect(mockTrackFailed).toHaveBeenCalledWith({
      gardenAddress: "0x1111111111111111111111111111111111111111",
      chainId: 42161,
      actionTitle: "Repair Event",
      actionSlug: "repair.event",
      actionDomain: 2,
      error: "SimulationFailed",
      parsedErrorFamily: "SimulationFailed",
    });
    expect(mockTrackSuccess).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("emits failed analytics with parsed error family when registerAction throws", async () => {
    const thrownError = new Error("Network timeout");
    thrownError.name = "NetworkTimeout";
    mockRegisterAction.mockRejectedValue(thrownError);
    const { result } = renderHook(() => useCreateActionController(), { wrapper });

    await act(async () => {
      await result.current.onSubmit(createFormData());
    });

    expect(mockTrackStarted).toHaveBeenCalledOnce();
    // Catch-block path mirrors the result-failure path: parsed family only.
    expect(mockTrackFailed).toHaveBeenCalledWith({
      gardenAddress: "0x1111111111111111111111111111111111111111",
      chainId: 42161,
      actionTitle: "Repair Event",
      actionSlug: "repair.event",
      actionDomain: 2,
      error: "NetworkTimeout",
      parsedErrorFamily: "NetworkTimeout",
    });
    expect(mockTrackSuccess).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});

describe("useCreateActionController ending (DL-080)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUploadFileToIPFS.mockResolvedValue({ cid: "bafy-instructions" });
    mockRegisterAction.mockResolvedValue({ success: true, hash: "0xabc" });
  });

  async function onReviewWithEdits() {
    const hook = renderHook(() => useCreateActionController(), { wrapper });
    act(() => {
      hook.result.current.form.setValue("title", "Repair Event", { shouldDirty: true });
    });
    for (let step = 0; step < 3; step += 1) {
      act(() => {
        hook.result.current.handleNext();
      });
    }
    expect(hook.result.current.currentStep).toBe(3);
    expect(hook.result.current.isDirty).toBe(true);
    return hook;
  }

  it("keeps a successful send on the Review, reads as clean, and never navigates", async () => {
    const { result } = await onReviewWithEdits();

    await act(async () => {
      await result.current.onSubmit(createFormData());
    });

    expect(result.current.isSent).toBe(true);
    expect(result.current.currentStep).toBe(3);
    // Clean, so the close guard has nothing to confirm and Done or close leave at once.
    expect(result.current.isDirty).toBe(false);
    expect(mockNavigate).not.toHaveBeenCalled();
    // The draft goes with the send, so a reload cannot register it twice.
    expect(mockClearViewState).toHaveBeenCalledWith("/actions/create");
    expect(result.current.form.getValues("title")).toBe("Repair Event");

    act(() => result.current.handleCancel());
    expect(mockNavigate).toHaveBeenCalledWith("/actions");
  });

  it("does not send a second time once the action is registered", async () => {
    const { result } = await onReviewWithEdits();

    await act(async () => {
      await result.current.onSubmit(createFormData());
    });
    await act(async () => {
      await result.current.onSubmit(createFormData());
    });

    expect(mockRegisterAction).toHaveBeenCalledOnce();
  });

  it("stays on the Review with the error after a failed send, and Try Again sends again", async () => {
    mockRegisterAction.mockResolvedValueOnce({
      success: false,
      error: { name: "UserRejected", message: "User rejected the request." },
    });
    const { result } = await onReviewWithEdits();

    await act(async () => {
      await result.current.onSubmit(createFormData());
    });

    expect(result.current.hasError).toBe(true);
    expect(result.current.isSent).toBe(false);
    expect(result.current.isSending).toBe(false);
    expect(result.current.currentStep).toBe(3);
    expect(result.current.isDirty).toBe(true);
    expect(result.current.errorMessage).not.toBe("");
    // The status row carries the failure; no toast repeats it.
    expect(mockToastError).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();

    await act(async () => {
      await result.current.onSubmit(createFormData());
    });

    expect(mockRegisterAction).toHaveBeenCalledTimes(2);
    expect(result.current.hasError).toBe(false);
    expect(result.current.isSent).toBe(true);
  });

  it("starts another action from empty answers on the first step", async () => {
    const { result } = await onReviewWithEdits();
    await act(async () => {
      await result.current.onSubmit(createFormData());
    });

    act(() => result.current.handleCreateAnother());

    expect(result.current.isSent).toBe(false);
    expect(result.current.currentStep).toBe(0);
    expect(result.current.form.getValues("title")).toBe("");
  });
});
