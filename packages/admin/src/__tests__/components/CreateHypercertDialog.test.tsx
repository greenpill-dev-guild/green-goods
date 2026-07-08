/**
 * @vitest-environment jsdom
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
  useHypercertWizardStore,
  type AuthContextType,
  type Garden,
} from "@green-goods/shared";
import { createTestQueryClient } from "@green-goods/shared/testing";
import CreateHypercert from "@/views/Hub/CreateHypercert";

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

function renderCreateHypercert({ seedGarden = true }: { seedGarden?: boolean } = {}) {
  const queryClient = createTestQueryClient();
  queryClient.setQueryData(
    queryKeys.gardens.byChain(DEFAULT_CHAIN_ID),
    seedGarden ? [SELECTED_GARDEN] : []
  );
  queryClient.setQueryData(
    queryKeys.role.operatorGardens(OPERATOR.toLowerCase(), DEFAULT_CHAIN_ID),
    seedGarden ? [{ id: SELECTED_GARDEN.id, name: SELECTED_GARDEN.name }] : []
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
      { path: "/hub/certify/create", element: <CreateHypercert /> },
      { path: "/hub/*", element: <div /> },
    ],
    {
      initialEntries: [`/hub/certify/create?gardenId=${SELECTED_GARDEN.id}`],
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

describe("CreateHypercert dialog", () => {
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
    useHypercertWizardStore.getState().reset();
    useAdminStore.setState({ selectedGarden: null, lastGardenIdsByScope: {} });
    cleanup();
  });

  it("opens the wizard from the route garden id without a Zustand selected garden", async () => {
    await act(async () => {
      renderCreateHypercert();
      await Promise.resolve();
    });

    expect(
      await screen.findByRole("heading", { name: "app.hypercerts.wizard.step.attestations.title" })
    ).toBeInTheDocument();
    expect(screen.getByText("Role-Proven Garden")).toBeInTheDocument();
    expect(screen.queryByText("app.hypercerts.create.notFound")).not.toBeInTheDocument();
  });

  it("blocks route navigation while hypercert minting is pending", async () => {
    let router: ReturnType<typeof renderCreateHypercert> | undefined;
    await act(async () => {
      router = renderCreateHypercert();
      await Promise.resolve();
    });

    await act(async () => {
      useHypercertWizardStore.getState().setMintingState({ status: "pending" });
      await Promise.resolve();
    });

    await act(async () => {
      void router?.navigate("/hub/work");
      await Promise.resolve();
    });

    expect(router?.state.location.pathname).toBe("/hub/certify/create");
    expect(router?.state.location.search).toBe(`?gardenId=${SELECTED_GARDEN.id}`);
  });

  it("locks the shell close path while hypercert minting is pending", async () => {
    let router: ReturnType<typeof renderCreateHypercert> | undefined;
    await act(async () => {
      router = renderCreateHypercert();
      await Promise.resolve();
    });

    await act(async () => {
      useHypercertWizardStore.getState().setMintingState({ status: "pending" });
      await Promise.resolve();
    });

    const dialog = await screen.findByRole("dialog", {
      name: "app.hypercerts.create.title",
    });

    expect(screen.getByLabelText(/close/i)).toBeDisabled();

    fireEvent.keyDown(dialog, { key: "Escape" });

    expect(router?.state.location.pathname).toBe("/hub/certify/create");
    expect(dialog).toBeInTheDocument();
  });

  it("locks the shell close path while restored pending mint state waits for garden data", async () => {
    let router: ReturnType<typeof renderCreateHypercert> | undefined;
    await act(async () => {
      useHypercertWizardStore.getState().setMintingState({ status: "pending" });
      router = renderCreateHypercert({ seedGarden: false });
      await Promise.resolve();
    });

    const dialog = await screen.findByRole("dialog", {
      name: "app.hypercerts.create.title",
    });

    expect(screen.getAllByText("app.hypercerts.create.notFound").length).toBeGreaterThan(0);
    expect(screen.getByLabelText(/close/i)).toBeDisabled();

    fireEvent.keyDown(dialog, { key: "Escape" });

    expect(router?.state.location.pathname).toBe("/hub/certify/create");
    expect(router?.state.location.search).toBe(`?gardenId=${SELECTED_GARDEN.id}`);
    expect(dialog).toBeInTheDocument();

    await act(async () => {
      void router?.navigate("/hub/work");
      await Promise.resolve();
    });

    expect(router?.state.location.pathname).toBe("/hub/certify/create");
    expect(router?.state.location.search).toBe(`?gardenId=${SELECTED_GARDEN.id}`);
  });
});
