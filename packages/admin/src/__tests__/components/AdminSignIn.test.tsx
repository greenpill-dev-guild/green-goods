/** @vitest-environment happy-dom */
import type { AdminLoginController } from "@green-goods/shared/hooks/admin-ui/auth/useAdminLoginController";
import { fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AdminSignIn } from "@/components/AdminSignIn";
import { AdminAccessStateRenderer } from "@/components/Layout/AdminAccessStateRenderer";
import { render, screen } from "../test-utils";

const mocks = vi.hoisted(() => ({ wallet: vi.fn(), passkey: vi.fn(), create: vi.fn() }));
vi.mock("wagmi", async (importOriginal) => ({
  ...(await importOriginal<typeof import("wagmi")>()),
  useAccount: () => ({ isConnecting: false }),
}));
vi.mock("@green-goods/shared/hooks/blockchain/useChainConfig", () => ({
  useCurrentChain: () => 11155111,
}));
vi.mock("@green-goods/shared/providers/Auth", () => ({
  useAuthActions: () => ({
    loginWithWallet: mocks.wallet,
    loginWithPasskey: mocks.passkey,
    createAccount: mocks.create,
  }),
  useAuthState: () => ({ hasStoredCredential: false, isAuthenticating: false }),
}));

function controller(overrides: Partial<AdminLoginController> = {}): AdminLoginController {
  return {
    mode: "signin",
    changeMode: vi.fn(),
    username: "qa-steward",
    setUsername: vi.fn(),
    error: null,
    isSigningIn: false,
    canSignInByName: true,
    hasStoredCredential: false,
    storedUsername: null,
    createAccountByName: vi.fn(async () => {}),
    signInByName: vi.fn(async () => {}),
    signInWithStoredPasskey: vi.fn(async () => {}),
    ...overrides,
  };
}

describe("AdminSignIn", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.passkey.mockResolvedValue(undefined);
    mocks.create.mockResolvedValue(undefined);
  });

  it("submits the creation action and provides a separate path to existing-account sign-in", async () => {
    const state = controller({ mode: "create" });
    render(<AdminSignIn controller={state} />);
    expect(screen.getByLabelText("Display name for new account")).toHaveValue("qa-steward");
    await userEvent.click(screen.getByRole("button", { name: "Create Account" }));
    expect(state.createAccountByName).toHaveBeenCalledOnce();
    expect(state.signInByName).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Already have an account?" }));
    expect(state.changeMode).toHaveBeenCalledWith("signin");
  });

  it("holds the creation form and mode switch while registration is pending", () => {
    const state = controller({ mode: "create", isSigningIn: true });
    render(<AdminSignIn controller={state} />);
    expect(screen.getByLabelText("Display name for new account")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Already have an account?" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Connect Wallet" })).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent("Setting up your account...");
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
    await userEvent.click(screen.getByRole("button", { name: "Create Account" }));
    expect(state.changeMode).toHaveBeenCalledWith("create");
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
    await userEvent.click(screen.getByRole("button", { name: "Already have an account?" }));
    fireEvent.change(screen.getByLabelText("Passkey account name"), {
      target: { value: " @QA-STEW ARD " },
    });
    await userEvent.click(screen.getByRole("button", { name: "Sign in with Passkey" }));
    expect(mocks.passkey).toHaveBeenCalledWith("qa-stew ard");
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("wires a first account through the real admin entry point to Shared registration", async () => {
    vi.stubEnv("VITE_PASSKEY_SERVER_ENABLED", "true");
    render(
      <MemoryRouter>
        <AdminAccessStateRenderer state={{ status: "disconnected" }} ready={<div>Ready</div>} />
      </MemoryRouter>
    );
    fireEvent.change(screen.getByLabelText("Display name for new account"), {
      target: { value: " @NEW-STEWARD " },
    });
    await userEvent.click(screen.getByRole("button", { name: "Create Account" }));
    expect(mocks.create).toHaveBeenCalledWith("new-steward");
    expect(mocks.passkey).not.toHaveBeenCalled();
  });
});
