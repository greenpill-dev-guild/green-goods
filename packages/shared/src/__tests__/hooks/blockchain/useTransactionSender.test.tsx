/** @vitest-environment happy-dom */
import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { arbitrum, celo } from "viem/chains";

const account = "0x1111111111111111111111111111111111111111" as const;
const other = "0x2222222222222222222222222222222222222222" as const;
const mocks = vi.hoisted(() => ({
  user: {} as Record<string, unknown>,
  resolver: vi.fn(),
  wallet: vi.fn(),
  account: vi.fn(),
}));

vi.mock("../../../hooks/auth/useUser", () => ({ useUser: () => mocks.user }));
vi.mock("wagmi", () => ({
  useConfig: () => ({}),
  useWriteContract: () => ({ writeContractAsync: vi.fn() }),
}));
vi.mock("@wagmi/core", async (importOriginal) => ({
  ConnectorNotConnectedError: (await importOriginal<typeof import("@wagmi/core")>())
    .ConnectorNotConnectedError,
  getWalletClient: (...args: unknown[]) => mocks.wallet(...args),
  getAccount: (...args: unknown[]) => mocks.account(...args),
}));
vi.mock("../../../modules/transactions/factory", () => ({
  createTransactionSender: () => ({ authMode: "passkey", sendContractCall: vi.fn() }),
}));

import { useTransactionSender } from "../../../hooks/blockchain/useTransactionSender";

describe("useTransactionSender ownership", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolver.mockImplementation(async (chainId: number) => ({
      account: { address: account },
      chain: chainId === 42220 ? celo : arbitrum,
    }));
    mocks.user = {
      authMode: "passkey",
      primaryAddress: account,
      smartAccountClient: { account: { address: account }, chain: arbitrum },
      resolveSmartAccountClient: mocks.resolver,
    };
    mocks.wallet.mockResolvedValue({ account: { address: account } });
    mocks.account.mockReturnValue({ chainId: 42220 });
  });

  it("accepts a same-account Celo job while the primary client is Arbitrum", async () => {
    const { result } = renderHook(() => useTransactionSender());
    await expect(result.current!.assertOwnership!(account, 42220)).resolves.toBeUndefined();
    expect(mocks.resolver).toHaveBeenCalledWith(42220);
  });

  it("rejects a Celo resolver that returns another address", async () => {
    mocks.resolver.mockResolvedValue({ account: { address: other }, chain: celo });
    const { result } = renderHook(() => useTransactionSender());
    await expect(result.current!.assertOwnership!(account, 42220)).rejects.toThrow(
      "submission-ownership-changed"
    );
  });

  it("rejects an unsupported chain before resolving a client", async () => {
    const { result } = renderHook(() => useTransactionSender());
    await expect(result.current!.assertOwnership!(account, 123456)).rejects.toThrow(
      "submission-ownership-changed"
    );
    expect(mocks.resolver).not.toHaveBeenCalled();
  });
});

describe("useTransactionSender wallet ownership", () => {
  // A live connector, as wagmi holds it once the wallet is connected.
  const connector = { getChainId: async () => 42220 };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.user = { authMode: "wallet", primaryAddress: account };
    // A wallet left on Celo, as on 2026-10-01: wagmi refuses a wallet client
    // for any other network.
    mocks.account.mockReturnValue({ address: account, chainId: 42220, connector });
    mocks.wallet.mockRejectedValue(
      Object.assign(new Error("The current chain of the connector does not match"), {
        name: "ConnectorChainMismatchError",
      })
    );
  });

  it("accepts an Arbitrum job from the same wallet while it sits on Celo, leaving the switch to the sender", async () => {
    const { result } = renderHook(() => useTransactionSender());
    await expect(result.current!.assertOwnership!(account, 42161)).resolves.toBeUndefined();
    // Who signs needs no wallet client, and a wallet client is refused on another network.
    expect(mocks.wallet).not.toHaveBeenCalled();
  });

  it("rejects the job when the wallet now signs as another account", async () => {
    mocks.account.mockReturnValue({ address: other, chainId: 42161, connector });
    const { result } = renderHook(() => useTransactionSender());
    await expect(result.current!.assertOwnership!(account, 42161)).rejects.toThrow(
      "submission-ownership-changed"
    );
  });

  it("fails as a wallet to reconnect, not as a job to skip, when the wallet dropped or is still reconnecting", async () => {
    // The member stays signed in while the wallet is away.
    mocks.account.mockReturnValue({ address: undefined, connector: undefined });
    const { result } = renderHook(() => useTransactionSender());
    await expect(result.current!.assertOwnership!(account, 42161)).rejects.toThrow(
      "Connector not connected"
    );

    // While wagmi reconnects, the connector is a stored stub that cannot be asked anything.
    mocks.account.mockReturnValue({ address: account, connector: { id: "walletConnect" } });
    await expect(result.current!.assertOwnership!(account, 42161)).rejects.toThrow(
      "Connector not connected"
    );
  });
});
