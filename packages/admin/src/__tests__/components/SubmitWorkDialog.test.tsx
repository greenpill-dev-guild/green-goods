/**
 * @vitest-environment jsdom
 *
 * Submit Work flow-dialog close contract (parity with CreateAssessmentDialog):
 * a pristine dialog closes straight back to the Hub with no discard prompt.
 * The old wrapper raised the Discard confirm unconditionally on every
 * Esc/X/scrim close — this is the regression test for the fixed behavior.
 */

import { QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { IntlProvider } from "react-intl";
import { RouterProvider, createMemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AuthContext,
  DEFAULT_CHAIN_ID,
  queryKeys,
  useAdminStore,
  type AuthContextType,
  type Garden,
} from "@green-goods/shared";
import { createTestQueryClient } from "@green-goods/shared/testing";
import SubmitWork from "@/views/Garden/SubmitWork";

const OPERATOR = "0x9999999999999999999999999999999999999999";

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
  operators: [OPERATOR],
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
  useWriteContract: () => ({ writeContractAsync: vi.fn(), isPending: false }),
  useConfig: () => ({}),
  useSwitchChain: () => ({ switchChainAsync: vi.fn() }),
  usePublicClient: () => undefined,
}));

// SubmitWorkPanel resolves its auth snapshot through the auth state machine
// (useAuthState/useUser), which needs the full AuthProvider tree — stub just
// those two reads; everything else stays real.
vi.mock("@green-goods/shared", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@green-goods/shared")>();
  return {
    ...actual,
    useAuthState: () => ({ isAuthenticated: true, authMode: "wallet" }),
    useUser: () => ({ primaryAddress: OPERATOR }),
  };
});

const authContextValue: AuthContextType = {
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

function renderSubmitWork() {
  const queryClient = createTestQueryClient();
  queryClient.setQueryData(queryKeys.gardens.byChain(DEFAULT_CHAIN_ID), [SELECTED_GARDEN]);
  queryClient.setQueryData(queryKeys.actions.byChain(DEFAULT_CHAIN_ID), []);
  queryClient.setQueryData(
    queryKeys.role.operatorGardens(OPERATOR.toLowerCase(), DEFAULT_CHAIN_ID),
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
});
