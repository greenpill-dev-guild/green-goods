/**
 * @vitest-environment jsdom
 */

import React from "react";
import { act, renderHook } from "@testing-library/react";
import { IntlProvider } from "react-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";
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

vi.mock("@green-goods/shared", () => ({
  adminRoutes: {
    actions: () => "/actions",
  },
  buildActionInstructionsV2: vi.fn(() => ({ version: 2, fields: [] })),
  Domain: { SOLAR: 0, AGRO: 1, EDU: 2, WASTE: 3 },
  getActionsListSearch: vi.fn(() => ({})),
  getNetworkContracts: vi.fn(() => ({
    gardenToken: "0x1111111111111111111111111111111111111111",
  })),
  logger: { error: (...args: unknown[]) => mockLoggerError(...args) },
  toastService: {
    loading: (...args: unknown[]) => mockToastLoading(...args),
    dismiss: (...args: unknown[]) => mockToastDismiss(...args),
    error: (...args: unknown[]) => mockToastError(...args),
  },
  trackAdminActionCreateFailed: (...args: unknown[]) => mockTrackFailed(...args),
  trackAdminActionCreateStarted: (...args: unknown[]) => mockTrackStarted(...args),
  trackAdminActionCreateSuccess: (...args: unknown[]) => mockTrackSuccess(...args),
  uploadFileToIPFS: (...args: unknown[]) => mockUploadFileToIPFS(...args),
  useActionOperations: () => ({
    registerAction: (...args: unknown[]) => mockRegisterAction(...args),
    isLoading: false,
  }),
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
    title: "Repair Event",
    slug: " Repair.Event ",
    domain: 2,
    startTime: new Date("2026-06-02T00:00:00.000Z"),
    endTime: new Date("2026-06-09T00:00:00.000Z"),
    capitals: [],
    media: [],
    instructionConfig: {
      title: "Work Submission",
      description: "",
      feedbackPlaceholder: "",
      inputs: [],
    },
    translations: {},
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
    expect(mockNavigate).toHaveBeenCalledWith("/actions");
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
    expect(mockTrackFailed).toHaveBeenCalledWith({
      gardenAddress: "0x1111111111111111111111111111111111111111",
      chainId: 42161,
      actionTitle: "Repair Event",
      actionSlug: "repair.event",
      actionDomain: 2,
      error: "Simulation failed",
    });
    expect(mockTrackSuccess).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
