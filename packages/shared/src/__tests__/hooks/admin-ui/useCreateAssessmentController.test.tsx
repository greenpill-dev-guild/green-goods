/**
 * @vitest-environment jsdom
 */

import React from "react";
import { act, renderHook } from "@testing-library/react";
import { IntlProvider } from "react-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useCreateAssessmentController } from "../../../hooks/admin-ui/hub/useCreateAssessmentController";
import { useCreateAssessmentStore } from "../../../stores/useCreateAssessmentStore";
import { Domain } from "../../../types/domain";

const GARDEN_ID = "0x1111111111111111111111111111111111111111";
// The garden documents Agroforestry only (bit 1), unless a test unsets it.
const domainsState = vi.hoisted(() => ({ data: 2 as number | undefined }));
const mockStartCreation = vi.fn((_payload: unknown) => true);
const mockSubmitCreation = vi.fn();
const mockToastError = vi.fn();
const mockShowValidationOnStep = vi.fn();

vi.mock("react-router-dom", async () => ({
  ...(await vi.importActual<typeof import("react-router-dom")>("react-router-dom")),
  useNavigate: () => vi.fn(),
}));

vi.mock("wagmi", () => ({
  useAccount: () => ({ address: "0x2222222222222222222222222222222222222222" }),
}));

vi.mock("../../../components/Toast/toast.service", () => ({
  toastService: {
    error: (...args: unknown[]) => mockToastError(...args),
    info: vi.fn(),
    success: vi.fn(),
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

vi.mock("../../../hooks/assessment/useCreateAssessmentWorkflow", () => ({
  useCreateAssessmentWorkflow: () => ({
    state: { matches: () => false, context: { error: null } },
    startCreation: (payload: unknown) => mockStartCreation(payload),
    submitCreation: () => mockSubmitCreation(),
    retry: vi.fn(),
    reset: vi.fn(),
    canRetry: false,
    draft: {
      loadDraft: async () => null,
      saveDraft: async () => true,
      clearDraft: async () => undefined,
      draftKey: "assessment-draft",
    },
  }),
}));

function renderController() {
  return renderHook(() => useCreateAssessmentController(), {
    wrapper: ({ children }: { children: React.ReactNode }) => (
      <IntlProvider locale="en" messages={{}} onError={() => {}}>
        {children}
      </IntlProvider>
    ),
  });
}

describe("useCreateAssessmentController submit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    domainsState.data = 1 << Domain.AGRO;
    useCreateAssessmentStore.getState().reset();
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
});
