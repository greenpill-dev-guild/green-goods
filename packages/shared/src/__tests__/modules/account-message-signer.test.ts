import { describe, expect, it, vi } from "vitest";
import {
  createAccountMessageSigner,
  resolveAccountFactoryArgs,
} from "../../modules/auth/account-message-signer";
import type { Address } from "../../types/domain";
import { WalletReconnectRequiredError } from "../../utils/errors/unsent-failures";

const address = "0x1234567890abcdef1234567890abcdef12345678" as Address;

describe("account message signing", () => {
  it("fails without falling back to another wallet when the smart account signer is missing", async () => {
    const signMessage = vi.fn();
    await expect(
      createAccountMessageSigner({ authMode: "passkey", signMessage })("message")
    ).rejects.toThrow("Reconnect your passkey account");
    await expect(
      createAccountMessageSigner({ authMode: "openfort", signMessage })("message")
    ).rejects.toThrow("Sign in with your email again");
    expect(signMessage).not.toHaveBeenCalled();
  });

  it("propagates passkey rejection without signing through a different account", async () => {
    const signMessage = vi.fn();
    const account = { signMessage: vi.fn().mockRejectedValue(new Error("User rejected")) };
    await expect(
      createAccountMessageSigner({ authMode: "passkey", signMessage, account })("message")
    ).rejects.toThrow("User rejected");
    expect(signMessage).not.toHaveBeenCalled();
  });

  it("uses a complete explicit factory pair without consulting the account", async () => {
    const account = { getFactoryArgs: vi.fn() };
    const explicit = { factory: address, factoryData: "0x1234" as const };
    await expect(resolveAccountFactoryArgs(account, explicit)).resolves.toEqual(explicit);
    expect(account.getFactoryArgs).not.toHaveBeenCalled();
  });

  it("does not combine incomplete factory pairs from different sources", async () => {
    const account = { getFactoryArgs: vi.fn().mockResolvedValue({ factoryData: "0x1234" }) };
    await expect(resolveAccountFactoryArgs(account, { factory: address })).resolves.toBeUndefined();
    await expect(resolveAccountFactoryArgs()).resolves.toBeUndefined();
  });

  // PRD-1499: the App opens on a remembered wallet account before its wallet answers.
  it("asks a wallet account to reconnect instead of signing while its wallet has not answered", async () => {
    const signMessage = vi.fn().mockResolvedValue("0xwallet");
    await expect(
      createAccountMessageSigner({ authMode: "wallet", walletRestore: "failed", signMessage })(
        "message"
      )
    ).rejects.toBeInstanceOf(WalletReconnectRequiredError);
    expect(signMessage).not.toHaveBeenCalled();
  });

  it("uses the wagmi signer for wallet and embedded accounts", async () => {
    const signMessage = vi.fn().mockResolvedValue("0xwallet");
    await expect(
      createAccountMessageSigner({ authMode: "wallet", signMessage })("message")
    ).resolves.toBe("0xwallet");
    await expect(
      createAccountMessageSigner({ authMode: "embedded", signMessage })("message")
    ).resolves.toBe("0xwallet");
    expect(signMessage).toHaveBeenCalledTimes(2);
  });

  it("uses passkey signing and obtains paired counterfactual factory arguments", async () => {
    const account = {
      signMessage: vi.fn().mockResolvedValue("0xpasskey"),
      getFactoryArgs: vi.fn().mockResolvedValue({ factory: address, factoryData: "0x1234" }),
    };
    const signMessage = vi.fn();
    await expect(
      createAccountMessageSigner({ authMode: "passkey", signMessage, account })("message")
    ).resolves.toBe("0xpasskey");
    await expect(resolveAccountFactoryArgs(account)).resolves.toEqual({
      factory: address,
      factoryData: "0x1234",
    });
    expect(signMessage).not.toHaveBeenCalled();
  });
});
