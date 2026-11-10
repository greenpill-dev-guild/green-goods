// @vitest-environment happy-dom

import { QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { IntlProvider } from "react-intl";
import {
  ContractFunctionExecutionError,
  ContractFunctionRevertedError,
  encodeErrorResult,
  keccak256,
  parseAbi,
  toHex,
  zeroHash,
} from "viem";
import { beforeEach, expect, it, vi } from "vitest";
import { useHatsCookieJarAdmin } from "../../../hooks/cookie-jar/useHatsCookieJarAdmin";
import enMessages from "../../../i18n/en.json";
import esMessages from "../../../i18n/es.json";
import { TransactionRevertedError } from "../../../modules/transactions/types";
import { useHatsJarSubmissionStore } from "../../../stores/useHatsJarSubmissionStore";
import type { CookieJar } from "../../../types/cookie-jar";
import { JarReviewChangedError } from "../../../utils/errors/hats-cookie-jar-errors";
import { createTestQueryClient } from "../../test-utils/query-client";

const en: Record<string, string> = enMessages;
const es: Record<string, string> = esMessages;
const garden = "0x1111111111111111111111111111111111111111";
const jarAddress = "0x2222222222222222222222222222222222222222";
const asset = "0x3333333333333333333333333333333333333333";
const account = "0x4444444444444444444444444444444444444444";
const recovery = "0x5555555555555555555555555555555555555555";
const factory = "0x6666666666666666666666666666666666666666";
const sentHash = keccak256(toHex("sent recovery"));
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
const SUBMISSIONS = "green-goods:hats-jar-submissions";

const mocks = vi.hoisted(() => ({
  roles: { operator: true, owner: false },
  readContract: vi.fn(),
  simulateContract: vi.fn(),
  getTransactionReceipt: vi.fn(),
  sendContractCall: vi.fn(),
  assertOwnership: vi.fn(),
  refetch: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("wagmi", () => ({
  usePublicClient: () => mocks,
  useReadContracts: ({ contracts }: { contracts: { functionName: string }[] }) => ({
    refetch: mocks.refetch,
    data:
      contracts[0]?.functionName === "FAMILY"
        ? [{ result: keccak256(toHex("GREEN_GOODS_GARDEN_COOKIE_JAR")) }, { result: 1n }, {}]
        : [mocks.roles.operator, mocks.roles.owner, policy, policy, 0n, zeroHash],
  }),
}));
vi.mock("../../../hooks/auth/usePrimaryAddress", () => ({ usePrimaryAddress: () => account }));
vi.mock("../../../hooks/blockchain/useChainConfig", () => ({ useCurrentChain: () => 42161 }));
vi.mock("../../../hooks/blockchain/useTransactionSender", () => ({
  useTransactionSender: () => mocks,
}));
vi.mock("../../../components/toast", () => ({
  toastService: { success: vi.fn(), error: mocks.toastError },
  walletProgressToasts: { error: vi.fn() },
}));
vi.mock("../../../modules/app/error-tracking", () => ({ trackContractError: vi.fn() }));

function setup(locale: "en" | "es" = "en") {
  const client = createTestQueryClient();
  return renderHook(() => useHatsCookieJarAdmin(jar), {
    wrapper: ({ children }: { children: ReactNode }) =>
      createElement(
        QueryClientProvider,
        { client },
        createElement(IntlProvider, { locale, messages: locale === "es" ? es : en }, children)
      ),
  });
}

/** What the steward read in each error toast: title, message and the suggested next step. */
const toastCopy = () =>
  mocks.toastError.mock.calls.map(([toast]) => [toast.title, toast.message, toast.description]);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.roles.operator = true;
  mocks.roles.owner = false;
  sessionStorage.clear();
  useHatsJarSubmissionStore.setState({ pending: {} });
  mocks.readContract.mockImplementation(async ({ functionName }) => {
    switch (functionName) {
      case "getGardenJar":
        return jarAddress;
      case "hatsJarFactory":
        return factory;
      case "isFactoryJar":
        return true;
      case "isOperator":
        return mocks.roles.operator;
      case "isOwner":
        return mocks.roles.owner;
      case "policy":
        return policy;
      case "pendingPolicyHash":
        return zeroHash;
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

it.each([
  {
    change: "jarOrHat",
    owner: false,
    action: { functionName: "unpause", args: [] },
    messageKey: "app.errors.hatsJar.jarOrHatChanged.message",
  },
  {
    change: "recipient",
    owner: true,
    action: { functionName: "emergencyWithdraw", args: [1n], recipient: account },
    messageKey: "app.errors.hatsJar.recipientChanged.message",
  },
  {
    // The reviewed policy was canceled on chain, so nothing is pending any more.
    change: "pendingPolicy",
    owner: true,
    action: { functionName: "executePolicy", args: [keccak256(toHex("reviewed policy"))] },
    messageKey: "app.errors.hatsJar.policyChanged.message",
  },
] as const)("refuses a review whose $change changed, sends nothing, and refreshes the jar", async ({
  change,
  owner,
  action,
  messageKey,
}) => {
  mocks.roles.owner = owner;
  const { result } = setup();
  await act(async () => {
    const refused = result.current.mutation.mutateAsync(action);
    await expect(refused).rejects.toBeInstanceOf(JarReviewChangedError);
    await expect(refused).rejects.toMatchObject({ change });
  });
  expect(mocks.simulateContract).not.toHaveBeenCalled();
  expect(mocks.sendContractCall).not.toHaveBeenCalled();
  expect(toastCopy()).toEqual([
    [
      en["app.errors.hatsJar.outOfDate.title"],
      en[messageKey],
      en["app.errors.hatsJar.outOfDate.action"],
    ],
  ]);
  // The reopened review must show what the jar holds now, not the cached policy.
  expect(mocks.refetch).toHaveBeenCalled();
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

it("explains a jar refusal and an unknown failure in the steward's language", async () => {
  mocks.roles.owner = true;
  const jarErrors = parseAbi(["error NotOwner()"]);
  mocks.simulateContract.mockRejectedValueOnce(
    new ContractFunctionExecutionError(
      new ContractFunctionRevertedError({
        abi: jarErrors,
        data: encodeErrorResult({ abi: jarErrors, errorName: "NotOwner" }),
        functionName: "unpause",
      }),
      {
        abi: jarErrors,
        functionName: "unpause",
        args: [],
        contractAddress: jarAddress,
        sender: account,
      }
    )
  );
  mocks.sendContractCall.mockRejectedValueOnce(Error("Unrecognized wallet response"));
  const { result } = setup("es");
  await act(async () => {
    const unpause = { functionName: "unpause", args: [] } as const;
    await expect(result.current.mutation.mutateAsync(unpause)).rejects.toThrow("NotOwner");
    await expect(result.current.mutation.mutateAsync(unpause)).rejects.toThrow("Unrecognized");
  });
  expect(toastCopy()).toEqual([
    [
      es["app.errors.hatsJar.refused.title"],
      es["app.errors.hatsJar.notOwner.message"],
      es["app.errors.hatsJar.wearer.action"],
    ],
    [es["app.txFeedback.failed.title"], es["app.errors.blockchain.unknown.message"], undefined],
  ]);
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

it("keeps a pending recovery locked across a reload until its receipt reconciles", async () => {
  mocks.roles.owner = true;
  const recover = { functionName: "emergencyWithdraw", args: [1n], recipient: recovery } as const;
  mocks.sendContractCall.mockResolvedValueOnce({ hash: sentHash, confirmation: "pending" });
  const first = setup();
  await act(async () => {
    await first.result.current.mutation.mutateAsync(recover);
  });
  first.unmount();

  // A reload keeps only what this tab session saved, under the signer, chain and jar.
  const saved = sessionStorage.getItem(SUBMISSIONS)!;
  expect(Object.keys(JSON.parse(saved).state.pending)).toEqual([`42161:${account}:${jarAddress}`]);
  useHatsJarSubmissionStore.setState({ pending: {} });
  sessionStorage.setItem(SUBMISSIONS, saved);
  await useHatsJarSubmissionStore.persist.rehydrate();

  const { result } = setup();
  expect(result.current).toMatchObject({
    submission: { hash: sentHash, confirmation: "pending" },
    canOperate: false,
    canGovern: false,
  });
  await act(async () => {
    await expect(result.current.mutation.mutateAsync(recover)).rejects.toThrow("already pending");
  });
  expect(mocks.sendContractCall).toHaveBeenCalledTimes(1);

  mocks.getTransactionReceipt.mockResolvedValueOnce({
    status: "reverted",
    transactionHash: sentHash,
  });
  await act(async () => {
    await expect(result.current.confirmation.mutateAsync()).rejects.toBeInstanceOf(
      TransactionRevertedError
    );
  });
  expect(result.current.submission).toBeUndefined();
  expect(result.current.canGovern).toBe(true);
});
