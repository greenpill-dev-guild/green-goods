/**
 * The cookie jar deposit hook and its form plan on a listed rail.
 * @vitest-environment happy-dom
 */

import "fake-indexeddb/auto";
import { act, waitFor } from "@testing-library/react";
import { encodeAbiParameters, encodeEventTopics, type Log, parseAbi, toHex } from "viem";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { queryKeys } from "../../../config/query-keys";
import { batchKeys } from "../../../config/query-keys/garden";
import { useCookieJarDeposit } from "../../../hooks/cookie-jar/useCookieJarDeposit";
import { useDepositPlan } from "../../../hooks/vault/useDepositPlan";
import type { DepositTarget } from "../../../modules/garden/deposit-batch";
import type { BatchExecution } from "../../../modules/transactions/batch-types";
import { BatchNotSubmittedError } from "../../../modules/transactions/batch-types";
import type { Address } from "../../../types/domain";
import { classifyTxError, isUnconfirmedTxError } from "../../../utils/errors/tx-error-classifier";
import { createTestQueryClient } from "../../test-utils/query-client";
import { renderHookWithProviders } from "../../test-utils/render-helpers";
import { createFakeBatchingSender } from "../../test-utils/transaction-fakes";

const { auth, chainState, sending, toasts, listing } = vi.hoisted(() => ({
  auth: { primaryAddress: null as string | null, passkeyAccountProfile: "kernel-0.3.1-legacy" },
  chainState: { allowance: 0n, held: 250n as bigint | null, logs: [] as Partial<Log>[] },
  sending: { sender: null as unknown },
  toasts: { success: vi.fn(), info: vi.fn(), error: vi.fn(), loading: vi.fn(), dismiss: vi.fn() },
  listing: { enabled: true, walletProfile: "eip-5792" },
}));

vi.mock("../../../hooks/blockchain/useTransactionSender", () => ({
  useTransactionSender: () => sending.sender,
}));
vi.mock("../../../hooks/auth/useUser", () => ({ useUser: () => auth }));
vi.mock("../../../hooks/blockchain/useChainConfig", () => ({ useCurrentChain: () => 42161 }));
vi.mock("wagmi", () => ({ useAccount: () => ({ connector: { uid: "test-wallet" } }) }));
vi.mock("../../../components/toast", () => ({ toastService: toasts }));
vi.mock("../../../config/appkit", () => ({ getWagmiConfig: () => ({}) }));
vi.mock("../../../utils/errors/mutation-error-handler", () => ({
  createMutationErrorHandler: () => vi.fn(),
}));
vi.mock("../../../modules/transactions/batch-enablement", () => ({
  isBatchEnabled: (query: { rail: string; profile: string }) =>
    listing.enabled && (query.rail === "passkey" || query.profile === listing.walletProfile),
}));
vi.mock("@wagmi/core", () => ({
  readContract: vi.fn(async (_config, { functionName }: { functionName: string }) => {
    if (functionName === "balanceOf") return 10_000n;
    if (functionName === "allowance") return chainState.allowance;
    if (functionName === "currencyHeldByJar") {
      if (chainState.held === null) throw new Error("rpc down");
      return chainState.held;
    }
    return 1n;
  }),
  getTransactionReceipt: vi.fn(async () => ({ logs: chainState.logs })),
}));

const hash = `0x${"ab".repeat(32)}` as const;
const CONFIRMED: Partial<BatchExecution> = {
  status: "confirmed",
  receipts: [{ transactionHash: hash, status: "success" }],
};
const EVENTS = parseAbi([
  "event Deposit(address indexed depositor, uint256 amount, address indexed token)",
  "event Approval(address indexed owner, address indexed spender, uint256 value)",
]);
const randomAddress = (): Address => toHex(crypto.getRandomValues(new Uint8Array(20)));

function setup(
  execution: Partial<BatchExecution> = {},
  authMode: "passkey" | "wallet" = "passkey"
) {
  const account = randomAddress();
  const jar = randomAddress();
  const asset = randomAddress();
  const garden = randomAddress();
  const sender = createFakeBatchingSender(account, execution);
  Object.assign(sender, { authMode });
  auth.primaryAddress = account;
  sending.sender = sender;
  const queryClient = createTestQueryClient();
  // Nothing observes these in the hook's own tests, and the test client collects at once.
  queryClient.setDefaultOptions({ queries: { retry: false, gcTime: Number.POSITIVE_INFINITY } });
  const target: DepositTarget = { kind: "jar", address: jar, asset };
  const deposit = { jarAddress: jar, assetAddress: asset, amount: 100n };
  const depositLog: Partial<Log> = {
    address: jar,
    topics: encodeEventTopics({
      abi: EVENTS,
      eventName: "Deposit",
      args: { depositor: account, token: asset },
    }) as Log["topics"],
    data: encodeAbiParameters([{ type: "uint256" }], [100n]),
  };
  const approvalLog: Partial<Log> = {
    address: asset,
    topics: encodeEventTopics({
      abi: EVENTS,
      eventName: "Approval",
      args: { owner: account, spender: jar },
    }) as Log["topics"],
    data: encodeAbiParameters([{ type: "uint256" }], [100n]),
  };
  const renderDeposit = (errorMode: "inline" | "toast" = "inline") =>
    renderHookWithProviders(() => useCookieJarDeposit(garden, { errorMode }), { queryClient });
  const renderPlan = (gardenAddress?: string) =>
    renderHookWithProviders(
      () => useDepositPlan({ target, amount: 100n, decimals: 0, symbol: "DAI", gardenAddress }),
      { queryClient }
    );
  return {
    account,
    jar,
    garden,
    sender,
    queryClient,
    deposit,
    depositLog,
    approvalLog,
    renderDeposit,
    renderPlan,
  };
}

describe("useCookieJarDeposit on a listed rail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listing.enabled = true;
    listing.walletProfile = "eip-5792";
    chainState.allowance = 0n;
    chainState.held = 250n;
    chainState.logs = [];
  });

  it("sends one request and returns its transaction once the jar's event proves it", async () => {
    const { sender, deposit, depositLog, approvalLog, renderDeposit } = setup(CONFIRMED);
    chainState.logs = [approvalLog, depositLog];
    const { result } = renderDeposit();

    await act(async () => {
      await expect(result.current.mutateAsync(deposit)).resolves.toBe(hash);
    });

    expect(sender.submitAtomicBatch).toHaveBeenCalledOnce();
    expect(sender.sendContractCall).not.toHaveBeenCalled();
    expect(toasts.success).toHaveBeenCalledOnce();
  });

  it("keeps today's flow while nothing is listed, and asks no wallet anything", async () => {
    listing.enabled = false;
    const { sender, deposit, renderDeposit } = setup(CONFIRMED, "wallet");
    chainState.allowance = 100n;
    const execute = vi.spyOn(sender.batches!, "execute");
    const { result } = renderDeposit();

    await act(async () => {
      await result.current.mutateAsync(deposit);
    });

    expect(execute).not.toHaveBeenCalled();
    expect(sender.submitAtomicBatch).not.toHaveBeenCalled();
    expect(sender.sendContractCall).toHaveBeenCalledOnce();
    expect(sender.getBatchCapability).not.toHaveBeenCalled();
  });

  it("goes one step at a time on a plain wallet, through the same journal", async () => {
    listing.walletProfile = "sequential";
    const { sender, deposit, depositLog, renderDeposit } = setup(CONFIRMED, "wallet");
    vi.mocked(sender.getBatchCapability!).mockImplementation(async (scope) => ({
      ...scope,
      atomic: "unsupported",
    }));
    // A wallet pays its own way, which is what its ceilings expect.
    sender.preflightBatch = async () => ({
      gas: "100000",
      maxFeePerGas: "100000000",
      maxFee: "10000000000000",
      sponsored: false,
      authority: "wallet",
    });
    chainState.allowance = 100n;
    chainState.logs = [depositLog];
    toasts.loading.mockReturnValueOnce("deposit-toast");
    const execute = vi.spyOn(sender.batches!, "execute");
    const { result } = renderDeposit();

    await act(async () => {
      await result.current.mutateAsync(deposit);
    });

    expect(execute).toHaveBeenCalledOnce();
    expect(sender.submitAtomicBatch).not.toHaveBeenCalled();
    expect(sender.sendContractCall).toHaveBeenCalledOnce();
    expect(toasts.loading).toHaveBeenLastCalledWith(
      expect.objectContaining({ id: "deposit-toast" })
    );
  });

  it("says an unknown outcome is unconfirmed, and refuses to send over it", async () => {
    const { sender, deposit, renderDeposit } = setup();
    chainState.allowance = 100n;
    const { result } = renderDeposit();

    await act(async () => {
      await expect(result.current.mutateAsync(deposit)).rejects.toSatisfy(isUnconfirmedTxError);
    });
    await act(async () => {
      await expect(result.current.mutateAsync(deposit)).rejects.toSatisfy(isUnconfirmedTxError);
    });

    expect(sender.submitAtomicBatch).toHaveBeenCalledOnce();
    expect(toasts.success).not.toHaveBeenCalled();
  });

  it("asks before a deposit past its ceilings goes step by step", async () => {
    const { sender, deposit, depositLog, approvalLog, renderDeposit } = setup(CONFIRMED);
    chainState.logs = [approvalLog, depositLog];
    vi.mocked(sender.submitAtomicBatch!).mockRejectedValueOnce(
      new BatchNotSubmittedError(new Error("batch-budget-exceeded"))
    );
    const { result } = renderDeposit();

    await act(async () => {
      await expect(result.current.mutateAsync(deposit)).rejects.toSatisfy(
        (error) => classifyTxError(error).kind === "overCeilings"
      );
    });
    expect(sender.sendContractCall).not.toHaveBeenCalled();

    await act(async () => {
      await result.current.mutateAsync(deposit);
    });
    expect(sender.submitAtomicBatch).toHaveBeenCalledOnce();
    expect(sender.sendContractCall).toHaveBeenCalledTimes(2);
  });

  it("says in a toast that a deposit past its ceilings takes another press", async () => {
    const { sender, deposit, renderDeposit } = setup(CONFIRMED);
    vi.mocked(sender.submitAtomicBatch!).mockRejectedValueOnce(
      new BatchNotSubmittedError(new Error("batch-budget-exceeded"))
    );
    const { result } = renderDeposit("toast");

    await act(async () => {
      await expect(result.current.mutateAsync(deposit)).rejects.toSatisfy(
        (error) => classifyTxError(error).kind === "overCeilings"
      );
    });

    expect(toasts.info).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Nothing was sent. Press again to sign each step." })
    );
  });

  it("stops without offering another press when one step alone is past its ceilings", async () => {
    listing.walletProfile = "sequential";
    const { sender, deposit, renderDeposit } = setup(CONFIRMED, "wallet");
    vi.mocked(sender.getBatchCapability!).mockImplementation(async (scope) => ({
      ...scope,
      atomic: "unsupported",
    }));
    sender.preflightBatch = async () => ({
      gas: "9000000",
      maxFeePerGas: "100000000",
      maxFee: "900000000000000",
      sponsored: false,
      authority: "wallet",
    });
    chainState.allowance = 100n;
    const { result } = renderDeposit("toast");

    await act(async () => {
      await expect(result.current.mutateAsync(deposit)).rejects.toSatisfy(
        (error) => classifyTxError(error).kind === "pastCeilings"
      );
    });

    expect(sender.sendContractCall).not.toHaveBeenCalled();
    expect(toasts.info).toHaveBeenCalledWith(
      expect.objectContaining({ title: "This deposit is too big to send right now" })
    );
  });

  it("reads no hold while this tab's send is in flight, and reads it once the send ends", async () => {
    const { account, jar, deposit, renderDeposit, renderPlan, sender, queryClient } = setup();
    chainState.allowance = 100n;
    const submit = vi.mocked(sender.submitAtomicBatch!);
    const send = submit.getMockImplementation()!;
    let wake = () => {};
    const woken = new Promise<void>((resolve) => {
      wake = resolve;
    });
    submit.mockImplementationOnce(async (...args) => {
      await woken;
      return send(...args);
    });
    const list = vi.spyOn(sender.batches!, "list");
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    const { result: deposits } = renderDeposit();

    let sent = Promise.resolve();
    act(() => {
      sent = deposits.current.mutateAsync(deposit).then(
        () => undefined,
        () => undefined
      );
    });
    await waitFor(() => expect(submit).toHaveBeenCalledOnce());

    const { result } = renderPlan();
    await waitFor(() => expect(result.current.signatures).toBe(1));
    expect(list).not.toHaveBeenCalled();

    await act(async () => {
      wake();
      await sent;
    });
    await waitFor(() => expect(result.current.isHeld).toBe(true));
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: batchKeys.allowance(deposit.assetAddress, account, jar, 42161),
    });
  });
});

describe("useDepositPlan for a jar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listing.enabled = true;
    listing.walletProfile = "eip-5792";
    chainState.allowance = 100n;
    chainState.held = 250n;
    chainState.logs = [];
  });

  it("says what was tried and what the jar holds, or only what was tried", async () => {
    const { deposit, renderDeposit, renderPlan } = setup();
    const { result: send } = renderDeposit();
    await act(async () => {
      await expect(send.current.mutateAsync(deposit)).rejects.toSatisfy(isUnconfirmedTxError);
    });

    const { result } = renderPlan();

    await waitFor(() => expect(result.current.isHeld).toBe(true));
    expect(result.current.holdFeedback?.detail).toBe(
      "You tried to deposit 100 DAI. This jar holds 250 DAI now."
    );

    chainState.held = null;
    await act(async () => {
      result.current.holdFeedback?.onCheckAgain();
    });
    await waitFor(() => expect(result.current.holdFeedback?.hasUnreadValues).toBe(true));
    expect(result.current.holdFeedback?.detail).toBe("You tried to deposit 100 DAI.");
  });

  it.each([
    ["a garden jar's lists", true],
    ["a campaign jar's lists", false],
  ])("refreshes %s when a held deposit proves it landed", async (_case, inGarden) => {
    const context = setup();
    const { account, jar, garden, deposit, depositLog, renderDeposit } = context;
    const { result: send } = renderDeposit();
    await act(async () => {
      await expect(send.current.mutateAsync(deposit)).rejects.toSatisfy(isUnconfirmedTxError);
    });
    chainState.logs = [depositLog];
    context.sender.reconcileBatch = vi.fn(async () => CONFIRMED as BatchExecution);
    const invalidate = vi.spyOn(context.queryClient, "invalidateQueries");
    const onLanded = vi.fn();

    const { result } = renderHookWithProviders(
      () =>
        useDepositPlan({
          target: { kind: "jar", address: jar, asset: deposit.assetAddress },
          amount: 100n,
          decimals: 0,
          symbol: "DAI",
          gardenAddress: inGarden ? garden : undefined,
          onLanded,
        }),
      { queryClient: context.queryClient }
    );

    await waitFor(() => expect(toasts.success).toHaveBeenCalledOnce());
    expect(result.current.isHeld).toBe(false);
    expect(toasts.success).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Deposit successful" })
    );
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: inGarden
        ? queryKeys.cookieJar.byGarden(garden, 42161)
        : queryKeys.cookieJar.campaign(jar, account, 42161),
    });
    expect(onLanded).toHaveBeenCalledOnce();
  });
});
