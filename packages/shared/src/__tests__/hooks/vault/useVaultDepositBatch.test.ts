/**
 * The vault deposit hook and form plan on a listed rail.
 * @vitest-environment happy-dom
 */

import "fake-indexeddb/auto";
import { act, waitFor } from "@testing-library/react";
import { readContract } from "@wagmi/core";
import { encodeAbiParameters, encodeEventTopics, type Log, parseAbi, toHex } from "viem";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { batchKeys } from "../../../config/query-keys/garden";
import { queryKeys } from "../../../config/query-keys";
import { useDepositPlan, useVaultDeposit } from "../../../hooks/vault/useVaultDeposit";
import { type DepositTarget, depositDomain } from "../../../modules/garden/deposit-batch";
import type { BatchExecution } from "../../../modules/transactions/batch-types";
import { BatchNotSubmittedError } from "../../../modules/transactions/batch-types";
import type { Address } from "../../../types/domain";
import { classifyTxError, isUnconfirmedTxError } from "../../../utils/errors/tx-error-classifier";
import { createTestQueryClient } from "../../test-utils/query-client";
import { renderHookWithProviders } from "../../test-utils/render-helpers";
import { createFakeBatchingSender } from "../../test-utils/transaction-fakes";

const { auth, chainState, sending, toasts, listing } = vi.hoisted(() => ({
  auth: { primaryAddress: null as string | null, passkeyAccountProfile: "kernel-0.3.1-legacy" },
  chainState: {
    allowance: 0n,
    previews: [] as bigint[],
    held: 250n as bigint | null,
    logs: [] as Partial<Log>[],
  },
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
    if (functionName === "allowance") return chainState.allowance;
    if (functionName === "maxDeposit") return 10_000n;
    if (functionName === "previewDeposit") return chainState.previews.shift() ?? 100n;
    if (functionName === "convertToAssets") {
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
const DEPOSIT_EVENT = parseAbi([
  "event Deposit(address indexed sender, address indexed owner, uint256 assets, uint256 shares)",
]);
const randomAddress = (): Address => toHex(crypto.getRandomValues(new Uint8Array(20)));

function depositLog(vault: Address, account: Address, assets: bigint): Partial<Log> {
  return {
    address: vault,
    topics: encodeEventTopics({
      abi: DEPOSIT_EVENT,
      eventName: "Deposit",
      args: { sender: account, owner: account },
    }) as Log["topics"],
    data: encodeAbiParameters([{ type: "uint256" }, { type: "uint256" }], [assets, assets]),
  };
}

function setup(
  execution: Partial<BatchExecution> = {},
  authMode: "passkey" | "wallet" = "passkey"
) {
  const account = randomAddress();
  const vault = randomAddress();
  const asset = randomAddress();
  const sender = createFakeBatchingSender(account, execution);
  Object.assign(sender, { authMode });
  auth.primaryAddress = account;
  sending.sender = sender;
  const queryClient = createTestQueryClient();
  // Nothing observes these in the deposit hook's own tests, and the test client collects at once.
  queryClient.setDefaultOptions({ queries: { retry: false, gcTime: Number.POSITIVE_INFINITY } });
  const target: DepositTarget = { kind: "vault", address: vault, asset, receiver: account };
  const deposit = {
    gardenAddress: randomAddress(),
    assetAddress: asset,
    vaultAddress: vault,
    amount: 100n,
  };
  const renderDeposit = () =>
    renderHookWithProviders(() => useVaultDeposit({ errorMode: "inline" }), { queryClient });
  const renderPlan = (amount = 100n, planTarget: DepositTarget | null = target) =>
    renderHookWithProviders(
      () => useDepositPlan({ target: planTarget, amount, decimals: 0, symbol: "DAI" }),
      { queryClient }
    );
  return { account, vault, asset, sender, queryClient, target, deposit, renderDeposit, renderPlan };
}

describe("useVaultDeposit on a listed rail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listing.enabled = true;
    listing.walletProfile = "eip-5792";
    chainState.allowance = 0n;
    chainState.previews = [];
    chainState.held = 250n;
    chainState.logs = [];
  });

  it("sends one request and returns its transaction once the event proves it", async () => {
    const { vault, account, sender, deposit, renderDeposit } = setup(CONFIRMED);
    chainState.allowance = 100n;
    chainState.logs = [depositLog(vault, account, 100n)];
    const { result } = renderDeposit();

    let landed: unknown;
    await act(async () => {
      landed = await result.current.mutateAsync(deposit);
    });

    expect(landed).toBe(hash);
    expect(sender.submitAtomicBatch).toHaveBeenCalledOnce();
    expect(sender.sendContractCall).not.toHaveBeenCalled();
    expect(toasts.success).toHaveBeenCalledOnce();
  });

  it("keeps today's flow while nothing is listed, and asks no wallet anything", async () => {
    listing.enabled = false;
    const { sender, deposit, renderDeposit } = setup(CONFIRMED, "wallet");
    chainState.allowance = 100n;
    const { result } = renderDeposit();

    await act(async () => {
      await result.current.mutateAsync(deposit);
    });

    expect(sender.getBatchCapability).not.toHaveBeenCalled();
    expect(sender.submitAtomicBatch).not.toHaveBeenCalled();
    expect(sender.sendContractCall).toHaveBeenCalledOnce();
  });

  it("goes one step at a time on a plain wallet, through the same journal", async () => {
    listing.walletProfile = "sequential";
    const { vault, account, sender, deposit, renderDeposit } = setup(CONFIRMED, "wallet");
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
    chainState.logs = [depositLog(vault, account, 100n)];
    toasts.loading.mockReturnValueOnce("deposit-toast");
    const { result } = renderDeposit();

    await act(async () => {
      await result.current.mutateAsync(deposit);
    });

    expect(sender.submitAtomicBatch).not.toHaveBeenCalled();
    expect(sender.sendContractCall).toHaveBeenCalledOnce();
    expect(sender.getBatchCapability).toHaveBeenCalledOnce();
    // The toast says the deposit is what's being signed now, as today's flow does.
    expect(toasts.loading).toHaveBeenLastCalledWith(
      expect.objectContaining({ id: "deposit-toast" })
    );
  });

  it("says an unknown outcome is unconfirmed, and refuses to send over it", async () => {
    const { deposit, renderDeposit, sender } = setup();
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

  it("sends nothing when the exchange rate has moved by the last check", async () => {
    const { deposit, renderDeposit, sender } = setup(CONFIRMED);
    chainState.allowance = 100n;
    chainState.previews = [100n, 50n];
    const { result } = renderDeposit();

    await act(async () => {
      await expect(result.current.mutateAsync(deposit)).rejects.toThrow("Exchange rate moved");
    });

    expect(sender.submitAtomicBatch).not.toHaveBeenCalled();
  });

  it("asks before a deposit past its ceilings goes step by step", async () => {
    const { vault, account, asset, sender, deposit, renderDeposit, renderPlan } = setup(CONFIRMED);
    chainState.logs = [
      depositLog(vault, account, 100n),
      {
        address: asset,
        topics: encodeEventTopics({
          abi: parseAbi([
            "event Approval(address indexed owner, address indexed spender, uint256 value)",
          ]),
          eventName: "Approval",
          args: { owner: account, spender: vault },
        }) as Log["topics"],
        data: encodeAbiParameters([{ type: "uint256" }], [100n]),
      },
    ];
    vi.mocked(sender.submitAtomicBatch!).mockRejectedValueOnce(
      new BatchNotSubmittedError(new Error("batch-budget-exceeded"))
    );
    const { result } = renderDeposit();
    const { result: plan } = renderPlan();
    await waitFor(() => expect(plan.current.signatures).toBe(1));

    await act(async () => {
      await expect(result.current.mutateAsync(deposit)).rejects.toSatisfy(
        (error) => classifyTxError(error).kind === "overCeilings"
      );
    });
    expect(sender.sendContractCall).not.toHaveBeenCalled();
    await waitFor(() => expect(plan.current.signatures).toBe(2));

    await act(async () => {
      await result.current.mutateAsync(deposit);
    });
    expect(sender.submitAtomicBatch).toHaveBeenCalledOnce();
    expect(sender.sendContractCall).toHaveBeenCalledTimes(2);
  });
});

describe("useDepositPlan", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listing.enabled = false;
    listing.walletProfile = "eip-5792";
    chainState.allowance = 0n;
    chainState.previews = [];
    chainState.held = 250n;
    chainState.logs = [];
  });

  it.each([
    ["an approval and the deposit", 0n, 2],
    ["a reset, an approval, and the deposit", 40n, 3],
    ["only the deposit when the allowance covers it", 100n, 1],
  ])("counts %s on today's flow", async (_case, allowance, expected) => {
    chainState.allowance = allowance;
    const { renderPlan, sender } = setup();
    const { result } = renderPlan();

    await waitFor(() => expect(result.current.signatures).toBe(expected));

    expect(result.current.signatureLine).toContain(String(expected));
    expect(result.current.unconfirmedIsHeld).toBe(false);
    expect(sender.getBatchCapability).not.toHaveBeenCalled();
  });

  it("counts no reset for a jar, which has only ever taken one approval", async () => {
    chainState.allowance = 40n;
    const { renderPlan, asset } = setup();
    const { result } = renderPlan(100n, { kind: "jar", address: randomAddress(), asset });

    await waitFor(() => expect(result.current.signatures).toBe(2));
  });

  it.each([
    "passkey",
    "wallet",
  ] as const)("on a %s rail, says nothing and asks nothing before there is a target", async (rail) => {
    listing.enabled = true;
    listing.walletProfile = "sequential";
    const { renderPlan, sender } = setup({}, rail);
    const { result } = renderPlan(100n, null);

    await act(async () => {});

    expect(result.current.signatures).toBeNull();
    expect(result.current.signatureLine).toBeNull();
    expect(result.current.unconfirmedIsHeld).toBe(false);
    expect(sender.getBatchCapability).not.toHaveBeenCalled();
  });

  it("counts one signature wherever a listed rail sends one request", async () => {
    listing.enabled = true;
    chainState.allowance = 40n;
    const { renderPlan } = setup();
    const { result } = renderPlan();

    await waitFor(() => expect(result.current.signatures).toBe(1));
    expect(result.current.unconfirmedIsHeld).toBe(true);
  });

  it("asks a listed wallet, and counts each step when it can't batch", async () => {
    listing.enabled = true;
    listing.walletProfile = "sequential";
    const { renderPlan, sender } = setup({}, "wallet");
    vi.mocked(sender.getBatchCapability!).mockImplementation(async (scope) => ({
      ...scope,
      atomic: "unsupported",
    }));
    const { result } = renderPlan();

    await waitFor(() => expect(result.current.signatures).toBe(2));

    expect(sender.getBatchCapability).toHaveBeenCalled();
  });

  it("reads nothing and says nothing about signatures until there is an amount", async () => {
    const { renderPlan } = setup();
    const { result } = renderPlan(0n);

    await act(async () => {});

    expect(result.current.signatures).toBeNull();
    expect(result.current.signatureLine).toBeNull();
    expect(vi.mocked(readContract)).not.toHaveBeenCalled();
  });

  it("shows a held deposit after a reload, even once its rail is off the list", async () => {
    listing.enabled = true;
    const { deposit, renderDeposit, renderPlan, queryClient, target, account } = setup();
    chainState.allowance = 100n;
    const { result: send } = renderDeposit();
    await act(async () => {
      await expect(send.current.mutateAsync(deposit)).rejects.toSatisfy(isUnconfirmedTxError);
    });
    listing.enabled = false;
    queryClient.removeQueries({ queryKey: batchKeys.hold(depositDomain(target), account, 42161) });

    const { result } = renderPlan();

    await waitFor(() => expect(result.current.isHeld).toBe(true));
    expect(result.current.holdFeedback?.detail).toContain("100 DAI");
    expect(result.current.holdFeedback?.detail).toContain("250 DAI");
    expect(result.current.holdFeedback?.hasUnreadValues).toBe(false);

    await act(async () => {
      result.current.holdFeedback?.onMoveOn();
    });
    await waitFor(() => expect(result.current.isHeld).toBe(false));
  });

  it("claims no balance it could not read, and asks for another check", async () => {
    listing.enabled = true;
    const { deposit, renderDeposit, renderPlan } = setup();
    chainState.allowance = 100n;
    chainState.held = null;
    const { result: send } = renderDeposit();
    await act(async () => {
      await expect(send.current.mutateAsync(deposit)).rejects.toSatisfy(isUnconfirmedTxError);
    });

    const { result } = renderPlan();

    await waitFor(() => expect(result.current.holdFeedback?.hasUnreadValues).toBe(true));
    expect(result.current.holdFeedback?.detail).toContain("100 DAI");
    expect(result.current.holdFeedback?.detail).not.toContain("0 DAI in this vault");
    expect(result.current.holdFeedback?.detail).not.toContain("You have");
  });

  it("reads no hold while this tab's send is in flight, and reads it once the send ends", async () => {
    listing.enabled = true;
    const { deposit, renderDeposit, renderPlan, sender } = setup();
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
    expect(result.current.isHeld).toBe(false);

    await act(async () => {
      wake();
      await sent;
    });
    await waitFor(() => expect(result.current.isHeld).toBe(true));
  });

  it("says when a held deposit proves it landed, once, and refreshes", async () => {
    listing.enabled = true;
    const { deposit, renderDeposit, vault, account, sender, queryClient } = setup();
    chainState.allowance = 100n;
    const { result: send } = renderDeposit();
    await act(async () => {
      await expect(send.current.mutateAsync(deposit)).rejects.toSatisfy(isUnconfirmedTxError);
    });
    chainState.logs = [depositLog(vault, account, 100n)];
    sender.reconcileBatch = vi.fn(async () => CONFIRMED as BatchExecution);
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");

    const target: DepositTarget = {
      kind: "vault",
      address: vault,
      asset: deposit.assetAddress,
      receiver: account,
    };
    const { result } = renderHookWithProviders(
      () =>
        useDepositPlan({
          target,
          amount: 100n,
          decimals: 0,
          symbol: "DAI",
          gardenAddress: deposit.gardenAddress,
        }),
      { queryClient }
    );

    await waitFor(() => expect(toasts.success).toHaveBeenCalledOnce());
    expect(result.current.isHeld).toBe(false);
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: queryKeys.vaults.deposits(deposit.gardenAddress, 42161),
    });
  });
});
