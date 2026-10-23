/** @vitest-environment happy-dom */
import { fireEvent, render, waitFor } from "@testing-library/react";
import { lazy, StrictMode, Suspense } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AdminStartupConnect } from "@/components/Boot/AdminStartupConnect";

const auth = vi.hoisted(() => ({
  isReady: false,
  isAuthenticated: false,
  modalOpen: false,
  loginWithWallet: vi.fn(),
}));

vi.mock("@green-goods/shared/providers/Auth", () => ({
  useAuthState: () => auth,
  useAuthActions: () => auth,
}));
vi.mock("@green-goods/shared/hooks/auth/useWalletModalOpen", () => ({
  useWalletModalOpen: () => auth.modalOpen,
}));

function Startup({ requested = true }: { requested?: boolean }) {
  return (
    <AdminStartupConnect requested={requested}>
      <div data-testid="workspace">Workspace</div>
    </AdminStartupConnect>
  );
}

describe("AdminStartupConnect", () => {
  beforeEach(() => {
    auth.isReady = false;
    auth.isAuthenticated = false;
    auth.modalOpen = false;
    auth.loginWithWallet.mockClear();
  });

  it("waits for auth initialization and then forwards the explicit click exactly once", () => {
    const view = render(
      <StrictMode>
        <Startup />
      </StrictMode>
    );
    expect(auth.loginWithWallet).not.toHaveBeenCalled();
    expect(view.queryByTestId("workspace")).toBeNull();
    auth.isReady = true;
    view.rerender(
      <StrictMode>
        <Startup />
      </StrictMode>
    );
    view.rerender(
      <StrictMode>
        <Startup />
      </StrictMode>
    );
    expect(auth.loginWithWallet).toHaveBeenCalledTimes(1);
  });

  it("does not duplicate a connect request when mounted ready under StrictMode", () => {
    auth.isReady = true;
    render(
      <StrictMode>
        <Startup />
      </StrictMode>
    );
    expect(auth.loginWithWallet).toHaveBeenCalledTimes(1);
  });

  it("does not import the lazy workspace until the wallet modal is dismissed", async () => {
    const loadWorkspace = vi.fn(async () => ({
      default: () => <div data-testid="lazy-workspace">Workspace</div>,
    }));
    const Workspace = lazy(loadWorkspace);
    const startup = () => (
      <AdminStartupConnect requested>
        <Suspense fallback="Loading workspace">
          <Workspace />
        </Suspense>
      </AdminStartupConnect>
    );
    auth.isReady = true;
    const view = render(startup());
    expect(loadWorkspace).not.toHaveBeenCalled();
    auth.modalOpen = true;
    view.rerender(startup());
    expect(loadWorkspace).not.toHaveBeenCalled();
    auth.modalOpen = false;
    view.rerender(startup());
    await waitFor(() => expect(view.getByTestId("lazy-workspace")).toBeInTheDocument());
    expect(loadWorkspace).toHaveBeenCalledTimes(1);
    expect(auth.loginWithWallet).toHaveBeenCalledTimes(1);
  });

  it("opens the workspace after authentication without waiting for modal dismissal", () => {
    auth.isReady = true;
    auth.modalOpen = true;
    const view = render(<Startup />);
    auth.isAuthenticated = true;
    view.rerender(<Startup />);
    expect(view.getByTestId("workspace")).toBeInTheDocument();
    auth.isAuthenticated = false;
    view.rerender(<Startup />);
    expect(view.getByTestId("workspace")).toBeInTheDocument();
    expect(auth.loginWithWallet).toHaveBeenCalledTimes(1);
  });

  it("keeps a restored identity and does not later reopen Connect on sign-out", () => {
    auth.isReady = true;
    auth.isAuthenticated = true;
    const view = render(<Startup />);
    expect(view.getByTestId("workspace")).toBeInTheDocument();
    auth.isAuthenticated = false;
    view.rerender(<Startup />);
    expect(view.getByTestId("workspace")).toBeInTheDocument();
    expect(auth.loginWithWallet).not.toHaveBeenCalled();
  });

  it("loads ordinary saved-session startup eagerly before auth is ready", () => {
    const view = render(<Startup requested={false} />);
    expect(view.getByTestId("workspace")).toBeInTheDocument();
    expect(auth.loginWithWallet).not.toHaveBeenCalled();
  });

  it("allows passkey entry before readiness and cancels the queued wallet request", () => {
    const view = render(<Startup />);
    fireEvent.click(view.getByTestId("passkey-start-button"));
    expect(view.getByTestId("workspace")).toBeInTheDocument();
    auth.isReady = true;
    view.rerender(<Startup />);
    expect(auth.loginWithWallet).not.toHaveBeenCalled();
  });

  it("retains wallet retry and passkey entry when the modal never opens", () => {
    auth.isReady = true;
    const view = render(<Startup />);
    fireEvent.click(view.getByTestId("connect-wallet-button"));
    expect(auth.loginWithWallet).toHaveBeenCalledTimes(2);
    expect(view.queryByTestId("workspace")).toBeNull();
    fireEvent.click(view.getByTestId("passkey-start-button"));
    expect(view.getByTestId("workspace")).toBeInTheDocument();
  });
});
