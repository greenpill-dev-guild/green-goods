/** @vitest-environment happy-dom */
import type { AdminLoginController } from "@green-goods/shared/hooks/admin-ui/auth/useAdminLoginController";
import { fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AdminSignIn } from "@/components/AdminSignIn";
import { AdminAccessStateRenderer } from "@/components/Layout/AdminAccessStateRenderer";
import { render, screen } from "../test-utils";

const mocks = vi.hoisted(() => ({ wallet: vi.fn(), passkey: vi.fn() }));
vi.mock("wagmi", async (importOriginal) => ({
  ...(await importOriginal<typeof import("wagmi")>()),
  useAccount: () => ({ isConnecting: false }),
}));
vi.mock("@green-goods/shared/hooks/blockchain/useChainConfig", () => ({
  useCurrentChain: () => 11155111,
}));
vi.mock("@green-goods/shared/providers/Auth", () => ({
  useAuthActions: () => ({ loginWithWallet: mocks.wallet, loginWithPasskey: mocks.passkey }),
  useAuthState: () => ({ hasStoredCredential: false, isAuthenticating: false }),
}));

function controller(overrides: Partial<AdminLoginController> = {}): AdminLoginController {
  return {
    username: "qa-steward",
    setUsername: vi.fn(),
    error: null,
    isSigningIn: false,
    canSignInByName: true,
    hasStoredCredential: false,
    storedUsername: null,
    signInByName: vi.fn(async () => {}),
    signInWithStoredPasskey: vi.fn(async () => {}),
    ...overrides,
  };
}

describe("AdminSignIn", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.passkey.mockResolvedValue(undefined);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("edits the account name and submits the named sign-in action", async () => {
    const state = controller();
    render(<AdminSignIn controller={state} />);
    fireEvent.change(screen.getByLabelText("Passkey account name"), {
      target: { value: "another-name" },
    });
    expect(state.setUsername).toHaveBeenCalledWith("another-name");
    await userEvent.click(screen.getByRole("button", { name: "Sign in with Passkey" }));
    expect(state.signInByName).toHaveBeenCalledOnce();
    expect(state.signInWithStoredPasskey).not.toHaveBeenCalled();
  });

  it("lets the person explicitly choose the remembered account", async () => {
    const state = controller({ hasStoredCredential: true, storedUsername: "qa-remembered" });
    render(<AdminSignIn controller={state} />);
    await userEvent.click(screen.getByRole("button", { name: "Continue as qa-remembered" }));
    expect(state.signInWithStoredPasskey).toHaveBeenCalledOnce();
    expect(state.signInByName).not.toHaveBeenCalled();
  });

  it("holds the name and both sign-in methods while a ceremony is pending", async () => {
    render(<AdminSignIn controller={controller({ isSigningIn: true })} />);
    expect(screen.getByLabelText("Passkey account name")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Connect Wallet" })).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent("Signing you in...");
    await userEvent.click(screen.getByRole("button", { name: "Connect Wallet" }));
    expect(mocks.wallet).not.toHaveBeenCalled();
  });

  it("announces a sign-in failure inline and keeps the typed name", () => {
    render(<AdminSignIn controller={controller({ error: "Sign in was cancelled." })} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Sign in was cancelled.");
    expect(screen.getByLabelText("Passkey account name")).toHaveValue("qa-steward");
  });

  it("keeps wallet-only login when names are disabled and no passkey is remembered", async () => {
    render(<AdminSignIn controller={controller({ canSignInByName: false })} />);
    expect(screen.queryByLabelText("Passkey account name")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Connect Wallet" }));
    expect(mocks.wallet).toHaveBeenCalledOnce();
  });

  it("wires the real disconnected admin entry point to Shared passkey sign-in", async () => {
    vi.stubEnv("VITE_PASSKEY_SERVER_ENABLED", "true");
    render(
      <MemoryRouter>
        <AdminAccessStateRenderer state={{ status: "disconnected" }} ready={<div>Ready</div>} />
      </MemoryRouter>
    );
    fireEvent.change(screen.getByLabelText("Passkey account name"), {
      target: { value: " @QA-STEW ARD " },
    });
    await userEvent.click(screen.getByRole("button", { name: "Sign in with Passkey" }));
    expect(mocks.passkey).toHaveBeenCalledWith("qa-stew ard");
  });
});
