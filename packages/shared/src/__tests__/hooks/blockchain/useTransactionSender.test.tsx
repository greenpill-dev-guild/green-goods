/** @vitest-environment jsdom */
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
vi.mock("@wagmi/core", () => ({
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
