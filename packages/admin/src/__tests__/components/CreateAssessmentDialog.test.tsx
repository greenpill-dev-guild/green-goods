// jsdom pin (happy-dom A/B): asserts the authored inline z-index calc(var(--z-modal) + 1); happy-dom's computed style substitutes the undefined custom property with nothing.
/**
 * @vitest-environment jsdom
 */

import { normalizeAddress } from "@green-goods/shared/utils/blockchain/address";
import { QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { del as idbDel, get as idbGet } from "idb-keyval";
import type { ComponentProps } from "react";
import { IntlProvider } from "react-intl";
import { RouterProvider, createMemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_CHAIN_ID } from "@green-goods/shared/config/default-chain";
import { queryKeys } from "@green-goods/shared/config/query-keys/registry";
import { AuthContext, AuthStateContext } from "@green-goods/shared/providers/Auth";
import { useAdminStore } from "@green-goods/shared/stores/useAdminStore";
import {
  type CreateAssessmentFormState,
  useCreateAssessmentStore,
} from "@green-goods/shared/stores/useCreateAssessmentStore";
import { CynefinPhase, Domain, type Garden } from "@green-goods/shared/types/domain";
import { createTestQueryClient } from "@green-goods/shared/__tests__/test-utils/query-client";
import CreateAssessment from "@/views/Hub/CreateAssessment";

const createAssessmentControllerOverride = vi.hoisted(() => ({
  current: null as null | (() => unknown),
}));

type Controller = ReturnType<
  typeof import("@green-goods/shared/hooks/admin-ui/hub/useCreateAssessmentController").useCreateAssessmentController
>;

const OPERATOR = "0x9999999999999999999999999999999999999999";
const accountState = vi.hoisted(() => ({
  address: "0x9999999999999999999999999999999999999999" as string | undefined,
}));
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
  useAccount: () => ({
    address: accountState.address,
    isConnected: Boolean(accountState.address),
    isConnecting: false,
  }),
  useReadContract: () => ({ data: 1 }),
  useConfig: () => ({}),
  useWriteContract: () => ({ writeContractAsync: vi.fn() }),
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
  resolveSmartAccountClient: null,
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

// A complete assessment for the garden above, which documents Solar only.
const ANSWERS: CreateAssessmentFormState = {
  title: "Rooftop array baseline",
  description: "Output of the hub rooftop array before the new panels.",
  location: "Hub rooftop",
  diagnosis: "The hub runs on diesel four hours a day.",
  smartOutcomes: [
    { description: "The hub runs on its own power", metric: "panelsInstalled", target: 12 },
  ],
  cynefinPhase: CynefinPhase.CLEAR,
  domain: Domain.SOLAR,
  selectedActionUIDs: [],
  sdgTargets: [],
  reportingPeriodStart: "2026-07-01",
  reportingPeriodEnd: "2026-09-30",
  attachments: [],
};

const STEPS = [
  { id: "domainContext", title: "Domain & Context" },
  { id: "strategy", title: "Challenge & Goals" },
  { id: "actionsHarvest", title: "Actions & Reporting Period" },
  { id: "review", title: "Review" },
];

/** The controller at one moment of a send, on the Review unless a test says otherwise. */
function controllerAt(overrides: Partial<Controller> = {}): Controller {
  return {
    canReview: true,
    currentStep: STEPS.length - 1,
    goToStep: vi.fn(),
    errorMessage: "",
    errorTitle: "",
    garden: SELECTED_GARDEN,
    handleBack: vi.fn(),
    handleClose: vi.fn(),
    handleCreateAnother: vi.fn(),
    handleDiscard: vi.fn(),
    handleNext: vi.fn(),
    handleSubmit: vi.fn(),
    hasError: false,
    isDirty: false,
    isSent: false,
    isSubmitting: false,
    normalizedGardenDomainMask: 1,
    reviewForm: ANSWERS,
    showValidation: false,
    stepConfigs: STEPS,
    txErrorView: {
      kind: "unknown",
      severity: "error",
      titleKey: "",
      messageKey: "",
      rawMessage: "",
    } as Controller["txErrorView"],
    ...overrides,
  };
}

function renderCreateAssessment(authOverrides: Partial<AuthContextValue> = {}) {
  const auth = { ...authContextValue, ...authOverrides };
  const queryClient = createTestQueryClient();
  queryClient.setQueryData(queryKeys.gardens.byChain(DEFAULT_CHAIN_ID), [SELECTED_GARDEN]);
  queryClient.setQueryData(queryKeys.actions.byChain(DEFAULT_CHAIN_ID), []);
  queryClient.setQueryData(
    queryKeys.role.stewardGardens(normalizeAddress(OPERATOR), DEFAULT_CHAIN_ID),
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
        <AuthStateContext.Provider value={auth}>
          <AuthContext.Provider value={auth}>
            <RouterProvider router={router} />
          </AuthContext.Provider>
        </AuthStateContext.Provider>
      </IntlProvider>
    </QueryClientProvider>
  );

  return router;
}

// Every test in this file renders the same garden/operator pair, so they all
// share one persisted draft key. Any test that dirties the form arms a 600ms
// debounced write to it, which can land during a later test and make a
// "pristine" form look dirty. Clear it on both sides of each test.
const DRAFT_KEY = `assessment_draft_${SELECTED_GARDEN.id}_${OPERATOR}`;

describe("CreateAssessment dialog", () => {
  beforeEach(async () => {
    accountState.address = OPERATOR;
    await idbDel(DRAFT_KEY);
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

  it("offers the assessment form to an authorized passkey account without a Wagmi wallet", async () => {
    accountState.address = undefined;
    renderCreateAssessment({
      authMode: "passkey",
      smartAccountAddress: OPERATOR,
      walletAddress: null,
      eoaAddress: undefined,
    });
    expect(await screen.findByRole("heading", { name: "Domain & Context" })).toBeInTheDocument();
    expect(screen.getAllByRole("textbox").length).toBeGreaterThan(0);
    expect(screen.queryByText(/requires signing in with a wallet account/)).not.toBeInTheDocument();
  });

  afterEach(async () => {
    vi.useRealTimers();
    createAssessmentControllerOverride.current = null;
    useCreateAssessmentStore.getState().reset();
    useAdminStore.setState({ selectedGarden: null, lastGardenIdsByScope: {} });
    cleanup();
    // After cleanup, so a debounce that fires during unmount cannot re-persist.
    await idbDel(DRAFT_KEY);
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

    // DatePicker includes the visible label and help text in the trigger's
    // accessible name, so select it by the field label rather than placeholder.
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

    expect(await idbGet(DRAFT_KEY)).toMatchObject({ title: "Should not survive discard" });

    const dialog = screen.getByRole("dialog", { name: "Create Assessment" });
    fireEvent.keyDown(dialog, { key: "Escape" });

    const discardButton = await screen.findByRole("button", { name: "Discard" });
    await act(async () => {
      fireEvent.click(discardButton);
      await Promise.resolve();
    });

    expect(await idbGet(DRAFT_KEY)).toBeUndefined();
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
    const handleClose = vi.fn();
    createAssessmentControllerOverride.current = () =>
      controllerAt({ garden: undefined, isSubmitting: true, handleClose });

    await act(async () => {
      renderCreateAssessment();
      await Promise.resolve();
    });

    const dialog = await screen.findByRole("dialog", { name: "Create Assessment" });
    expect(screen.getByLabelText(/close/i)).toBeDisabled();

    fireEvent.keyDown(dialog, { key: "Escape" });

    expect(handleClose).not.toHaveBeenCalled();
  });

  it("blocks route navigation while assessment submission is pending", async () => {
    createAssessmentControllerOverride.current = () =>
      controllerAt({ garden: undefined, isSubmitting: true });
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

    const dialog = await screen.findByRole("dialog", { name: "Create Assessment" });
    await act(async () => {
      fireEvent.keyDown(dialog, { key: "Escape" });
      await Promise.resolve();
    });

    // Pristine form: Escape must not raise the discard confirm — it exits
    // directly to the Hub workbench the flow was launched from (controller
    // handleClose → adminRoutes.hub → the default /hub/work stage).
    await waitFor(() => {
      expect(router?.state.location.pathname).toBe("/hub/work");
      expect(screen.queryByRole("dialog", { name: "Create Assessment" })).not.toBeInTheDocument();
    });
    expect(screen.queryByRole("button", { name: "Discard" })).not.toBeInTheDocument();
  });

  it("shows the Review, with the answers, before anything is sent", async () => {
    useCreateAssessmentStore.setState({ form: ANSWERS, currentStep: 2 });
    await act(async () => {
      renderCreateAssessment();
      await Promise.resolve();
    });

    fireEvent.click(await screen.findByRole("button", { name: "Next" }));

    expect(await screen.findByRole("heading", { name: "Review" })).toBeInTheDocument();
    const review = within(screen.getByTestId("assessment-review"));
    expect(review.getByText("Rooftop array baseline")).toBeInTheDocument();
    expect(review.getByText("Solar")).toBeInTheDocument();
    expect(review.getByText("The hub runs on its own power")).toBeInTheDocument();
    // The period reads as the attestation will carry it, whatever zone the steward is in.
    expect(review.getByText(/Jul 1.*Sep 30, 2026/)).toBeInTheDocument();
    // Nothing has been sent: the row says what the primary will do, and the primary waits.
    expect(review.getByText("Records this assessment on-chain")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Submit Assessment" })).toBeEnabled();
  });

  it("ends a sent assessment on the Review with Done, and closes without asking", async () => {
    const controller = controllerAt({ isSent: true });
    createAssessmentControllerOverride.current = () => controller;
    await act(async () => {
      renderCreateAssessment();
      await Promise.resolve();
    });

    // The Review stays up, says the send landed, and keeps what went out on screen.
    const review = within(await screen.findByTestId("assessment-review"));
    expect(review.getByText("Assessment submitted")).toBeInTheDocument();
    expect(review.getByText("Rooftop array baseline")).toBeInTheDocument();
    for (const edit of review.getAllByRole("button", { name: /^Edit / })) {
      expect(edit).toBeDisabled();
    }
    expect(screen.queryByRole("button", { name: "Submit Assessment" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Back" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Create Another" }));
    expect(controller.handleCreateAnother).toHaveBeenCalledTimes(1);

    // Done and the dialog's own close both leave at once: nothing is left to discard.
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    fireEvent.keyDown(screen.getByRole("dialog", { name: "Create Assessment" }), {
      key: "Escape",
    });
    expect(controller.handleClose).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("button", { name: "Discard" })).not.toBeInTheDocument();
  });

  it("keeps a failed send on the Review, names the cause, and offers Try Again", async () => {
    const controller = controllerAt({
      hasError: true,
      isDirty: true,
      errorTitle: "Transaction cancelled",
      errorMessage: "Transaction was cancelled. Please try again when ready.",
      txErrorView: { ...controllerAt().txErrorView, kind: "cancelled", severity: "warning" },
    });
    createAssessmentControllerOverride.current = () => controller;
    await act(async () => {
      renderCreateAssessment();
      await Promise.resolve();
    });

    const review = within(await screen.findByTestId("assessment-review"));
    expect(review.getByText("Transaction cancelled")).toBeInTheDocument();
    expect(
      review.getByText("Transaction was cancelled. Please try again when ready.")
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Done" })).not.toBeInTheDocument();

    // The answers are still the steward's: a section reopens, and the same act sends again.
    fireEvent.click(review.getByRole("button", { name: "Edit Domain & Context" }));
    expect(controller.goToStep).toHaveBeenCalledWith(0);
    fireEvent.click(screen.getByRole("button", { name: "Try Again" }));
    expect(controller.handleSubmit).toHaveBeenCalledTimes(1);
  });
});
