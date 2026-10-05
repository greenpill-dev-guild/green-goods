/**
 * @vitest-environment happy-dom
 *
 * Submit Work flow-dialog close contract (parity with CreateAssessmentDialog):
 * a pristine dialog closes straight back to the Hub with no discard prompt.
 * The old wrapper raised the Discard confirm unconditionally on every
 * Esc/X/scrim close — this is the regression test for the fixed behavior.
 */

import { QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { IntlProvider } from "react-intl";
import { type ComponentProps, useSyncExternalStore } from "react";
import { RouterProvider, createMemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_CHAIN_ID } from "@green-goods/shared/config/default-chain";
import { queryKeys } from "@green-goods/shared/config/query-keys/registry";
import { AuthContext } from "@green-goods/shared/providers/Auth";
import { useAdminStore } from "@green-goods/shared/stores/useAdminStore";
import { type Action, Domain, type Garden } from "@green-goods/shared/types/domain";
import { createTestQueryClient } from "@green-goods/shared/__tests__/test-utils/query-client";
import SubmitWork from "@/views/Garden/SubmitWork";

const OPERATOR = "0x9999999999999999999999999999999999999999";
type AuthContextValue = NonNullable<ComponentProps<typeof AuthContext.Provider>["value"]>;

const workMutationOverride = vi.hoisted(() => ({
  current: null as null | ((options: unknown) => unknown),
}));

// A work send the test settles by hand: the real one needs a wallet and a chain.
const workSend = vi.hoisted(() => {
  type Callbacks = {
    onSuccess?: (txHash: string) => void;
    onError?: (error: unknown) => void;
    onSettled?: () => void;
  };
  const idle = {
    isPending: false,
    isSuccess: false,
    isError: false,
    data: undefined as string | undefined,
    error: null as unknown,
  };
  const listeners = new Set<() => void>();
  let state = idle;
  let callbacks: Callbacks = {};
  const set = (next: typeof idle) => {
    state = next;
    listeners.forEach((listener) => listener());
  };
  return {
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    snapshot: () => state,
    listen(next: Callbacks) {
      callbacks = next;
    },
    mutate: () => set({ ...idle, isPending: true }),
    reset: () => set(idle),
    // The callbacks run before the send reads as settled, as the real mutation runs them.
    succeed(txHash: string) {
      callbacks.onSuccess?.(txHash);
      callbacks.onSettled?.();
      set({ ...idle, isSuccess: true, data: txHash });
    },
    fail(error: unknown) {
      callbacks.onError?.(error);
      callbacks.onSettled?.();
      set({ ...idle, isError: true, error });
    },
  };
});

const dataHookOverride = vi.hoisted(() => {
  const listeners = new Set<() => void>();
  const state = {
    gardens: null as unknown,
    actions: null as unknown,
  };
  const emit = () => {
    listeners.forEach((listener) => listener());
  };

  return {
    state,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    setGardens(value: unknown) {
      state.gardens = value;
      emit();
    },
    setActions(value: unknown) {
      state.actions = value;
      emit();
    },
    reset() {
      state.gardens = null;
      state.actions = null;
      emit();
    },
  };
});

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

const WORK_ACTION: Action = {
  id: `${DEFAULT_CHAIN_ID}-7`,
  slug: "mulch-bed",
  startTime: 0,
  endTime: 4_102_444_800,
  title: "Mulch bed",
  instructions: "",
  capitals: [],
  media: [],
  domain: Domain.SOLAR,
  createdAt: 1,
  description: "Log mulching work",
  inputs: [
    {
      key: "notes",
      title: "Impact note",
      placeholder: "What changed?",
      type: "text",
      required: false,
      options: [],
    },
  ],
  mediaInfo: {
    title: "Photos",
    required: false,
    minImageCount: 0,
    maxImageCount: 4,
  },
  details: {
    title: "Details",
    description: "Add work details",
    feedbackPlaceholder: "Notes",
  },
  review: {
    title: "Review",
    description: "Review work",
  },
};

vi.mock("wagmi", () => ({
  useAccount: () => ({ address: OPERATOR, isConnected: true, isConnecting: false }),
  useReadContract: () => ({ data: 1 }),
  useWriteContract: () => ({ writeContractAsync: vi.fn(), isPending: false }),
  useConfig: () => ({}),
  useSwitchChain: () => ({ switchChainAsync: vi.fn() }),
  usePublicClient: () => undefined,
}));

// SubmitWorkPanel resolves its auth snapshot through the auth state machine
// (useAuthState/useUser), which needs the full AuthProvider tree — stub just
// those two reads; everything else stays real.
vi.mock("@green-goods/shared/hooks/auth/useUser", () => ({
  useUser: () => ({ primaryAddress: OPERATOR }),
}));

vi.mock("@green-goods/shared/hooks/blockchain/useBaseLists", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@green-goods/shared/hooks/blockchain/useBaseLists")>();
  const React = await import("react");
  const useOverrideSnapshot = (key: "gardens" | "actions") =>
    React.useSyncExternalStore(
      dataHookOverride.subscribe,
      () => dataHookOverride.state[key],
      () => dataHookOverride.state[key]
    );
  return {
    ...actual,
    useGardens: ((...args) => {
      const override = useOverrideSnapshot("gardens");
      return override ? override : actual.useGardens(...args);
    }) as typeof actual.useGardens,
    useActions: ((...args) => {
      const override = useOverrideSnapshot("actions");
      return override ? override : actual.useActions(...args);
    }) as typeof actual.useActions,
  };
});

vi.mock("@green-goods/shared/hooks/work/useWorkMutation", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@green-goods/shared/hooks/work/useWorkMutation")>();
  return {
    ...actual,
    useWorkMutation: ((options) =>
      workMutationOverride.current
        ? workMutationOverride.current(options)
        : actual.useWorkMutation(options)) as typeof actual.useWorkMutation,
  };
});

vi.mock("@green-goods/shared/providers/Auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@green-goods/shared/providers/Auth")>();
  return {
    ...actual,
    useAuthState: () => ({ isAuthenticated: true, authMode: "wallet" }),
  };
});

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

function renderSubmitWork(actions: Action[] = []) {
  const queryClient = createTestQueryClient();
  queryClient.setQueryData(queryKeys.gardens.byChain(DEFAULT_CHAIN_ID), [SELECTED_GARDEN]);
  queryClient.setQueryData(queryKeys.actions.byChain(DEFAULT_CHAIN_ID), actions);
  queryClient.setQueryData(
    queryKeys.role.stewardGardens(OPERATOR.toLowerCase(), DEFAULT_CHAIN_ID),
    [{ id: SELECTED_GARDEN.id, name: SELECTED_GARDEN.name }]
  );
  queryClient.setQueryData(
    queryKeys.role.deploymentPermissions(OPERATOR.toLowerCase(), DEFAULT_CHAIN_ID),
    { isOwner: false, isInAllowlist: false, canDeploy: false }
  );
  const router = createMemoryRouter(
    [
      { path: "/hub/work/submit", element: <SubmitWork /> },
      { path: "/hub/*", element: <div /> },
    ],
    { initialEntries: [`/hub/work/submit?gardenId=${SELECTED_GARDEN.id}`] }
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

function renderSubmitWorkTree() {
  const queryClient = createTestQueryClient();
  queryClient.setQueryData(queryKeys.gardens.byChain(DEFAULT_CHAIN_ID), [SELECTED_GARDEN]);
  queryClient.setQueryData(
    queryKeys.role.stewardGardens(OPERATOR.toLowerCase(), DEFAULT_CHAIN_ID),
    [{ id: SELECTED_GARDEN.id, name: SELECTED_GARDEN.name }]
  );
  queryClient.setQueryData(
    queryKeys.role.deploymentPermissions(OPERATOR.toLowerCase(), DEFAULT_CHAIN_ID),
    { isOwner: false, isInAllowlist: false, canDeploy: false }
  );
  const router = createMemoryRouter(
    [
      { path: "/hub/work/submit", element: <SubmitWork /> },
      { path: "/hub/*", element: <div /> },
    ],
    { initialEntries: [`/hub/work/submit?gardenId=${SELECTED_GARDEN.id}`] }
  );

  const tree = (
    <QueryClientProvider client={queryClient}>
      <IntlProvider locale="en" messages={{}} onError={() => {}}>
        <AuthContext.Provider value={authContextValue}>
          <RouterProvider router={router} />
        </AuthContext.Provider>
      </IntlProvider>
    </QueryClientProvider>
  );
  const renderResult = render(tree);

  return { renderResult, router };
}

/** The work mutation as the flow reads it, settled from the test through `workSend`. */
function useHandSettledSend(options: unknown) {
  workSend.listen(options as Parameters<typeof workSend.listen>[0]);
  const state = useSyncExternalStore(workSend.subscribe, workSend.snapshot, workSend.snapshot);
  return { ...state, mutate: workSend.mutate, reset: workSend.reset };
}

// The one eligible action opens on Media with optional photos; a typed note makes the flow dirty.
async function walkToReview(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole("button", { name: "Next" }));
  await user.type(await screen.findByLabelText("Impact note"), "Mulched the west bed");
  await user.click(screen.getByRole("button", { name: "Next" }));
  return screen.findByRole("button", { name: "app.admin.work.submit.submit" });
}

describe("SubmitWork dialog", () => {
  beforeEach(() => {
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
    workMutationOverride.current = null;
    workSend.reset();
    dataHookOverride.reset();
    useAdminStore.setState({ selectedGarden: null, lastGardenIdsByScope: {} });
    cleanup();
  });

  it("closes straight back to the Hub when nothing was entered (no discard prompt)", async () => {
    let router: ReturnType<typeof renderSubmitWork> | undefined;
    await act(async () => {
      router = renderSubmitWork();
      await Promise.resolve();
    });

    const dialog = await screen.findByRole("dialog", { name: "app.admin.work.submit.title" });
    await act(async () => {
      fireEvent.keyDown(dialog, { key: "Escape" });
      await Promise.resolve();
    });

    // Pristine flow: Escape must exit directly (the old wrapper raised the
    // Discard confirm even for an untouched dialog).
    expect(screen.queryByRole("button", { name: "Discard" })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("dialog", { name: "app.admin.work.submit.title" })
    ).not.toBeInTheDocument();
    expect(router?.state.location.pathname).toBe("/hub/work");
  });

  it("blocks route navigation while entered work details are dirty", async () => {
    const user = userEvent.setup();
    let router: ReturnType<typeof renderSubmitWork> | undefined;
    await act(async () => {
      router = renderSubmitWork([WORK_ACTION]);
      await Promise.resolve();
    });

    await user.click(await screen.findByRole("button", { name: "Next" }));
    const noteInput = await screen.findByLabelText("Impact note");
    await user.type(noteInput, "Mulched the west bed");

    await act(async () => {
      void router?.navigate("/hub/work");
      await Promise.resolve();
    });

    expect(await screen.findByRole("button", { name: "Discard" })).toBeInTheDocument();
    await waitFor(() => {
      expect(router?.state.location.pathname).toBe("/hub/work/submit");
    });
  });

  it("continues to the originally requested route after dirty route discard", async () => {
    const user = userEvent.setup();
    let router: ReturnType<typeof renderSubmitWork> | undefined;
    await act(async () => {
      router = renderSubmitWork([WORK_ACTION]);
      await Promise.resolve();
    });

    await user.click(await screen.findByRole("button", { name: "Next" }));
    const noteInput = await screen.findByLabelText("Impact note");
    await user.type(noteInput, "Mulched the west bed");

    await act(async () => {
      void router?.navigate("/hub/certify?gardenId=0x2222222222222222222222222222222222222222");
      await Promise.resolve();
    });

    const discardButton = await screen.findByRole("button", { name: "Discard" });

    await act(async () => {
      fireEvent.click(discardButton);
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(router?.state.location.pathname).toBe("/hub/certify");
      expect(router?.state.location.search).toBe(
        "?gardenId=0x2222222222222222222222222222222222222222"
      );
    });
  });

  it("ends a successful send on the Review with Done, and never asks to discard", async () => {
    workMutationOverride.current = useHandSettledSend;
    const user = userEvent.setup();
    let router: ReturnType<typeof renderSubmitWork> | undefined;
    await act(async () => {
      router = renderSubmitWork([WORK_ACTION]);
      await Promise.resolve();
    });

    await user.click(await walkToReview(user));
    await act(async () => {
      workSend.succeed(`0x${"ab".repeat(32)}`);
      await Promise.resolve();
    });

    // The send landed: the Review stays where it is and offers the way out.
    expect(await screen.findByRole("button", { name: "Done" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Discard" })).not.toBeInTheDocument();
    expect(router?.state.location.pathname).toBe("/hub/work/submit");

    await user.click(screen.getByRole("button", { name: "Done" }));
    await waitFor(() => {
      expect(router?.state.location.pathname).toBe("/hub/work");
    });
    expect(screen.queryByRole("button", { name: "Discard" })).not.toBeInTheDocument();
  });

  it("stays on the Review after a failed send, still guards the answers, and tries again", async () => {
    workMutationOverride.current = useHandSettledSend;
    const user = userEvent.setup();
    let router: ReturnType<typeof renderSubmitWork> | undefined;
    await act(async () => {
      router = renderSubmitWork([WORK_ACTION]);
      await Promise.resolve();
    });

    await user.click(await walkToReview(user));
    await act(async () => {
      workSend.fail(new Error("User rejected the request"));
      await Promise.resolve();
    });

    // The Review says what happened and offers the same send again, not Done.
    expect(await screen.findByText("Work wasn't submitted")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Done" })).not.toBeInTheDocument();
    expect(router?.state.location.pathname).toBe("/hub/work/submit");

    // Nothing was sent, so the typed note is still the steward's to lose.
    const dialog = screen.getByRole("dialog", { name: "app.admin.work.submit.title" });
    fireEvent.keyDown(dialog, { key: "Escape" });
    const keepEditing = await screen.findByRole("button", { name: "Keep Editing" });
    await act(async () => {
      fireEvent.click(keepEditing);
      await Promise.resolve();
    });

    await user.click(screen.getByRole("button", { name: "Try Again" }));
    expect(workSend.snapshot().isPending).toBe(true);
  });

  it("starts an empty submission for Submit Another", async () => {
    workMutationOverride.current = useHandSettledSend;
    const user = userEvent.setup();
    await act(async () => {
      renderSubmitWork([WORK_ACTION]);
      await Promise.resolve();
    });

    await user.click(await walkToReview(user));
    await act(async () => {
      workSend.succeed(`0x${"ab".repeat(32)}`);
      await Promise.resolve();
    });
    await user.click(await screen.findByRole("button", { name: "Submit Another" }));

    // Back at the start (the one action opens on Media), with nothing carried over.
    await user.click(await screen.findByRole("button", { name: "Next" }));
    expect(await screen.findByLabelText("Impact note")).toHaveValue("");
    expect(screen.queryByRole("button", { name: "Done" })).not.toBeInTheDocument();
  });

  it("keeps hook order stable when submit-work data resolves after the loading branch", async () => {
    dataHookOverride.setGardens({ data: [], isLoading: true });
    dataHookOverride.setActions({ data: [], isLoading: true });
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    await act(async () => {
      renderSubmitWorkTree();
      await Promise.resolve();
    });

    expect(await screen.findByRole("status")).toBeInTheDocument();

    await act(async () => {
      dataHookOverride.setGardens({ data: [SELECTED_GARDEN], isLoading: false });
      dataHookOverride.setActions({ data: [WORK_ACTION], isLoading: false });
      await Promise.resolve();
    });

    expect(
      await screen.findByRole("dialog", { name: "app.admin.work.submit.title" })
    ).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Next" })).toBeInTheDocument();
    const hookOrderError = consoleError.mock.calls.some((call) =>
      call.some(
        (arg) =>
          typeof arg === "string" &&
          arg.includes("Rendered more hooks than during the previous render")
      )
    );
    expect(hookOrderError).toBe(false);

    consoleError.mockRestore();
  });

  it("keeps the flow mounted while work submission is pending", async () => {
    workMutationOverride.current = () => ({
      error: null,
      isPending: true,
      mutate: vi.fn(),
      reset: vi.fn(),
    });
    let router: ReturnType<typeof renderSubmitWork> | undefined;
    await act(async () => {
      router = renderSubmitWork();
      await Promise.resolve();
    });

    const dialog = await screen.findByRole("dialog", { name: "app.admin.work.submit.title" });
    await waitFor(() => {
      expect(screen.getByLabelText(/close/i)).toBeDisabled();
    });

    fireEvent.keyDown(dialog, { key: "Escape" });

    expect(router?.state.location.pathname).toBe("/hub/work/submit");
    expect(screen.getByRole("dialog", { name: "app.admin.work.submit.title" })).toBeInTheDocument();
  });

  it("blocks route navigation while work submission is pending", async () => {
    workMutationOverride.current = () => ({
      error: null,
      isPending: true,
      mutate: vi.fn(),
      reset: vi.fn(),
    });
    let router: ReturnType<typeof renderSubmitWork> | undefined;
    await act(async () => {
      router = renderSubmitWork();
      await Promise.resolve();
    });

    await act(async () => {
      void router?.navigate("/hub/work");
      await Promise.resolve();
    });

    expect(router?.state.location.pathname).toBe("/hub/work/submit");
    expect(router?.state.location.search).toBe(`?gardenId=${SELECTED_GARDEN.id}`);
  });
});
