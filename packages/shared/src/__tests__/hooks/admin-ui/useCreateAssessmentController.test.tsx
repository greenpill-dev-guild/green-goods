/**
 * @vitest-environment happy-dom
 */

import { act, render, waitFor } from "@testing-library/react";
import { IntlProvider } from "react-intl";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useCreateAssessmentController } from "../../../hooks/admin-ui/hub/useCreateAssessmentController";
import { useDirtyClose } from "../../../hooks/admin-ui/useDirtyClose";
import { useCreateAssessmentStore } from "../../../stores/useCreateAssessmentStore";
import { Domain } from "../../../types/domain";

const GARDEN_ID = "0x1111111111111111111111111111111111111111";
const CREATE_PATH = "/hub/assess/create";
// The garden documents Agroforestry only (bit 1), unless a test unsets it.
const domainsState = vi.hoisted(() => ({
  data: 2 as number | undefined,
  primaryAddress: "0x2222222222222222222222222222222222222222" as string | undefined,
  walletAddress: "0x2222222222222222222222222222222222222222" as string | undefined,
}));
const mockStartCreation = vi.fn((_payload: unknown) => true);
const mockSubmitCreation = vi.fn();
const mockResetWorkflow = vi.fn();
const mockSaveDraft = vi.fn(async (_payload: unknown) => true);
const mockToastError = vi.fn();
const mockToastSuccess = vi.fn();
const mockShowValidationOnStep = vi.fn();

// The send as the workflow machine reports it. A test moves it on by hand; the
// machine and the attestation have their own tests.
const workflow = vi.hoisted(() => {
  const listeners = new Set<() => void>();
  let snapshot = { value: "idle", error: undefined as string | undefined };
  return {
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    snapshot: () => snapshot,
    set(value: string, error?: string) {
      snapshot = { value, error };
      listeners.forEach((listener) => listener());
    },
  };
});

vi.mock("wagmi", () => ({
  useAccount: () => ({ address: domainsState.walletAddress }),
}));

vi.mock("../../../hooks/auth/usePrimaryAddress", () => ({
  usePrimaryAddress: () => domainsState.primaryAddress,
}));

vi.mock("../../../components/Toast/toast.service", () => ({
  toastService: {
    error: (...args: unknown[]) => mockToastError(...args),
    info: vi.fn(),
    success: (...args: unknown[]) => mockToastSuccess(...args),
  },
}));

vi.mock("../../../hooks/garden/useAdminGardenContext", () => ({
  useAdminGardenContext: () => ({ activeGarden: { id: GARDEN_ID }, activeGardenId: GARDEN_ID }),
}));

vi.mock("../../../hooks/blockchain/useBaseLists", () => ({
  useGardens: () => ({ data: [] }),
}));

vi.mock("../../../hooks/garden/useGardenDomains", () => ({
  useGardenDomains: () => ({ data: domainsState.data }),
}));

vi.mock("../../../hooks/garden/useGardenPermissions", () => ({
  useGardenPermissions: () => ({ canReviewGarden: () => true }),
}));

// Every field is filled; only the domain is in question.
vi.mock("../../../hooks/ui/useFormWizardStepValidation", () => ({
  useFormWizardStepValidation: () => ({
    validateAll: async () => true,
    showValidationOnStep: (stepIndex: number) => mockShowValidationOnStep(stepIndex),
    handleBack: vi.fn(),
    handleNext: vi.fn(),
    showValidation: true,
  }),
}));

vi.mock("../../../hooks/assessment/useCreateAssessmentWorkflow", async () => {
  const { useSyncExternalStore } = await import("react");
  return {
    useCreateAssessmentWorkflow: () => {
      const { value, error } = useSyncExternalStore(
        workflow.subscribe,
        workflow.snapshot,
        workflow.snapshot
      );
      return {
        state: { matches: (state: string) => state === value, context: { error } },
        startCreation: (payload: unknown) => mockStartCreation(payload),
        submitCreation: () => mockSubmitCreation(),
        retry: vi.fn(),
        reset: () => {
          mockResetWorkflow();
          workflow.set("idle");
        },
        canRetry: false,
        isPending: value === "pending" || value === "reconciling",
        isCheckingConfirmation: value === "reconciling",
        checkConfirmation: vi.fn(),
        draft: {
          loadDraft: async () => null,
          saveDraft: (payload: unknown) => mockSaveDraft(payload),
          clearDraft: async () => undefined,
          draftKey: "assessment-draft",
        },
      };
    },
  };
});

type Controller = ReturnType<typeof useCreateAssessmentController>;
type CloseGuard = ReturnType<typeof useDirtyClose>;

/**
 * The controller where the admin mounts it: on its own route, behind the close
 * guard the Create Assessment dialog wires to it.
 */
function renderController() {
  const result = { current: undefined as unknown as Controller };
  const guard = { current: undefined as unknown as CloseGuard };
  function Flow() {
    const controller = useCreateAssessmentController();
    result.current = controller;
    guard.current = useDirtyClose({
      isDirty: controller.isDirty,
      onClose: controller.handleClose,
      blockRouteChange: true,
      preventRouteChange: controller.isSubmitting,
      onDiscard: controller.handleDiscard,
    });
    return null;
  }
  const router = createMemoryRouter(
    [
      { path: CREATE_PATH, element: <Flow /> },
      { path: "*", element: null },
    ],
    { initialEntries: [`${CREATE_PATH}?gardenId=${GARDEN_ID}`] }
  );
  render(
    <IntlProvider locale="en" messages={{}} onError={() => {}}>
      <RouterProvider router={router} />
    </IntlProvider>
  );
  return { result, guard, router };
}

const REVIEW_STEP = 3;

/** A complete assessment, left on the Review step. */
function fillAssessment() {
  const { goToStep, setField, updateSmartOutcome } = useCreateAssessmentStore.getState();
  // The domain goes first: choosing one clears the picks made under another.
  setField("domain", Domain.AGRO);
  setField("title", "Canopy baseline");
  setField("description", "Canopy cover across the east plot.");
  setField("location", "East plot");
  setField("diagnosis", "The canopy is thinning.");
  updateSmartOutcome(0, "description", "The east plot regains its canopy");
  updateSmartOutcome(0, "metric", "treesPlanted");
  updateSmartOutcome(0, "target", 200);
  setField("reportingPeriodStart", "2026-07-01");
  setField("reportingPeriodEnd", "2026-09-30");
  goToStep(REVIEW_STEP);
}

describe("useCreateAssessmentController submit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    domainsState.primaryAddress = "0x2222222222222222222222222222222222222222";
    domainsState.walletAddress = domainsState.primaryAddress;
    domainsState.data = 1 << Domain.AGRO;
    workflow.set("idle");
    useCreateAssessmentStore.getState().reset();
  });

  it("submits an authorized primary/passkey account without a Wagmi wallet", async () => {
    domainsState.primaryAddress = "0x7777777777777777777777777777777777777777";
    domainsState.walletAddress = undefined;
    fillAssessment();
    const { result } = renderController();
    await act(async () => {
      await result.current.handleSubmit();
    });
    expect(mockStartCreation).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Canopy baseline" })
    );
    expect(mockSubmitCreation).toHaveBeenCalled();
    expect(mockToastError).not.toHaveBeenCalled();
  });

  it("sends a restored domain the garden does not document back to the domain step", async () => {
    // A draft reopens on its last step, so the domain step never shows it.
    const { goToStep, setField } = useCreateAssessmentStore.getState();
    setField("domain", Domain.SOLAR);
    setField("selectedActionUIDs", ["solar-action"]);
    goToStep(2);
    const { result } = renderController();

    await act(async () => {
      await result.current.handleSubmit();
    });

    expect(mockStartCreation).not.toHaveBeenCalled();
    const { currentStep, form } = useCreateAssessmentStore.getState();
    expect(form.domain).toBeNull();
    expect(form.selectedActionUIDs).toEqual([]);
    expect(currentStep).toBe(0);
    // The domain step shows "Choose a domain" once the steward lands on it.
    expect(mockShowValidationOnStep).toHaveBeenCalledWith(0);
    expect(mockToastError).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Incomplete form" })
    );
  });

  it("sends a domain that no longer exists back to the domain step, even before the garden's domains load", async () => {
    // A draft saved before a domain was retired reopens on its last step,
    // where schema validation alone would only say the form is incomplete.
    domainsState.data = undefined;
    const { goToStep, setField } = useCreateAssessmentStore.getState();
    setField("domain", 99 as Domain);
    goToStep(2);
    const { result } = renderController();

    await act(async () => {
      await result.current.handleSubmit();
    });

    expect(mockStartCreation).not.toHaveBeenCalled();
    const { currentStep, form } = useCreateAssessmentStore.getState();
    expect(form.domain).toBeNull();
    expect(currentStep).toBe(0);
    expect(mockShowValidationOnStep).toHaveBeenCalledWith(0);
    expect(mockToastError).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Incomplete form" })
    );
  });

  it("waits for the garden's domains before submitting", async () => {
    // The domains are still loading, or their read failed.
    domainsState.data = undefined;
    useCreateAssessmentStore.getState().setField("domain", Domain.AGRO);
    const { result } = renderController();

    await act(async () => {
      await result.current.handleSubmit();
    });

    expect(mockStartCreation).not.toHaveBeenCalled();
    expect(useCreateAssessmentStore.getState().form.domain).toBe(Domain.AGRO);
    expect(mockToastError).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Couldn't check the domain" })
    );
  });

  it("submits a domain the garden documents", async () => {
    useCreateAssessmentStore.getState().setField("domain", Domain.AGRO);
    const { result } = renderController();

    await act(async () => {
      await result.current.handleSubmit();
    });

    expect(mockStartCreation).toHaveBeenCalledWith(
      expect.objectContaining({ assessmentType: `domain-${Domain.AGRO}` })
    );
    expect(mockSubmitCreation).toHaveBeenCalled();
  });

  it("says so when the send refuses the answers, and asks the wallet nothing", async () => {
    fillAssessment();
    mockStartCreation.mockReturnValueOnce(false);
    const { result } = renderController();

    await act(async () => {
      await result.current.handleSubmit();
    });

    expect(mockToastError).toHaveBeenCalledWith(
      expect.objectContaining({ title: "We could not submit the assessment" })
    );
    expect(mockSubmitCreation).not.toHaveBeenCalled();
  });

  it("ends on a Review step, after the three that collect answers", () => {
    const { result } = renderController();

    expect(result.current.stepConfigs.map((step) => step.id)).toEqual([
      "domainContext",
      "strategy",
      "actionsHarvest",
      "review",
    ]);
    // The store walks as far as the controller lists.
    act(() => useCreateAssessmentStore.getState().goToStep(REVIEW_STEP));
    expect(result.current.currentStep).toBe(REVIEW_STEP);
  });

  it("keeps an indeterminate assessment on Review and refuses the normal submit/reset path", async () => {
    fillAssessment();
    const { result } = renderController();
    act(() => workflow.set("pending"));
    expect(result.current.isPending).toBe(true);
    expect(result.current.isSubmitting).toBe(false);
    expect(result.current.isDirty).toBe(false);
    expect(result.current.currentStep).toBe(REVIEW_STEP);
    expect(result.current.hasError).toBe(false);
    await act(() => result.current.handleSubmit());
    expect(mockResetWorkflow).not.toHaveBeenCalled();
    expect(mockStartCreation).not.toHaveBeenCalled();
    expect(mockSubmitCreation).not.toHaveBeenCalled();
  });

  it("allows pending assessments to leave without discarding or submitting again", async () => {
    fillAssessment();
    const { result, guard, router } = renderController();
    act(() => workflow.set("pending"));
    await act(async () => {
      await result.current.handleSubmit();
      await router.navigate("/hub/work");
    });
    expect(router.state.location.pathname).toBe("/hub/work");
    expect(guard.current.confirmOpen).toBe(false);
    expect(mockSubmitCreation).not.toHaveBeenCalled();
    expect(mockResetWorkflow).not.toHaveBeenCalled();
  });

  it("keeps a successful send on the Review, with its answers, and never asks to discard", async () => {
    fillAssessment();
    const { result, guard, router } = renderController();

    await act(async () => {
      await result.current.handleSubmit();
    });
    act(() => workflow.set("submitting"));
    expect(result.current.isSubmitting).toBe(true);
    await act(async () => {
      workflow.set("success");
      await Promise.resolve();
    });

    // Nothing left the route, so the close guard had nothing to stop.
    expect(guard.current.confirmOpen).toBe(false);
    expect(router.state.location.pathname).toBe(CREATE_PATH);
    // The status row says it; no toast repeats it.
    expect(mockToastSuccess).not.toHaveBeenCalled();
    expect(result.current.isSent).toBe(true);
    expect(result.current.isDirty).toBe(false);
    // The sent draft leaves the store, so a reload cannot send it twice, and
    // the Review still shows what went out.
    expect(useCreateAssessmentStore.getState().form.title).toBe("");
    expect(result.current.currentStep).toBe(REVIEW_STEP);
    expect(result.current.reviewForm.title).toBe("Canopy baseline");
    // The emptied store is not an edit: no blank draft is saved behind the done state.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 650));
    });
    expect(mockSaveDraft).not.toHaveBeenCalled();

    act(() => result.current.handleClose());
    await waitFor(() => expect(router.state.location.pathname).toBe("/hub/assess"));
    expect(guard.current.confirmOpen).toBe(false);
  });

  it("stays on the Review after a failed send, and retries with the answers as they stand", async () => {
    fillAssessment();
    const { result, guard } = renderController();

    await act(async () => {
      await result.current.handleSubmit();
    });
    await act(async () => {
      workflow.set("error", "User rejected the request");
      await Promise.resolve();
    });

    expect(result.current.hasError).toBe(true);
    expect(result.current.isSent).toBe(false);
    expect(result.current.currentStep).toBe(REVIEW_STEP);
    expect(guard.current.confirmOpen).toBe(false);
    // The answers are still the steward's to lose, so closing still asks.
    expect(result.current.isDirty).toBe(true);

    act(() => useCreateAssessmentStore.getState().setField("title", "Canopy baseline, corrected"));
    mockStartCreation.mockClear();
    await act(async () => {
      await result.current.handleSubmit();
    });

    // The failed attempt is cleared first: the machine would re-send its old answers.
    expect(mockResetWorkflow.mock.invocationCallOrder[0]).toBeLessThan(
      mockStartCreation.mock.invocationCallOrder[0]
    );
    expect(mockStartCreation).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Canopy baseline, corrected" })
    );
  });

  it("starts an empty assessment for Create Another", async () => {
    fillAssessment();
    const { result } = renderController();
    await act(async () => {
      await result.current.handleSubmit();
    });
    await act(async () => {
      workflow.set("success");
      await Promise.resolve();
    });

    act(() => result.current.handleCreateAnother());

    expect(mockResetWorkflow).toHaveBeenCalled();
    expect(result.current.isSent).toBe(false);
    expect(result.current.currentStep).toBe(0);
    expect(result.current.reviewForm.title).toBe("");
    expect(result.current.isDirty).toBe(false);
  });
});
