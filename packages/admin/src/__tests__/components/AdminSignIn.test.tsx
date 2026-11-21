/** @vitest-environment happy-dom */
import type { AdminLoginController } from "@green-goods/shared/hooks/admin-ui/auth/useAdminLoginController";
import { fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AdminSignIn } from "@/components/AdminSignIn";
import { requestPasskeyAtBoot } from "@/components/Boot/bootPasskeyRequest";
import { AdminAccessStateRenderer } from "@/components/Layout/AdminAccessStateRenderer";
import { render, screen } from "../test-utils";

const mocks = vi.hoisted(() => ({ wallet: vi.fn(), passkey: vi.fn(), create: vi.fn() }));
vi.mock("wagmi", async (importOriginal) => ({
  ...(await importOriginal<typeof import("wagmi")>()),
  useAccount: () => ({ isConnecting: false }),
}));
vi.mock("@green-goods/shared/hooks/auth/useWalletModalOpen", () => ({
  useWalletModalOpen: () => false,
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
    mode: "entry",
    changeMode: vi.fn(),
    username: "qa-steward",
    setUsername: vi.fn(),
    error: null,
    isSigningIn: false,
    isPasskeySigningIn: false,
    canSignInByName: true,
    hasStoredCredential: false,
    storedUsername: null,
    continueByName: vi.fn(async () => {}),
    signInWithStoredPasskey: vi.fn(async () => {}),
    beginWalletSignIn: vi.fn(),
    ...overrides,
  };
}

describe("AdminSignIn", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.passkey.mockResolvedValue(undefined);
    mocks.create.mockResolvedValue(undefined);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("offers a passkey first and a wallet second, as the App does", async () => {
    const state = controller();
    render(<AdminSignIn controller={state} />);
    const actions = screen.getAllByRole("button").map((button) => button.textContent);
    expect(actions).toEqual(["Continue with Passkey", "Sign in with a Wallet"]);
    await userEvent.click(screen.getByRole("button", { name: "Continue with Passkey" }));
    expect(state.changeMode).toHaveBeenCalledWith("username");
    await userEvent.click(screen.getByRole("button", { name: "Sign in with a Wallet" }));
    expect(state.beginWalletSignIn).toHaveBeenCalledOnce();
    expect(mocks.wallet).toHaveBeenCalledOnce();
  });

  it("signs in or creates from one name step, and goes back to the entry", async () => {
    const state = controller({ mode: "username" });
    const { rerender } = render(<AdminSignIn controller={state} />);
    expect(
      screen.getByText("Enter your username to sign in, or choose a new one to create an account.")
    ).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Username or ENS handle"), {
      target: { value: "another-name" },
    });
    expect(state.setUsername).toHaveBeenCalledWith("another-name");
    await userEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(state.continueByName).toHaveBeenCalledOnce();
    await userEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(state.changeMode).toHaveBeenCalledWith("entry");
    // Back removes the field and the Back button, so focus lands on the entry's first action.
    rerender(<AdminSignIn controller={{ ...state, mode: "entry" }} />);
    expect(screen.getByRole("button", { name: "Continue with Passkey" })).toHaveFocus();
  });

  it("signs a remembered steward in at once and keeps another account one tap away", async () => {
    const state = controller({ hasStoredCredential: true, storedUsername: "qa-remembered" });
    render(<AdminSignIn controller={state} />);
    await userEvent.click(screen.getByRole("button", { name: "Continue as qa-remembered" }));
    expect(state.signInWithStoredPasskey).toHaveBeenCalledOnce();
    await userEvent.click(screen.getByRole("button", { name: "Use Different Username" }));
    expect(state.changeMode).toHaveBeenCalledWith("username");
  });

  it("holds every control while a remembered sign-in is pending", async () => {
    const { unmount } = render(
      <AdminSignIn
        controller={controller({
          hasStoredCredential: true,
          isSigningIn: true,
          isPasskeySigningIn: true,
        })}
      />
    );
    expect(screen.getByRole("status")).toHaveTextContent("Signing you in...");
    expect(screen.getByRole("button", { name: "Sign in with a Wallet" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Use Different Username" })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "Sign in with a Wallet" }));
    expect(mocks.wallet).not.toHaveBeenCalled();
    unmount();
    // A wallet sign-in holds the same controls but says nothing about a passkey.
    render(
      <AdminSignIn controller={controller({ hasStoredCredential: true, isSigningIn: true })} />
    );
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.getByTestId("passkey-start-button")).not.toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("button", { name: "Use Different Username" })).toBeDisabled();
  });

  it("holds the name and Back while the name step is pending", () => {
    render(
      <AdminSignIn
        controller={controller({ mode: "username", isSigningIn: true, isPasskeySigningIn: true })}
      />
    );
    expect(screen.getByLabelText("Username or ENS handle")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Back" })).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent("Continuing...");
  });

  it("announces a failure inline and keeps the typed name", () => {
    render(
      <AdminSignIn controller={controller({ mode: "username", error: "Sign in was canceled." })} />
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Sign in was canceled.");
    expect(screen.getByLabelText("Username or ENS handle")).toHaveValue("qa-steward");
  });

  it("creates from the name step when names cannot be looked up", async () => {
    const state = controller({ canSignInByName: false, hasStoredCredential: true });
    const { unmount } = render(<AdminSignIn controller={state} />);
    // A remembered passkey still signs in, and another account can still be created.
    expect(screen.queryByRole("button", { name: "Use Different Username" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Create Account" }));
    expect(state.changeMode).toHaveBeenCalledWith("username");
    unmount();
    const form = controller({ mode: "username", canSignInByName: false });
    render(<AdminSignIn controller={form} />);
    expect(
      screen.getByText(
        "Keeps same-device sign-in. May need re-enrollment if browser storage is cleared."
      )
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Create Account" }));
    expect(form.continueByName).toHaveBeenCalledOnce();
  });

  it("wires the real signed-out entry to Shared sign-in that creates a missing account", async () => {
    vi.stubEnv("VITE_PASSKEY_SERVER_ENABLED", "true");
    render(
      <MemoryRouter>
        <AdminAccessStateRenderer state={{ status: "disconnected" }} ready={<div>Ready</div>} />
      </MemoryRouter>
    );
    expect(screen.getByRole("heading", { name: "Connect to continue" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Continue with Passkey" }));
    fireEvent.change(screen.getByLabelText("Username or ENS handle"), {
      target: { value: " @QA-STEW ARD " },
    });
    await userEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(mocks.passkey).toHaveBeenCalledWith("qa-stew ard", { createIfMissing: true });
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("opens the name step once after a passkey was chosen at boot", () => {
    vi.stubEnv("VITE_PASSKEY_SERVER_ENABLED", "true");
    const signedOut = (
      <MemoryRouter>
        <AdminAccessStateRenderer state={{ status: "disconnected" }} ready={<div>Ready</div>} />
      </MemoryRouter>
    );
    requestPasskeyAtBoot();
    const first = render(signedOut);
    expect(screen.getByLabelText("Username or ENS handle")).toBeInTheDocument();
    first.unmount();
    // Read once: a later sign-out starts at the entry.
    const second = render(signedOut);
    expect(screen.getByRole("button", { name: "Continue with Passkey" })).toBeInTheDocument();
    second.unmount();
    // A session that opens without that sign-in lets the request go too, whatever access
    // it lands on.
    requestPasskeyAtBoot();
    render(
      <MemoryRouter>
        <AdminAccessStateRenderer state={{ status: "indexer-error" }} ready={<div>Ready</div>} />
      </MemoryRouter>
    ).unmount();
    render(signedOut);
    expect(screen.getByRole("button", { name: "Continue with Passkey" })).toBeInTheDocument();
  });

  it("wires the real signed-out entry to Shared registration without the passkey server", async () => {
    vi.stubEnv("VITE_PASSKEY_SERVER_ENABLED", "false");
    render(
      <MemoryRouter>
        <AdminAccessStateRenderer state={{ status: "disconnected" }} ready={<div>Ready</div>} />
      </MemoryRouter>
    );
    await userEvent.click(screen.getByRole("button", { name: "Create Account" }));
    fireEvent.change(screen.getByLabelText("Username or ENS handle"), {
      target: { value: " @NEW-STEWARD " },
    });
    await userEvent.click(screen.getByRole("button", { name: "Create Account" }));
    expect(mocks.create).toHaveBeenCalledWith("new-steward");
    expect(mocks.passkey).not.toHaveBeenCalled();
  });
});
