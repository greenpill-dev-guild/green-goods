/**
 * Layout shell state tests.
 * @vitest-environment happy-dom
 */

import { MemoryRouter } from "react-router-dom";
import { QueryClient } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen, userEvent } from "../../test-utils";
import { DEFAULT_CHAIN_ID } from "@green-goods/shared/config/default-chain";
import { queryKeys } from "@green-goods/shared/config/query-keys/registry";
import { AdminAccessStateRenderer } from "@/components/Layout/AdminAccessStateRenderer";
import { CanvasGardenAccessState } from "@/components/Layout/CanvasGardenAccessState";
import { CanvasWorkspaceSelectionState } from "@/components/Layout/CanvasWorkspaceSelectionState";
import { ConnectShell } from "@/components/Layout/ConnectShell";

vi.mock("@/components/ConnectButton", () => ({
  ConnectButton: () => <button type="button">Connect Wallet</button>,
}));
vi.mock("@/components/Layout/StewardAccessRequest", () => ({
  StewardAccessRequestContainer: () => <button type="button">Request Steward Access</button>,
}));

const account = vi.hoisted(() => ({
  address: "0x9999999999999999999999999999999999999999" as const,
  signOut: vi.fn(),
}));

vi.mock("@green-goods/shared/hooks/admin-ui/layout/useAccountProfileController", () => ({
  useAccountProfileController: () => ({
    authMethodLabel: "Passkey",
    avatarFallback: "99",
    eligibleGardens: [],
    primaryAddress: account.address,
    headline: "0x9999…9999",
    roleLabel: "user",
    selectedGardenChoiceId: null,
    selectGarden: vi.fn(),
    signOut: account.signOut,
  }),
}));

vi.mock("@green-goods/shared/hooks/blockchain/useEnsName", () => ({
  useEnsName: () => ({ data: null }),
}));

vi.mock("@green-goods/shared/hooks/ens/useGreenGoodsEnsName", () => ({
  useGreenGoodsEnsName: () => ({ data: null }),
}));

vi.mock("@/components/Layout/AccountProfileAvatarEditor", () => ({
  AccountProfileAvatarEditor: () => null,
}));

vi.mock("@/components/AdminSignIn", () => ({
  AdminSignInContainer: () => <button type="button">Sign In</button>,
}));

describe("CanvasGardenAccessState", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the no-garden access state with create action when allowed", async () => {
    const onCreateGarden = vi.fn();
    const user = userEvent.setup();

    renderWithProviders(
      <CanvasGardenAccessState onCreateGarden={onCreateGarden} canCreateGarden />
    );

    expect(screen.getByTestId("canvas-no-garden-access")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /no garden access yet/i })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /create garden/i }));

    expect(onCreateGarden).toHaveBeenCalledOnce();
  });

  it("renders the restricted empty state without the create action", () => {
    renderWithProviders(
      <CanvasGardenAccessState onCreateGarden={vi.fn()} canCreateGarden={false} />
    );

    expect(screen.getByTestId("canvas-no-garden-access")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /create garden/i })).not.toBeInTheDocument();
  });
});

describe("CanvasWorkspaceSelectionState", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the empty workspace slot when no gardens are available", () => {
    renderWithProviders(
      <MemoryRouter initialEntries={["/community"]}>
        <CanvasWorkspaceSelectionState
          workspaceLabel="community"
          gardens={[]}
          onSelectGarden={vi.fn()}
        />
      </MemoryRouter>
    );

    expect(screen.getByRole("heading", { name: /no gardens yet/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /create garden/i })).toHaveAttribute(
      "href",
      "/garden/create"
    );
    expect(screen.queryByRole("button", { name: /open/i })).not.toBeInTheDocument();
  });

  it("renders the populated workspace slot and selects a garden", async () => {
    const onSelectGarden = vi.fn();
    const user = userEvent.setup();
    const gardens = [
      { id: "garden-1", name: "Comunidad Verde", location: "Costa Rica" },
      { id: "garden-2", name: "Jardim Botafogo", location: "Brazil" },
    ];

    renderWithProviders(
      <MemoryRouter initialEntries={["/community"]}>
        <CanvasWorkspaceSelectionState
          workspaceLabel="community"
          gardens={gardens}
          onSelectGarden={onSelectGarden}
        />
      </MemoryRouter>
    );

    expect(screen.getByRole("heading", { name: /choose a garden/i })).toBeInTheDocument();
    expect(screen.getByText("Comunidad Verde")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /create garden/i })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /open comunidad verde/i }));

    expect(onSelectGarden).toHaveBeenCalledWith(gardens[0]);
  });
});

describe("AdminAccessStateRenderer", () => {
  const secureContextDescriptor = Object.getOwnPropertyDescriptor(window, "isSecureContext");

  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, "isSecureContext", { configurable: true, value: true });
  });

  afterEach(() => {
    if (secureContextDescriptor) {
      Object.defineProperty(window, "isSecureContext", secureContextDescriptor);
    } else {
      Reflect.deleteProperty(window, "isSecureContext");
    }
  });

  it("lets a passkey account without garden access copy its address and sign out", async () => {
    const user = userEvent.setup();
    const { rerender } = renderWithProviders(
      <MemoryRouter>
        <AdminAccessStateRenderer
          state={{ status: "no-access", canCreateGarden: false }}
          ready={null}
        />
      </MemoryRouter>
    );

    await user.click(screen.getByRole("button", { name: "Profile" }));
    expect(screen.getByRole("dialog", { name: "Profile" })).toBeVisible();
    expect(screen.getByText("Passkey")).toBeVisible();
    expect(screen.getByText("No gardens yet.")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Copy Address" }));
    expect(await navigator.clipboard.readText()).toBe(account.address);
    await user.click(screen.getByRole("button", { name: "Disconnect" }));
    expect(account.signOut).toHaveBeenCalledOnce();
    rerender(
      <MemoryRouter>
        <AdminAccessStateRenderer state={{ status: "disconnected" }} ready={null} />
      </MemoryRouter>
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Copy Address" })).not.toBeInTheDocument();
  });

  it("keeps profile access available when garden access checks fail", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <MemoryRouter>
        <AdminAccessStateRenderer state={{ status: "indexer-error" }} ready={null} />
      </MemoryRouter>
    );

    await user.click(screen.getByRole("button", { name: "Profile" }));
    expect(screen.getByRole("button", { name: "Copy Address" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /try again/i })).toBeVisible();
  });

  it("does not show an account action before sign-in", () => {
    renderWithProviders(
      <MemoryRouter>
        <AdminAccessStateRenderer state={{ status: "disconnected" }} ready={null} />
      </MemoryRouter>
    );

    expect(screen.queryByRole("button", { name: "Profile" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign In" })).toBeVisible();
  });

  it("retries both base garden and role queries from the indexer-error state", async () => {
    const invalidateQueries = vi.spyOn(QueryClient.prototype, "invalidateQueries");
    const user = userEvent.setup();

    renderWithProviders(
      <MemoryRouter>
        <AdminAccessStateRenderer state={{ status: "indexer-error" }} ready={null} />
      </MemoryRouter>
    );

    await user.click(screen.getByRole("button", { name: /try again/i }));

    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: queryKeys.gardens.byChain(DEFAULT_CHAIN_ID),
    });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: queryKeys.role.all });
  });
});

describe("ConnectShell", () => {
  it("renders the connect prompt without navigation chrome", () => {
    renderWithProviders(<ConnectShell />);

    expect(screen.getByTestId("connect-shell")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /connect your wallet to continue/i })
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /connect wallet/i })).toBeInTheDocument();
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});
