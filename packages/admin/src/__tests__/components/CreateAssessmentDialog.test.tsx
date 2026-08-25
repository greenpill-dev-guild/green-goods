/**
 * @vitest-environment jsdom
 */

import { QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { get as idbGet } from "idb-keyval";
import type { ComponentProps } from "react";
import { IntlProvider } from "react-intl";
import { RouterProvider, createMemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_CHAIN_ID } from "@green-goods/shared/config/default-chain";
import { queryKeys } from "@green-goods/shared/config/query-keys/registry";
import { AuthContext } from "@green-goods/shared/providers/Auth";
import { useAdminStore } from "@green-goods/shared/stores/useAdminStore";
import { useCreateAssessmentStore } from "@green-goods/shared/stores/useCreateAssessmentStore";
import type { Garden } from "@green-goods/shared/types/domain";
import { createTestQueryClient } from "@green-goods/shared/__tests__/test-utils/query-client";
import CreateAssessment from "@/views/Hub/CreateAssessment";

const createAssessmentControllerOverride = vi.hoisted(() => ({
  current: null as null | (() => unknown),
}));

const OPERATOR = "0x9999999999999999999999999999999999999999";
type AuthContextValue = NonNullable<ComponentProps<typeof AuthContext.Provider>["value"]>;

const SELECTED_GARDEN: Garden = {
  id: "0x1111111111111111111111111111111111111111",
  chainId: DEFAULT_CHAIN_ID,
  tokenAddress: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  tokenID: 1n,
  name: "Role-Proven Garden",
  description: "",
  location: "",
  bannerImage: "",
  gardeners: [],
  stewards: [OPERATOR],
  owners: [],
  evaluators: [],
  funders: [],
  communities: [],
  openJoining: false,
  domainMask: 1,
  assessments: [],
  works: [],
  createdAt: 1,
};

vi.mock("wagmi", () => ({
  useAccount: () => ({ address: OPERATOR, isConnected: true, isConnecting: false }),
  useReadContract: () => ({ data: 1 }),
  useWalletClient: () => ({ data: undefined }),
}));

vi.mock(
  "@green-goods/shared/hooks/admin-ui/hub/useCreateAssessmentController",
  async (importOriginal) => {
    const actual =
      await importOriginal<
        typeof import("@green-goods/shared/hooks/admin-ui/hub/useCreateAssessmentController")
      >();
    return {
      ...actual,
      useCreateAssessmentController: (() =>
        createAssessmentControllerOverride.current
          ? createAssessmentControllerOverride.current()
          : actual.useCreateAssessmentController()) as typeof actual.useCreateAssessmentController,
    };
  }
);

const authContextValue: AuthContextValue = {
  authMode: "wallet",
  isReady: true,
  isAuthenticated: true,
  isAuthenticating: false,
  error: null,
  credential: null,
  smartAccountAddress: null,
  smartAccountClient: null,
  userName: null,
  hasStoredCredential: false,
  walletAddress: OPERATOR,
  eoaAddress: OPERATOR,
  embeddedAddress: null,
  externalWalletConnected: true,
  externalWalletAddress: OPERATOR,
  createAccount: vi.fn(),
  loginWithPasskey: vi.fn(),
  loginWithWallet: vi.fn(),
  loginWithEmbedded: vi.fn(),
  signOut: vi.fn(),
  switchToWallet: vi.fn(),
  switchToPasskey: vi.fn(),
  retry: vi.fn(),
  dismissError: vi.fn(),
  clearPasskey: vi.fn(),
  disconnectWallet: vi.fn(),
};

function renderCreateAssessment() {
  const queryClient = createTestQueryClient();
  queryClient.setQueryData(queryKeys.gardens.byChain(DEFAULT_CHAIN_ID), [SELECTED_GARDEN]);
  queryClient.setQueryData(queryKeys.actions.byChain(DEFAULT_CHAIN_ID), []);
  queryClient.setQueryData(
    queryKeys.role.stewardGardens(OPERATOR.toLowerCase(), DEFAULT_CHAIN_ID),
    [{ id: SELECTED_GARDEN.id, name: SELECTED_GARDEN.name }]
  );
  queryClient.setQueryData(
    queryKeys.role.deploymentPermissions(OPERATOR.toLowerCase(), DEFAULT_CHAIN_ID),
    {
      isOwner: false,
      isInAllowlist: false,
      canDeploy: false,
    }
  );
  const router = createMemoryRouter(
    [
      { path: "/hub/assess/create", element: <CreateAssessment /> },
      // Cancel/Discard navigates to the Hub the flow was launched from — a
      // bare fallback so that navigation resolves cleanly instead of logging
      // a React Router 404 in tests that exercise the close path.
      { path: "/hub/*", element: <div /> },
    ],
    {
      initialEntries: [`/hub/assess/create?gardenId=${SELECTED_GARDEN.id}`],
    }
  );

  render(
    <QueryClientProvider client={queryClient}>
      <IntlProvider locale="en" messages={{}} onError={() => {}}>
        <AuthContext.Provider value={authContextValue}>
          <RouterProvider router={router} />
        </AuthContext.Provider>
      </IntlProvider>
    </QueryClientProvider>
  );

  return router;
}

describe("CreateAssessment dialog", () => {
  beforeEach(() => {
    useCreateAssessmentStore.getState().reset();
    useAdminStore.setState({
      selectedChainId: DEFAULT_CHAIN_ID,
      selectedGarden: null,
      lastGardenIdsByScope: {},
    });
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: query === "(min-width: 600px)",
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    createAssessmentControllerOverride.current = null;
    useCreateAssessmentStore.getState().reset();
    useAdminStore.setState({ selectedGarden: null, lastGardenIdsByScope: {} });
    cleanup();
  });

  it("opens the assessment form from the route garden id without a Zustand selected garden", async () => {
    await act(async () => {
      renderCreateAssessment();
      await Promise.resolve();
    });

    expect(await screen.findByRole("heading", { name: "Domain & Context" })).toBeInTheDocument();
    expect(screen.getByText("Role-Proven Garden")).toBeInTheDocument();
    expect(screen.queryByText("app.garden.admin.notFound")).not.toBeInTheDocument();
  });

  it("keeps the reporting-period calendars interactive above the assessment dialog", async () => {
    // An empty DatePicker opens on the runtime's current month, so the fixed
    // July 2026 days below only exist with the clock pinned. Only Date is faked
    // — real timers keep findBy*/waitFor and the debounced draft save working.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-07-27T12:00:00Z"));

    useCreateAssessmentStore.setState({ currentStep: 2 });

    await act(async () => {
      renderCreateAssessment();
      await Promise.resolve();
    });

    // LabeledField wraps each DatePicker in a <label>, and a <button> is a
    // labelable element — so the trigger's accessible name is the whole field
    // (label + help text + display value), not just its placeholder.
    const startTrigger = await screen.findByRole("button", { name: /Reporting period start/ });
    fireEvent.click(startTrigger);

    const startDay = await screen.findByRole("button", { name: /Monday, July 27th, 2026/i });
    expect(startDay.closest('[data-component="DatePickerPopover"]')).toHaveStyle({
      zIndex: "calc(var(--z-modal) + 1)",
    });
    fireEvent.click(startDay);

    expect(useCreateAssessmentStore.getState().form.reportingPeriodStart).toBe("2026-07-27");
    expect(startTrigger).toHaveTextContent("Jul 27, 2026");
    expect(startTrigger).toHaveAttribute("aria-expanded", "false");

    const endTrigger = screen.getByRole("button", { name: /Reporting period end/ });
    fireEvent.click(endTrigger);

    const endDay = await screen.findByRole("button", { name: /Tuesday, July 28th, 2026/i });
    fireEvent.click(endDay);

    expect(useCreateAssessmentStore.getState().form.reportingPeriodEnd).toBe("2026-07-28");
    expect(endTrigger).toHaveTextContent("Jul 28, 2026");
    expect(endTrigger).toHaveAttribute("aria-expanded", "false");
  });

  it("clears the persisted draft and in-memory form when the steward confirms Discard", async () => {
    await act(async () => {
      renderCreateAssessment();
      await Promise.resolve();
    });

    const titleInput = await screen.findByLabelText(/^Title/);
    fireEvent.change(titleInput, { target: { value: "Should not survive discard" } });

    // Let the 600ms debounced auto-save actually persist the draft to IndexedDB
    // before discarding it — otherwise this test can't tell "never saved" apart
    // from "saved, then correctly cleared".
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 700));
    });

    const draftKey = `assessment_draft_${SELECTED_GARDEN.id}_${OPERATOR}`;
    expect(await idbGet(draftKey)).toMatchObject({ title: "Should not survive discard" });

    const dialog = screen.getByRole("dialog", { name: "Submit Assessment" });
    fireEvent.keyDown(dialog, { key: "Escape" });

    const discardButton = await screen.findByRole("button", { name: "Discard" });
    await act(async () => {
      fireEvent.click(discardButton);
      await Promise.resolve();
    });

    expect(await idbGet(draftKey)).toBeUndefined();
    expect(useCreateAssessmentStore.getState().form.title).toBe("");
  });

  it("blocks route context changes while the assessment draft is dirty", async () => {
    let router: ReturnType<typeof renderCreateAssessment> | undefined;
    await act(async () => {
      router = renderCreateAssessment();
      await Promise.resolve();
    });

    const titleInput = await screen.findByLabelText(/^Title/);
    fireEvent.change(titleInput, { target: { value: "Route-backed draft" } });

    await act(async () => {
      void router?.navigate(
        "/hub/assess/create?gardenId=0x2222222222222222222222222222222222222222"
      );
      await Promise.resolve();
    });

    expect(await screen.findByRole("button", { name: "Discard" })).toBeInTheDocument();
    await waitFor(() => {
      expect(router?.state.location.pathname).toBe("/hub/assess/create");
      expect(router?.state.location.search).toBe(`?gardenId=${SELECTED_GARDEN.id}`);
    });
  });

  it("does not fire the close path while assessment submission is pending", async () => {
    const handleCancel = vi.fn();
    createAssessmentControllerOverride.current = () => ({
      canRetry: false,
      canReview: false,
      currentStep: 0,
      goToStep: vi.fn(),
      errorMessage: "",
      errorTitle: "",
      garden: undefined,
      gardenRouteContext: {},
      hubContext: {},
      handleBack: vi.fn(),
      handleCancel,
      handleDiscard: vi.fn(),
      handleNext: vi.fn(),
      handleSubmit: vi.fn(),
      hasError: false,
      isDirty: false,
      isPristine: true,
      isSubmitting: true,
      normalizedGardenDomainMask: undefined,
      resetWorkflow: vi.fn(),
      retry: vi.fn(),
      showValidation: false,
      stepConfigs: [],
      txErrorView: { title: "", message: "", severity: "error" },
    });

    await act(async () => {
      renderCreateAssessment();
      await Promise.resolve();
    });

    const dialog = await screen.findByRole("dialog", { name: "Submit Assessment" });
    expect(screen.getByLabelText(/close/i)).toBeDisabled();

    fireEvent.keyDown(dialog, { key: "Escape" });

    expect(handleCancel).not.toHaveBeenCalled();
  });

  it("blocks route navigation while assessment submission is pending", async () => {
    createAssessmentControllerOverride.current = () => ({
      canRetry: false,
      canReview: false,
      currentStep: 0,
      goToStep: vi.fn(),
      errorMessage: "",
      errorTitle: "",
      garden: undefined,
      gardenRouteContext: {},
      hubContext: {},
      handleBack: vi.fn(),
      handleCancel: vi.fn(),
      handleDiscard: vi.fn(),
      handleNext: vi.fn(),
      handleSubmit: vi.fn(),
      hasError: false,
      isDirty: false,
      isPristine: true,
      isSubmitting: true,
      normalizedGardenDomainMask: undefined,
      resetWorkflow: vi.fn(),
      retry: vi.fn(),
      showValidation: false,
      stepConfigs: [],
      txErrorView: { title: "", message: "", severity: "error" },
    });
    let router: ReturnType<typeof renderCreateAssessment> | undefined;

    await act(async () => {
      router = renderCreateAssessment();
      await Promise.resolve();
    });

    await act(async () => {
      void router?.navigate("/hub/work");
      await Promise.resolve();
    });

    expect(router?.state.location.pathname).toBe("/hub/assess/create");
    expect(router?.state.location.search).toBe(`?gardenId=${SELECTED_GARDEN.id}`);
  });

  it("closes straight back to the Hub when the form is pristine (no discard prompt)", async () => {
    let router: ReturnType<typeof renderCreateAssessment> | undefined;
    await act(async () => {
      router = renderCreateAssessment();
      await Promise.resolve();
    });

    const dialog = await screen.findByRole("dialog", { name: "Submit Assessment" });
    await act(async () => {
      fireEvent.keyDown(dialog, { key: "Escape" });
      await Promise.resolve();
    });

    // Pristine form: Escape must not raise the discard confirm — it exits
    // directly to the Hub workbench the flow was launched from (controller
    // handleCancel → adminRoutes.hub → the default /hub/work stage).
    await waitFor(() => {
      expect(router?.state.location.pathname).toBe("/hub/work");
      expect(screen.queryByRole("dialog", { name: "Submit Assessment" })).not.toBeInTheDocument();
    });
    expect(screen.queryByRole("button", { name: "Discard" })).not.toBeInTheDocument();
  });
});
