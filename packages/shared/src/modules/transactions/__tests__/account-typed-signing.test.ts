/** @vitest-environment happy-dom */
import type { Config } from "@wagmi/core";
import { verifyTypedData } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";
import { describe, expect, it, vi } from "vitest";
import { createFakeSmartAccountClient } from "../../../__tests__/test-utils/transaction-fakes";
import { EmbeddedSender } from "../embedded-sender";
import { PasskeySender } from "../passkey-sender";
import type { AccountTypedDataRequest } from "../types";
import { WalletSender } from "../wallet-sender";

const ACCOUNT = "0x1111111111111111111111111111111111111111" as const;
const request: AccountTypedDataRequest = {
  account: ACCOUNT,
  chainId: sepolia.id,
  data: {
    domain: {
      name: "Account signing test",
      version: "1",
      chainId: sepolia.id,
      verifyingContract: ACCOUNT,
    },
    types: { Order: [{ name: "price", type: "uint256" }] },
    primaryType: "Order",
    message: { price: 5n },
  },
};

describe("typed-data signatures use the transaction account", () => {
  function passkey() {
    const client = createFakeSmartAccountClient({ accountAddress: ACCOUNT, chain: sepolia });
    const sign = vi.fn().mockResolvedValue("0x1234");
    client.account!.signTypedData = sign;
    const sender = new PasskeySender(client, { resolveSmartAccountClient: async () => client });
    return { client, sender, sign };
  }
  it("delegates the exact typed data to the chain-resolved smart account", async () => {
    const { sender, sign, client } = passkey();
    await expect(sender.signTypedData(request)).resolves.toBe("0x1234");
    expect(sign).toHaveBeenCalledExactlyOnceWith(request.data);
    expect(client.sendUserOperation).not.toHaveBeenCalled();
  });
  it("refuses another account or a mismatched domain before the passkey prompt", async () => {
    const { sender, sign } = passkey();
    await expect(
      sender.signTypedData({ ...request, account: "0x2222222222222222222222222222222222222222" })
    ).rejects.toThrow("address_mismatch");
    await expect(sender.signTypedData({ ...request, chainId: 42161 })).rejects.toThrow(
      "typed-data-chain-mismatch"
    );
    expect(sign).not.toHaveBeenCalled();
  });
  it("does not release a signature after the session changes during its prompt", async () => {
    const { sender, sign } = passkey();
    const assertOwnership = vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("submission-ownership-changed"));
    await expect(sender.signTypedData(request, { assertOwnership })).rejects.toThrow(
      "submission-ownership-changed"
    );
    expect(sign).toHaveBeenCalledOnce();
  });
  it("propagates a dismissed prompt without a transaction", async () => {
    const { sender, sign, client } = passkey();
    sign.mockRejectedValueOnce(new Error("Passkey prompt cancelled"));
    await expect(sender.signTypedData(request)).rejects.toThrow("cancelled");
    expect(client.sendUserOperation).not.toHaveBeenCalled();
  });
  it.each([
    "wallet",
    "embedded",
  ] as const)("signs the %s domain and checks ownership again after the prompt", async (mode) => {
    const account = privateKeyToAccount(generatePrivateKey()); // Ephemeral key, never written or printed.
    const signedFor = { ...request, account: account.address };
    let connected = account.address;
    const signTypedData = vi.fn(async (_config, input: AccountTypedDataRequest) =>
      account.signTypedData(input.data)
    );
    const deps = {
      signTypedData,
      getAccount: () => ({ address: connected }),
      ensureWalletChain: vi.fn(),
      assertWriteSafety: vi.fn(),
      waitForTransactionReceipt: vi.fn(),
      writeContract: vi.fn(),
    };
    const sender =
      mode === "wallet"
        ? new WalletSender({} as Config, vi.fn(), undefined, deps)
        : new EmbeddedSender({} as Config, undefined, deps);
    const signature = await sender.signTypedData(signedFor);
    expect(await verifyTypedData({ ...request.data, address: account.address, signature })).toBe(
      true
    );
    expect(deps.ensureWalletChain).toHaveBeenCalledWith(sepolia.id, "write", expect.any(Function));
    signTypedData.mockImplementationOnce(async () => {
      connected = ACCOUNT;
      return signature;
    });
    await expect(sender.signTypedData(signedFor)).rejects.toThrow();
    expect(deps.writeContract).not.toHaveBeenCalled();
  });
});
