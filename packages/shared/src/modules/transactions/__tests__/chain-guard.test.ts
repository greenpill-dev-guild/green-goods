import { describe, expect, it, vi } from "vitest";
import { ensureWalletChain, WalletChainMismatchError } from "../chain-guard";

describe("ensureWalletChain", () => {
  it("does nothing when the connected wallet already matches the target chain", async () => {
    const switchChain = vi.fn();

    await ensureWalletChain({
      targetChainId: 42161,
      walletChainId: 42161,
      isConnected: true,
      switchChain,
    });

    expect(switchChain).not.toHaveBeenCalled();
  });

  it("switches the connected wallet when it is on the wrong chain", async () => {
    const switchChain = vi.fn().mockResolvedValue({ id: 42161 });

    await ensureWalletChain({
      targetChainId: 42161,
      walletChainId: 1,
      isConnected: true,
      switchChain,
    });

    expect(switchChain).toHaveBeenCalledWith({ chainId: 42161 });
  });

  it("does not switch when no wallet is connected", async () => {
    const switchChain = vi.fn();

    await ensureWalletChain({
      targetChainId: 42161,
      walletChainId: undefined,
      isConnected: false,
      switchChain,
    });

    expect(switchChain).not.toHaveBeenCalled();
  });

  it("throws a wrong-chain error when the user rejects the switch", async () => {
    const switchChain = vi.fn().mockRejectedValue({ code: 4001 });

    await expect(
      ensureWalletChain({
        targetChainId: 42161,
        walletChainId: 1,
        isConnected: true,
        switchChain,
      })
    ).rejects.toMatchObject({
      name: "WalletChainMismatchError",
      targetChainId: 42161,
      walletChainId: 1,
    });
  });

  it("throws a wrong-chain error when no switch function is available", async () => {
    await expect(
      ensureWalletChain({
        targetChainId: 42161,
        walletChainId: 1,
        isConnected: true,
      })
    ).rejects.toBeInstanceOf(WalletChainMismatchError);
  });
});
