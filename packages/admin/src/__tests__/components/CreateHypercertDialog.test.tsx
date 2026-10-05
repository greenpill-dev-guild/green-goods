/**
 * @vitest-environment happy-dom
 */

import { QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ComponentProps } from "react";
import { IntlProvider } from "react-intl";
import { RouterProvider, createMemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_CHAIN_ID } from "@green-goods/shared/config/default-chain";
import { queryKeys } from "@green-goods/shared/config/query-keys/registry";
import { AuthContext } from "@green-goods/shared/providers/Auth";
import { useAdminStore } from "@green-goods/shared/stores/useAdminStore";
import { useHypercertWizardStore } from "@green-goods/shared/stores/useHypercertWizardStore";
import type { Garden } from "@green-goods/shared/types/domain";
import { createTestQueryClient } from "@green-goods/shared/__tests__/test-utils/query-client";
import CreateHypercert from "@/views/Hub/CreateHypercert";

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

// The wizard's attestations: loaded and empty unless a test says otherwise.
const attestationsState = vi.hoisted(() => ({
  isLoading: false,
  hasError: false,
  attestations: [] as unknown[],
}));
vi.mock("@green-goods/shared/hooks/hypercerts/useAttestations", () => ({
  useAttestations: () => ({
    attestations: attestationsState.attestations,
    isLoading: attestationsState.isLoading,
    error: null,
    hasError: attestationsState.hasError,
    refetch: async () => [],
  }),
}));

vi.mock("wagmi", () => ({
  useAccount: () => ({ address: OPERATOR, isConnected: true, isConnecting: false }),
  useReadContract: () => ({ data: 1 }),
}));

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

function renderCreateHypercert({ seedGarden = true }: { seedGarden?: boolean } = {}) {
  const queryClient = createTestQueryClient();
  queryClient.setQueryData(
    queryKeys.gardens.byChain(DEFAULT_CHAIN_ID),
    seedGarden ? [SELECTED_GARDEN] : []
  );
  queryClient.setQueryData(
    queryKeys.role.stewardGardens(OPERATOR.toLowerCase(), DEFAULT_CHAIN_ID),
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
      { path: "/garden/*", element: <div /> },
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
    Object.assign(attestationsState, { isLoading: false, hasError: false, attestations: [] });
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

  it("asks for an attestation only after Next is pressed with none selected", async () => {
    await act(async () => {
      renderCreateHypercert();
      await Promise.resolve();
    });

    const next = await screen.findByRole("button", { name: "Next" });
    expect(
      screen.queryByText("app.hypercerts.wizard.validation.selectAttestation")
    ).not.toBeInTheDocument();

    fireEvent.click(next);

    expect(
      await screen.findByText("app.hypercerts.wizard.validation.selectAttestation")
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "app.hypercerts.wizard.step.attestations.title" })
    ).toBeInTheDocument();
  });

  it("keeps Next waiting while attestations load or fail to load", async () => {
    for (const state of [
      { isLoading: true, hasError: false },
      { isLoading: false, hasError: true },
    ]) {
      Object.assign(attestationsState, state);
      await act(async () => {
        renderCreateHypercert();
        await Promise.resolve();
      });
      // Nothing to pick yet, so Next cannot claim nothing was picked.
      expect(await screen.findByRole("button", { name: "Next" })).toBeDisabled();
      cleanup();
    }
  });

  it("lets Next go on from loaded attestations when a later refresh fails", async () => {
    const attestation = {
      id: "0xattestation-1",
      workUid: "0xwork-1",
      gardenId: "0xgarden",
      title: "Planting day",
      workScope: ["planting"],
      gardenerAddress: OPERATOR,
      mediaUrls: [],
      createdAt: 1,
      approvedAt: 2,
    };
    Object.assign(attestationsState, { hasError: true, attestations: [attestation] });
    await act(async () => {
      renderCreateHypercert();
      await Promise.resolve();
    });
    act(() => useHypercertWizardStore.setState({ selectedAttestationIds: [attestation.id] }));

    expect(await screen.findByRole("button", { name: "Next" })).toBeEnabled();
  });

  it("asks for an attestation when a restored draft's picks no longer exist", async () => {
    await act(async () => {
      renderCreateHypercert();
      await Promise.resolve();
    });
    const next = await screen.findByRole("button", { name: "Next" });
    // A restored draft loads its picks after the wizard resets; picks that match
    // no loaded attestation select nothing.
    act(() => useHypercertWizardStore.setState({ selectedAttestationIds: ["0xattestation-gone"] }));

    fireEvent.click(next);

    expect(
      await screen.findByText("app.hypercerts.wizard.validation.selectAttestation")
    ).toBeInTheDocument();
  });

  it("closes straight back to the Hub while the hypercert wizard is pristine", async () => {
    let router: ReturnType<typeof renderCreateHypercert> | undefined;
    await act(async () => {
      router = renderCreateHypercert();
      await Promise.resolve();
    });

    const dialog = await screen.findByRole("dialog", { name: "app.hypercerts.create.title" });
    await act(async () => {
      fireEvent.keyDown(dialog, { key: "Escape" });
      await Promise.resolve();
    });

    await waitFor(() => expect(router?.state.location.pathname).toBe("/hub/work"));
    expect(screen.queryByRole("button", { name: "Discard" })).not.toBeInTheDocument();
  });

  it("prompts before closing a dirty hypercert wizard and discards on confirmation", async () => {
    let router: ReturnType<typeof renderCreateHypercert> | undefined;
    await act(async () => {
      router = renderCreateHypercert();
      await Promise.resolve();
    });

    await act(async () => {
      useHypercertWizardStore.getState().setSelectedAttestations(["attestation-1"]);
      await Promise.resolve();
    });

    const dialog = await screen.findByRole("dialog", { name: "app.hypercerts.create.title" });
    fireEvent.keyDown(dialog, { key: "Escape" });

    expect(await screen.findByRole("button", { name: "Discard" })).toBeInTheDocument();
    expect(router?.state.location.pathname).toBe("/hub/certify/create");

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Discard" }));
      await Promise.resolve();
    });

    await waitFor(() => expect(router?.state.location.pathname).toBe("/hub/work"));
    expect(useHypercertWizardStore.getState().selectedAttestationIds).toEqual([]);
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

  // DL-080: the flow ends on its Review, where the mint shows in the status row
  // and a confirmed mint leaves Done; nothing asks to discard after it.
  describe("the Review's mint", () => {
    const HYPERCERT_ID = "0xhypercert-1";

    async function onReview() {
      attestationsState.attestations = [
        {
          id: "0xattestation-1",
          workUid: "0xwork-1",
          gardenId: SELECTED_GARDEN.id,
          title: "Planting day",
          workScope: ["planting"],
          gardenerAddress: OPERATOR,
          mediaUrls: [],
          createdAt: 1,
          approvedAt: 2,
        },
      ];
      let router: ReturnType<typeof renderCreateHypercert> | undefined;
      await act(async () => {
        router = renderCreateHypercert();
        await Promise.resolve();
      });
      await act(async () => {
        const store = useHypercertWizardStore.getState();
        store.setSelectedAttestations(["0xattestation-1"]);
        store.setStep(4);
        await Promise.resolve();
      });
      expect(
        await screen.findByRole("heading", { name: "app.hypercerts.wizard.step.preview.title" })
      ).toBeInTheDocument();
      return router;
    }

    it("shows what the mint will do on the Review before anything is sent", async () => {
      await onReview();

      expect(screen.getByText("Mints this hypercert on-chain")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "app.hypercerts.mint.submit" })).toBeEnabled();
    });

    it("ends a confirmed mint on the Review with Done, and never asks to discard", async () => {
      const router = await onReview();

      await act(async () => {
        useHypercertWizardStore
          .getState()
          .setMintingState({ status: "confirmed", hypercertId: HYPERCERT_ID, txHash: "0xabc" });
        await Promise.resolve();
      });

      expect(await screen.findByText("Hypercert minted")).toBeInTheDocument();
      expect(
        screen.getByRole("heading", { name: "app.hypercerts.wizard.step.preview.title" })
      ).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Back" })).not.toBeInTheDocument();
      expect(router?.state.location.pathname).toBe("/hub/certify/create");

      const dialog = screen.getByRole("dialog", { name: "app.hypercerts.create.title" });
      await act(async () => {
        fireEvent.keyDown(dialog, { key: "Escape" });
        await Promise.resolve();
      });

      // Closing a minted hypercert opens its record, as Done does, with no prompt.
      await waitFor(() =>
        expect(router?.state.location.pathname).toBe(`/garden/impact/hypercerts/${HYPERCERT_ID}`)
      );
      expect(screen.queryByRole("button", { name: "Discard" })).not.toBeInTheDocument();
    });

    it("opens the minted hypercert's record from Done", async () => {
      const router = await onReview();
      await act(async () => {
        useHypercertWizardStore
          .getState()
          .setMintingState({ status: "confirmed", hypercertId: HYPERCERT_ID });
        await Promise.resolve();
      });

      await act(async () => {
        fireEvent.click(await screen.findByRole("button", { name: "Done" }));
        await Promise.resolve();
      });

      await waitFor(() =>
        expect(router?.state.location.pathname).toBe(`/garden/impact/hypercerts/${HYPERCERT_ID}`)
      );
      expect(router?.state.location.state).toMatchObject({
        optimisticData: { id: HYPERCERT_ID },
      });
      expect(screen.queryByRole("button", { name: "Discard" })).not.toBeInTheDocument();
    });

    it("keeps a failed mint on the Review with its error, Try Again and Back", async () => {
      const router = await onReview();

      await act(async () => {
        useHypercertWizardStore
          .getState()
          .setMintingState({ status: "failed", error: "User rejected the request." });
        await Promise.resolve();
      });

      expect(await screen.findByRole("button", { name: "Try Again" })).toBeEnabled();
      expect(screen.getByRole("button", { name: "Back" })).toBeEnabled();
      // A declined request reads as a warning, in the row that held the mint's progress.
      const row = document.querySelector('[data-component="FlowStatusRow"]');
      expect(row).toHaveAttribute("data-tone", "warning");
      expect(row).toHaveTextContent("Transaction was cancelled");
      expect(
        screen.getByRole("heading", { name: "app.hypercerts.wizard.step.preview.title" })
      ).toBeInTheDocument();
      expect(screen.queryByText("Hypercert minted")).not.toBeInTheDocument();
      expect(router?.state.location.pathname).toBe("/hub/certify/create");
    });

    it("holds every button while the mint works", async () => {
      await onReview();

      await act(async () => {
        useHypercertWizardStore.getState().setMintingState({ status: "awaiting_signature" });
        await Promise.resolve();
      });

      expect(await screen.findByText("Approve in your wallet")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Back" })).toBeDisabled();
      expect(
        screen.getByText("The dialog stays open until your wallet answers.")
      ).toBeInTheDocument();
    });
  });
});
