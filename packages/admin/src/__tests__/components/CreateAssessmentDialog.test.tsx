/**
 * @vitest-environment jsdom
 */

import { QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { get as idbGet } from "idb-keyval";
import { IntlProvider } from "react-intl";
import { RouterProvider, createMemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AuthContext,
  DEFAULT_CHAIN_ID,
  queryKeys,
  useAdminStore,
  useCreateAssessmentStore,
  type AuthContextType,
  type Garden,
} from "@green-goods/shared";
import { createTestQueryClient } from "@green-goods/shared/testing";
import CreateAssessment from "@/views/Hub/CreateAssessment";

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
}));

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

function renderCreateAssessment() {
  const queryClient = createTestQueryClient();
  queryClient.setQueryData(queryKeys.gardens.byChain(DEFAULT_CHAIN_ID), [SELECTED_GARDEN]);
  queryClient.setQueryData(
    queryKeys.role.operatorGardens(OPERATOR.toLowerCase(), DEFAULT_CHAIN_ID),
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

  return render(
    <QueryClientProvider client={queryClient}>
      <IntlProvider locale="en" messages={{}} onError={() => {}}>
        <AuthContext.Provider value={authContextValue}>
          <RouterProvider router={router} />
        </AuthContext.Provider>
      </IntlProvider>
    </QueryClientProvider>
  );
}

describe("CreateAssessment dialog", () => {
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

  it("opens the assessment form from the route garden id without a Zustand selected garden", async () => {
    await act(async () => {
      renderCreateAssessment();
      await Promise.resolve();
    });

    expect(await screen.findByRole("heading", { name: "Domain & Context" })).toBeInTheDocument();
    expect(screen.getByText("Role-Proven Garden")).toBeInTheDocument();
    expect(screen.queryByText("app.garden.admin.notFound")).not.toBeInTheDocument();
  });

  it("clears the persisted draft and in-memory form when the operator confirms Discard", async () => {
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

    const dialog = screen.getByRole("dialog", { name: "Submit assessment" });
    fireEvent.keyDown(dialog, { key: "Escape" });

    const discardButton = await screen.findByRole("button", { name: "Discard" });
    await act(async () => {
      fireEvent.click(discardButton);
      await Promise.resolve();
    });

    expect(await idbGet(draftKey)).toBeUndefined();
    expect(useCreateAssessmentStore.getState().form.title).toBe("");
  });
});
