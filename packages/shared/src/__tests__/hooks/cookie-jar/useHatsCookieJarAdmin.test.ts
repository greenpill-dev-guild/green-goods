// @vitest-environment happy-dom

import { QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { IntlProvider } from "react-intl";
import { keccak256, toHex, zeroHash } from "viem";
import { beforeEach, expect, it, vi } from "vitest";
import { useHatsCookieJarAdmin } from "../../../hooks/cookie-jar/useHatsCookieJarAdmin";
import type { CookieJar } from "../../../types/cookie-jar";
import { createTestQueryClient } from "../../test-utils/query-client";

const garden = "0x1111111111111111111111111111111111111111";
const jarAddress = "0x2222222222222222222222222222222222222222";
const asset = "0x3333333333333333333333333333333333333333";
const account = "0x4444444444444444444444444444444444444444";
const recovery = "0x5555555555555555555555555555555555555555";
const factory = "0x6666666666666666666666666666666666666666";
const policy = [20n, 86_400n, 100n, recovery] as const;
const jar: CookieJar = {
  gardenAddress: garden,
  jarAddress,
  assetAddress: asset,
  currency: asset,
  balance: 15n,
  decimals: 6,
  maxWithdrawal: 10n,
  withdrawalInterval: 86_400n,
  minDeposit: 0n,
  isPaused: false,
  emergencyWithdrawalEnabled: true,
};

const mocks = vi.hoisted(() => ({
  readContract: vi.fn(),
  simulateContract: vi.fn(),
  getTransactionReceipt: vi.fn(),
  sendContractCall: vi.fn(),
  assertOwnership: vi.fn(),
  refetch: vi.fn(),
  error: vi.fn(),
}));

vi.mock("wagmi", () => ({
  usePublicClient: () => mocks,
  useReadContracts: ({ contracts }: { contracts: { functionName: string }[] }) => ({
    refetch: mocks.refetch,
    data:
      contracts[0]?.functionName === "FAMILY"
        ? [{ result: keccak256(toHex("GREEN_GOODS_GARDEN_COOKIE_JAR")) }, { result: 1n }, {}]
        : [true, false, policy, policy, 0n, zeroHash],
  }),
}));
vi.mock("../../../hooks/auth/usePrimaryAddress", () => ({ usePrimaryAddress: () => account }));
vi.mock("../../../hooks/blockchain/useChainConfig", () => ({ useCurrentChain: () => 42161 }));
vi.mock("../../../hooks/blockchain/useTransactionSender", () => ({
  useTransactionSender: () => mocks,
}));
vi.mock("../../../components/toast", () => ({ toastService: { success: vi.fn() } }));
vi.mock("../../../utils/errors/mutation-error-handler", () => ({
  createMutationErrorHandler: () => mocks.error,
}));

function setup() {
  const client = createTestQueryClient();
  return renderHook(() => useHatsCookieJarAdmin(jar), {
    wrapper: ({ children }: { children: ReactNode }) =>
      createElement(
        QueryClientProvider,
        { client },
        createElement(
          IntlProvider,
          {
            locale: "en",
            messages: { "app.cookieJar.hats.submitted": "Submitted" },
          },
          children
        )
      ),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.readContract.mockImplementation(async ({ functionName }) => {
    switch (functionName) {
      case "getGardenJar":
        return jarAddress;
      case "hatsJarFactory":
        return factory;
      case "isFactoryJar":
      case "isOperator":
        return true;
      case "isOwner":
        return false;
      case "policy":
        return policy;
      default:
        throw Error("Unexpected read");
    }
  });
  mocks.simulateContract.mockResolvedValue({});
  mocks.sendContractCall.mockResolvedValue({ hash: zeroHash });
});

it("signs the paired limits directly from the current steward on the jar chain", async () => {
  const { result } = setup();
  expect(result.current).toMatchObject({ kind: "hats", canOperate: true, canGovern: false });
  await act(async () => {
    await result.current.mutation.mutateAsync({
      functionName: "setOperationalLimits",
      args: [12n, 86_400n],
    });
  });
  expect(mocks.simulateContract).toHaveBeenCalledWith(
    expect.objectContaining({ address: jarAddress, account })
  );
  expect(mocks.sendContractCall).toHaveBeenCalledWith(
    expect.objectContaining({
      address: jarAddress,
      account,
      chainId: 42161,
      functionName: "setOperationalLimits",
      args: [12n, 86_400n],
    }),
    expect.objectContaining({ assertOwnership: expect.any(Function) })
  );
});

it("blocks an owner-only write by a steward before asking for a signature", async () => {
  const { result } = setup();
  await act(async () => {
    await expect(
      result.current.mutation.mutateAsync({ functionName: "unpause", args: [] })
    ).rejects.toThrow("permission changed");
  });
  expect(mocks.sendContractCall).not.toHaveBeenCalled();
});

it("blocks a recovery when the current recipient differs from the confirmed recipient", async () => {
  const read = mocks.readContract.getMockImplementation()!;
  mocks.readContract.mockImplementation((request) =>
    request.functionName === "isOwner" ? Promise.resolve(true) : read(request)
  );
  const { result } = setup();
  await act(async () => {
    await expect(
      result.current.mutation.mutateAsync({
        functionName: "emergencyWithdraw",
        args: [1n],
        recipient: account,
      })
    ).rejects.toThrow("recipient changed");
  });
  expect(mocks.simulateContract).not.toHaveBeenCalled();
  expect(mocks.sendContractCall).not.toHaveBeenCalled();
});

it("leaves stale or rejected chain state unsent even if the cached role allowed it", async () => {
  mocks.simulateContract.mockRejectedValueOnce(Error("NotOperator"));
  const { result } = setup();
  await act(async () => {
    await expect(
      result.current.mutation.mutateAsync({ functionName: "pause", args: [] })
    ).rejects.toThrow("NotOperator");
  });
  expect(mocks.sendContractCall).not.toHaveBeenCalled();
});

it("holds a pending send and reconciles its receipt before allowing another write", async () => {
  mocks.sendContractCall.mockResolvedValueOnce({ hash: zeroHash, confirmation: "pending" });
  const { result } = setup();
  await act(async () => {
    await result.current.mutation.mutateAsync({ functionName: "pause", args: [] });
  });
  expect(result.current.canOperate).toBe(false);
  await act(async () => {
    await expect(
      result.current.mutation.mutateAsync({ functionName: "pause", args: [] })
    ).rejects.toThrow("already pending");
  });
  expect(mocks.sendContractCall).toHaveBeenCalledTimes(1);
  mocks.getTransactionReceipt.mockResolvedValueOnce({
    status: "success",
    transactionHash: zeroHash,
  });
  await act(async () => {
    await result.current.confirmation.mutateAsync();
  });
  expect(result.current.submission).toBeUndefined();
  expect(result.current.canOperate).toBe(true);
});
