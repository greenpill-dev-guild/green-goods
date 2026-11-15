/**
 * @vitest-environment happy-dom
 *
 * PRD-1499: the App opens on a remembered wallet account before its wallet
 * answers, so this prompt is where the person learns the wallet is missing.
 */

import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { WalletRestoreState } from "../../../types/auth";

const mocks = vi.hoisted(() => ({
  state: { walletRestore: null as WalletRestoreState | null },
  loginWithWallet: vi.fn(),
  info: vi.fn(),
  dismiss: vi.fn(),
  track: vi.fn(),
}));

vi.mock("../../../modules/app/authWalletRestoreAnalytics", () => ({
  trackAuthWalletRestore: (...args: unknown[]) => mocks.track(...args),
}));

vi.mock("../../../components/toast", () => ({
  toastService: {
    info: (...args: unknown[]) => mocks.info(...args),
    dismiss: (...args: unknown[]) => mocks.dismiss(...args),
  },
}));

vi.mock("../../../hooks/auth/useAuthContext", () => ({
  useAuthState: () => mocks.state,
  useAuthActions: () => ({ loginWithWallet: mocks.loginWithWallet }),
}));

import { useWalletReconnectPrompt } from "../../../hooks/auth/useWalletReconnectPrompt";
import { refuseWithoutWallet } from "../../../modules/auth/wallet-reconnect";
import { WalletReconnectRequiredError } from "../../../utils/errors/unsent-failures";
import { createIntlWrapper } from "../../test-utils/render-helpers";

function renderPrompt(walletRestore: WalletRestoreState | null) {
  mocks.state.walletRestore = walletRestore;
  return renderHook(() => useWalletReconnectPrompt(), { wrapper: createIntlWrapper() });
}

function setWalletRestore(view: ReturnType<typeof renderPrompt>, next: WalletRestoreState | null) {
  mocks.state.walletRestore = next;
  view.rerender();
}

describe("useWalletReconnectPrompt", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("says once that the wallet did not answer when the restore window ends", () => {
    const view = renderPrompt("restoring");
    expect(mocks.info).not.toHaveBeenCalled();

    setWalletRestore(view, "failed");
    setWalletRestore(view, "failed");

    expect(mocks.info).toHaveBeenCalledTimes(1);
    expect(mocks.info).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "wallet-reconnect",
        title: "Your wallet didn't answer",
        message:
          "You're still signed in. Reconnect your wallet when you're ready to send something.",
        persistent: true,
        action: expect.objectContaining({ label: "Reconnect" }),
      })
    );
  });

  it("asks to reconnect when an act that needs the wallet is refused, and Reconnect opens the wallet", () => {
    renderPrompt("restoring");

    expect(() => refuseWithoutWallet()).toThrow(WalletReconnectRequiredError);

    expect(mocks.track).toHaveBeenCalledWith({ authMode: "wallet", outcome: "act_refused" });
    expect(mocks.info).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "wallet-reconnect",
        title: "Your wallet isn't connected",
        message: "Nothing was sent. Reconnect your wallet, then try again.",
      })
    );
    mocks.info.mock.calls[0][0].action.onClick();
    expect(mocks.loginWithWallet).toHaveBeenCalledTimes(1);
  });

  it("takes the ask away once the wallet answers", () => {
    const view = renderPrompt("failed");
    expect(mocks.info).toHaveBeenCalledTimes(1);

    setWalletRestore(view, null);

    expect(mocks.dismiss).toHaveBeenCalledWith("wallet-reconnect");
  });

  it("tells the refused act nobody asked when no prompt is mounted", () => {
    const view = renderPrompt(null);
    let refusal: unknown;
    try {
      refuseWithoutWallet();
    } catch (error) {
      refusal = error;
    }
    expect(refusal).toMatchObject({ asked: true });

    view.unmount();
    try {
      refuseWithoutWallet();
    } catch (error) {
      refusal = error;
    }
    expect(refusal).toMatchObject({ asked: false });
  });
});
