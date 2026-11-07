import { QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { IntlProvider } from "react-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { gardensKeys } from "../../config/query-keys/garden";
import { roleKeys } from "../../config/query-keys/identity";
import { useGardenDepartureOptions, useLeaveGarden } from "../../hooks/garden/useLeaveGarden";
import {
  recordGardenDeparture,
  recordGardenRegrant,
  withoutDepartedMembers,
} from "../../modules/garden/garden-departures";
import { addPendingJoin, hasFreshPendingJoin } from "../../modules/garden/pending-joins";
import type { TransactionSender } from "../../modules/transactions/types";
import { useGardenLeaveStore } from "../../stores/useGardenLeaveStore";
import { createMockGarden } from "../test-utils/mock-factories";
import { createTestQueryClient } from "../test-utils/query-client";

const fakes = vi.hoisted(() => ({
  simulate: vi.fn(),
  receipt: vi.fn(),
  wallet: vi.fn(),
  passkey: vi.fn(),
  module: vi.fn(),
  user: vi.fn(),
  sender: vi.fn(),
  ownership: vi.fn(),
  gardenRecord: vi.fn(),
  profileMemberGardens: vi.fn(),
  rejoined: vi.fn(),
  log: vi.fn(),
  gardens: [] as ReturnType<typeof createMockGarden>[],
}));
vi.mock("@wagmi/core", () => ({
  simulateContract: fakes.simulate,
  getPublicClient: () => ({ getCode: async () => "0x6000" }),
  waitForTransactionReceipt: fakes.receipt,
}));
vi.mock("../../hooks/blockchain/useTransactionSender", () => ({
  useTransactionSender: fakes.sender,
}));
vi.mock("../../config/appkit", () => ({ getWagmiConfig: () => ({}) }));
vi.mock("../../config/default-chain", () => ({ DEFAULT_CHAIN_ID: 42161 }));
vi.mock("../../utils/blockchain/garden-hats", () => ({ fetchHatsModuleAddress: fakes.module }));
vi.mock("../../modules/data/indexer-garden", () => ({
  getGarden: fakes.gardenRecord,
  getProfileMemberGardens: fakes.profileMemberGardens,
}));
vi.mock("../../modules/transactions/chain-guard", () => ({ ensureAppKitWalletChain: vi.fn() }));
vi.mock("../../modules/transactions/local-fork-safety", () => ({
  assertLocalArbitrumForkSmartAccountsDisabled: vi.fn(),
  assertLocalArbitrumForkWallet: vi.fn(),
}));
vi.mock("../../modules/garden/garden-departure-reads", () => ({
  readRolesAfterDeparture: fakes.rejoined,
}));
vi.mock("../../hooks/blockchain/useBaseLists", () => ({
  useGardens: () => ({ data: fakes.gardens }),
}));
vi.mock("../../hooks/auth/useUser", () => ({ useUser: fakes.user }));
vi.mock("../../modules/app/analytics-events", () => ({ createTracker: () => vi.fn() }));
vi.mock("../../modules/app/logger", () => ({ logger: { error: fakes.log, warn: vi.fn() } }));

function sender(authMode: "wallet" | "passkey" = "wallet"): TransactionSender {
  return {
    authMode,
    supportsBatching: false,
    supportsSponsorship: authMode === "passkey",
    assertOwnership: fakes.ownership,
    sendContractCall: async (call, options) => {
      await options?.assertOwnership?.();
      const hash = await (authMode === "passkey" ? fakes.passkey : fakes.wallet)(call);
      await options?.onBroadcastReference?.({
        kind: "transaction",
        hash,
        chainId: call.chainId,
        account: call.account,
      });
      return { hash, sponsored: authMode === "passkey" };
    },
  };
}
const account = "0x2222222222222222222222222222222222222222" as const;
const address = "0x1111111111111111111111111111111111111111" as const;
const module = "0x3333333333333333333333333333333333333333" as const;
function setup() {
  const client = createTestQueryClient();
  client.setQueryDefaults(gardensKeys.all, { gcTime: Infinity });
  client.setQueryDefaults(roleKeys.all, { gcTime: Infinity });
  client.setQueryData(gardensKeys.byChain(42161), [
    createMockGarden({ id: address, gardeners: [account], stewards: [account] }),
  ]);
  client.setQueryData(roleKeys.hasRole(address, account, "steward"), true);
  const hook = renderHook(() => useLeaveGarden(address), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>
        <IntlProvider locale="en" messages={{}} onError={() => {}}>
          {children}
        </IntlProvider>
      </QueryClientProvider>
    ),
  });
  return { ...hook, client };
}
beforeEach(() => {
  vi.resetAllMocks();
  localStorage.clear();
  useGardenLeaveStore.setState({ pending: {} });
  fakes.sender.mockReturnValue(sender());
  fakes.user.mockReturnValue({
    primaryAddress: account,
    ready: true,
    authMode: "wallet",
    smartAccountAddress: null,
    smartAccountClient: null,
  });
  fakes.rejoined.mockResolvedValue({ block: 50n, roles: [], complete: true });
  fakes.profileMemberGardens.mockResolvedValue([]);
  fakes.module.mockResolvedValue(module);
  fakes.simulate.mockResolvedValue({});
  fakes.wallet.mockResolvedValue("0xabc");
  fakes.passkey.mockResolvedValue("0xdef");
  fakes.receipt.mockResolvedValue({ status: "success", blockNumber: 40n });
});
describe("useLeaveGarden", () => {
  it("clears pending joins and every cached role after a wallet departure confirms", async () => {
    addPendingJoin(address, account);
    const { result, client } = setup();
    await act(async () => {
      await result.current.leaveGarden();
    });
    expect(fakes.wallet).toHaveBeenCalledWith(
      expect.objectContaining({
        address: module,
        functionName: "leaveGarden",
        args: [address],
        account,
      })
    );
    expect(hasFreshPendingJoin(address, account)).toBe(false);
    expect(client.getQueryData(gardensKeys.byChain(42161))).toMatchObject([
      { gardeners: [], stewards: [] },
    ]);
    await waitFor(() =>
      expect(client.getQueryData(roleKeys.hasRole(address, account, "steward"))).toBeUndefined()
    );
  });
  it("uses the sponsored transaction sender and waits for its receipt", async () => {
    fakes.sender.mockReturnValue(sender("passkey"));
    fakes.user.mockReturnValue({
      primaryAddress: account,
      smartAccountAddress: account,
      smartAccountClient: { account: { address: account }, sendTransaction: fakes.passkey },
      ready: true,
      authMode: "passkey",
    });
    const { result } = setup();
    await act(async () => {
      await result.current.leaveGarden();
    });
    expect(fakes.passkey).toHaveBeenCalledWith(
      expect.objectContaining({
        address: module,
        functionName: "leaveGarden",
        account,
        chainId: 42161,
      })
    );
    expect(fakes.wallet).not.toHaveBeenCalled();
    expect(fakes.receipt).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ hash: "0xdef", chainId: 42161 })
    );
  });
  it("surfaces refusal and preserves pending joins and membership", async () => {
    fakes.simulate.mockRejectedValue(new Error("OwnerCannotLeave"));
    addPendingJoin(address, account);
    const { result, client } = setup();
    await act(async () => {
      await expect(result.current.leaveGarden()).rejects.toThrow("OwnerCannotLeave");
    });
    expect(result.current.error).toBeTruthy();
    expect(fakes.log).toHaveBeenCalled();
    expect(hasFreshPendingJoin(address, account)).toBe(true);
    expect(client.getQueryData(gardensKeys.byChain(42161))).toMatchObject([
      { gardeners: [account] },
    ]);
  });
  it("never falls back to a wallet while a passkey session is unavailable", async () => {
    fakes.sender.mockReturnValue(null);
    fakes.user.mockReturnValue({
      primaryAddress: account,
      smartAccountAddress: account,
      smartAccountClient: null,
      ready: true,
      authMode: "passkey",
    });
    const { result } = setup();
    await act(async () => {
      await expect(result.current.leaveGarden()).rejects.toThrow();
    });
    expect(fakes.wallet).not.toHaveBeenCalled();
    expect(fakes.passkey).not.toHaveBeenCalled();
  });
  it("repairs stale membership if a prior send already left and the chain confirms it", async () => {
    fakes.simulate.mockRejectedValue(new Error("NotGardenMember"));
    recordGardenDeparture(42161, address, account, 30n);
    recordGardenRegrant(42161, address, account, { block: 40n, roles: ["gardener", "steward"] });
    const { result, client } = setup();
    await act(async () => {
      await expect(result.current.leaveGarden()).resolves.toEqual({ hash: null, departed: true });
    });
    expect(client.getQueryData(gardensKeys.byChain(42161))).toMatchObject([
      { gardeners: [], stewards: [] },
    ]);
    expect(fakes.wallet).not.toHaveBeenCalled();
  });
  it.each([
    false,
    true,
  ])("keeps a pending join when a leave simulation refuses membership (join during read: %s)", async (duringRead) => {
    fakes.simulate.mockRejectedValue(new Error("NotGardenMember"));
    if (!duringRead) addPendingJoin(address.toUpperCase(), account);
    fakes.rejoined.mockImplementation(async () => {
      if (duringRead) addPendingJoin(address, account);
      return { block: 50n, roles: [], complete: true };
    });
    const { result, client } = setup();
    await act(async () => {
      await expect(result.current.leaveGarden()).rejects.toThrow("NotGardenMember");
    });
    expect(hasFreshPendingJoin(duringRead ? address : address.toUpperCase(), account)).toBe(true);
    expect(client.getQueryData(gardensKeys.byChain(42161))).toMatchObject([
      { gardeners: [account] },
    ]);
    expect(fakes.wallet).not.toHaveBeenCalled();
  });
  it("does not infer departure from an unknown membership read", async () => {
    fakes.simulate.mockRejectedValue(new Error("NotGardenMember"));
    fakes.rejoined.mockResolvedValue({ block: 50n, roles: [], complete: false });
    const { result, client } = setup();
    await act(async () => {
      await expect(result.current.leaveGarden()).rejects.toThrow();
    });
    expect(client.getQueryData(gardensKeys.byChain(42161))).toMatchObject([
      { gardeners: [account] },
    ]);
  });
  it("rejects an offline departure immediately without deferring a send", async () => {
    const online = vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    try {
      const { result } = setup();
      await act(async () => {
        await expect(result.current.leaveGarden()).rejects.toThrow();
      });
      expect(fakes.wallet).not.toHaveBeenCalled();
      expect(fakes.simulate).not.toHaveBeenCalled();
    } finally {
      online.mockRestore();
    }
  });
  it("preserves membership without logging a product failure when the signer cancels", async () => {
    fakes.wallet.mockRejectedValue(
      Object.assign(new Error("User rejected the request"), { code: 4001 })
    );
    const { result, client } = setup();
    await act(async () => {
      await expect(result.current.leaveGarden()).rejects.toThrow();
    });
    expect(fakes.log).not.toHaveBeenCalled();
    expect(client.getQueryData(gardensKeys.byChain(42161))).toMatchObject([
      { gardeners: [account] },
    ]);
  });
  it("does not clear a different account's newer pending join", async () => {
    const nextAccount = "0x4444444444444444444444444444444444444444";
    addPendingJoin(address, nextAccount);
    const { result } = setup();
    await act(async () => {
      await result.current.leaveGarden();
    });
    expect(hasFreshPendingJoin(address, nextAccount)).toBe(true);
  });
});

describe("departure ownership and retained references", () => {
  it.each([
    "module",
    "simulation",
  ])("sends nothing if the active account changes during %s lookup", async (stage) => {
    let release!: (value: unknown) => void;
    const waiting = new Promise((done) => {
      release = done;
    });
    const lookup = stage === "module" ? fakes.module : fakes.simulate;
    lookup.mockReturnValue(waiting);
    const { result, rerender } = setup();
    let submission!: Promise<unknown>;
    await act(async () => {
      submission = result.current.leaveGarden().catch((error) => error);
    });
    await waitFor(() => expect(lookup).toHaveBeenCalled());
    fakes.user.mockReturnValue({ primaryAddress: module, ready: true, authMode: "wallet" });
    act(() => {
      rerender();
    });
    await act(async () => {
      release(module);
      await submission;
    });
    expect(await submission).toBeInstanceOf(Error);
    expect(fakes.wallet).not.toHaveBeenCalled();
    expect(fakes.passkey).not.toHaveBeenCalled();
  });
  it("sends nothing after the session unmounts during simulation", async () => {
    let release!: () => void;
    fakes.simulate.mockImplementation(
      () =>
        new Promise<void>((done) => {
          release = done;
        })
    );
    const { result, unmount } = setup();
    let submission!: Promise<unknown>;
    await act(async () => {
      submission = result.current.leaveGarden().catch((error) => error);
    });
    await waitFor(() => expect(fakes.simulate).toHaveBeenCalled());
    unmount();
    await act(async () => {
      release();
      await submission;
    });
    expect(await submission).toBeInstanceOf(Error);
    expect(fakes.wallet).not.toHaveBeenCalled();
  });
  it("retains the known hash across dialog remount and reconciles before another send", async () => {
    fakes.receipt.mockRejectedValueOnce(new Error("timeout"));
    const first = setup();
    await act(async () => {
      await expect(first.result.current.leaveGarden()).rejects.toThrow(
        "transaction-confirmation-pending"
      );
    });
    const command = { userAddress: account, gardenAddress: address, chainId: 42161 };
    expect(useGardenLeaveStore.getState().load(command)?.hash).toBe("0xabc");
    expect(
      useGardenLeaveStore.getState().load({ ...command, userAddress: module })
    ).toBeUndefined();
    expect(
      useGardenLeaveStore.getState().load({ ...command, gardenAddress: module })
    ).toBeUndefined();
    expect(useGardenLeaveStore.getState().load({ ...command, chainId: 11155111 })).toBeUndefined();
    const persisted = localStorage.getItem("green-goods:garden-leave-submissions");
    expect(persisted).toContain("0xabc");
    first.unmount();
    useGardenLeaveStore.setState({ pending: {} });
    localStorage.setItem("green-goods:garden-leave-submissions", persisted!);
    await useGardenLeaveStore.persist.rehydrate();
    const next = setup();
    await act(async () => {
      await expect(next.result.current.leaveGarden()).resolves.toEqual({
        hash: "0xabc",
        departed: true,
      });
    });
    expect(fakes.wallet).toHaveBeenCalledOnce();
    expect(fakes.simulate).toHaveBeenCalledOnce();
    expect(useGardenLeaveStore.getState().load(command)).toBeUndefined();
    expect(next.client.getQueryData(gardensKeys.byChain(42161))).toMatchObject([{ gardeners: [] }]);
  });
});

it("retries a read-only availability failure without sending and refreshes before enabling", async () => {
  fakes.module.mockResolvedValue(undefined);
  const { result } = setup();
  expect(result.current.availability).toBe("unknown");
  await act(async () => {
    await result.current.checkAvailability();
  });
  await waitFor(() => expect(result.current.availability).toBe("unavailable"));
  let release!: (value: string) => void;
  fakes.module.mockImplementation(
    () =>
      new Promise((done) => {
        release = done;
      })
  );
  let check!: Promise<unknown>;
  await act(async () => {
    check = result.current.checkAvailability();
  });
  await waitFor(() => expect(result.current.availability).toBe("checking"));
  await act(async () => {
    release(module);
    await check;
  });
  await waitFor(() => expect(result.current.availability).toBe("available"));
  expect(fakes.wallet).not.toHaveBeenCalled();
  expect(fakes.passkey).not.toHaveBeenCalled();
});

it("reconciles a mined prior departure after membership is absent with no module rehearsal or new send", async () => {
  const command = { gardenAddress: address, userAddress: account, chainId: 42161 };
  useGardenLeaveStore.getState().record(command, { hash: "0xabc", sponsored: false });
  fakes.module.mockRejectedValue(new Error("module unavailable"));
  const { result, client } = setup();
  client.setQueryData(gardensKeys.byChain(42161), [
    createMockGarden({ id: address, gardeners: [], stewards: [] }),
  ]);
  expect(result.current.hasPendingDeparture).toBe(true);
  await act(async () => {
    await expect(result.current.reconcileDeparture()).resolves.toEqual({
      hash: "0xabc",
      departed: true,
    });
  });
  expect(fakes.module).not.toHaveBeenCalled();
  expect(fakes.simulate).not.toHaveBeenCalled();
  expect(fakes.wallet).not.toHaveBeenCalled();
  await waitFor(() => expect(result.current.hasPendingDeparture).toBe(false));
});

it("preserves restored membership and its new pending join when an older departure receipt is recovered", async () => {
  const command = { gardenAddress: address, userAddress: account, chainId: 42161 };
  useGardenLeaveStore.getState().record(command, { hash: "0xabc", sponsored: false });
  addPendingJoin(address, account, Date.now() - 1000);
  addPendingJoin(address, account, Date.now() + 1);
  fakes.rejoined.mockResolvedValue({ block: 50n, roles: ["gardener"], complete: true });
  const { result, client } = setup();
  await act(async () => {
    await expect(result.current.reconcileDeparture()).resolves.toEqual({
      hash: "0xabc",
      departed: false,
    });
  });
  expect(fakes.rejoined).toHaveBeenCalledWith(42161, address, account, 40n);
  expect(client.getQueryData(gardensKeys.byChain(42161))).toMatchObject([
    { gardeners: [account], stewards: [] },
  ]);
  expect(hasFreshPendingJoin(address, account)).toBe(true);
  expect(fakes.wallet).not.toHaveBeenCalled();
});

it("does not let an old recovered receipt bypass a newer departure block", async () => {
  const command = { gardenAddress: address, userAddress: account, chainId: 42161 };
  useGardenLeaveStore.getState().record(command, { hash: "0xabc", sponsored: false });
  recordGardenDeparture(42161, address, account, 50n);
  fakes.rejoined.mockImplementation(async (_chain, _garden, _account, minimum) =>
    minimum <= 45n ? { block: 45n, roles: ["gardener"] } : undefined
  );
  const { result } = setup();
  await act(async () => {
    await expect(result.current.reconcileDeparture()).rejects.toThrow(
      "transaction-confirmation-pending"
    );
  });
  expect(result.current.hasPendingDeparture).toBe(true);
  expect(fakes.rejoined).toHaveBeenCalledWith(42161, address, account, 50n);
  expect(
    withoutDepartedMembers([createMockGarden({ id: address, gardeners: [account] })], 42161)[0]
      .gardeners
  ).toEqual([]);
});

it("keeps a confirmed receipt retryable if a role read fails and no role is verified", async () => {
  const command = { gardenAddress: address, userAddress: account, chainId: 42161 };
  useGardenLeaveStore.getState().record(command, { hash: "0xabc", sponsored: false });
  fakes.rejoined.mockResolvedValue({ block: 50n, roles: [], complete: false });
  const { result, client } = setup();
  await act(async () => {
    await expect(result.current.reconcileDeparture()).rejects.toThrow(
      "transaction-confirmation-pending"
    );
  });
  expect(result.current.hasPendingDeparture).toBe(true);
  expect(client.getQueryData(gardensKeys.byChain(42161))).toMatchObject([{ gardeners: [account] }]);
  expect(fakes.wallet).not.toHaveBeenCalled();
});

it("clears a join submitted before the recovered leave", async () => {
  const command = { gardenAddress: address, userAddress: account, chainId: 42161 };
  addPendingJoin(address, account, Date.now() - 1000);
  useGardenLeaveStore.getState().record(command, { hash: "0xabc", sponsored: false });
  const { result } = setup();
  await act(async () => {
    await expect(result.current.reconcileDeparture()).resolves.toMatchObject({ departed: true });
  });
  expect(hasFreshPendingJoin(address, account)).toBe(false);
});

it("avoids a second signature while another tab holds the departure lock", async () => {
  const original = Object.getOwnPropertyDescriptor(navigator, "locks");
  const request = vi.fn((_name, _options, callback) => callback(null));
  Object.defineProperty(navigator, "locks", { configurable: true, value: { request } });
  try {
    const { result } = setup();
    await act(async () => {
      await expect(result.current.leaveGarden()).rejects.toThrow("already being checked");
    });
    expect(request).toHaveBeenCalledWith(
      expect.any(String),
      { ifAvailable: true },
      expect.any(Function)
    );
    expect(fakes.wallet).not.toHaveBeenCalled();
  } finally {
    if (original) Object.defineProperty(navigator, "locks", original);
    else Reflect.deleteProperty(navigator, "locks");
  }
});

it("reconciles a checkpoint written by another tab without requesting a signature", async () => {
  const { result } = setup();
  const key = "green-goods:garden-leave-submissions";
  const checkpoint = JSON.stringify({
    state: { pending: { [`42161:${account}:${address}`]: { hash: "0xabc", sponsored: false } } },
    version: 0,
  });
  act(() => {
    localStorage.setItem(key, checkpoint);
    window.dispatchEvent(Object.assign(new Event("storage"), { key }));
  });
  expect(result.current.hasPendingDeparture).toBe(true);
  await act(async () => {
    await expect(result.current.leaveGarden()).resolves.toMatchObject({ hash: "0xabc" });
  });
  expect(fakes.wallet).not.toHaveBeenCalled();
});

function renderDepartureOptions() {
  const client = createTestQueryClient();
  return renderHook(() => useGardenDepartureOptions().options, {
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    ),
  });
}

describe("Profile departure options", () => {
  it("offers departure to a member outside the catalog without a saved receipt", async () => {
    fakes.gardens = [createMockGarden({ id: module, gardeners: [] })];
    fakes.profileMemberGardens.mockResolvedValue([
      createMockGarden({ id: address, gardeners: [account] }),
    ]);
    const { result } = renderDepartureOptions();
    await waitFor(() =>
      expect(result.current).toMatchObject([
        {
          garden: { id: address },
          membership: { roles: ["gardener"] },
          hasPendingDeparture: false,
        },
      ])
    );
    expect(fakes.profileMemberGardens).toHaveBeenCalledWith(account);
    expect(fakes.gardenRecord).not.toHaveBeenCalled();
  });

  it("looks up a saved departure for a garden outside the current page", async () => {
    fakes.gardens = [createMockGarden({ id: module, gardeners: [] })];
    fakes.gardenRecord.mockResolvedValue(createMockGarden({ id: address, gardeners: [] }));
    useGardenLeaveStore
      .getState()
      .record(
        { gardenAddress: address, userAddress: account, chainId: 42161 },
        { hash: "0xabc", sponsored: false }
      );
    const { result } = renderDepartureOptions();
    await waitFor(() =>
      expect(result.current).toMatchObject([{ garden: { id: address }, hasPendingDeparture: true }])
    );
    expect(fakes.gardenRecord).toHaveBeenCalledWith(address);
  });
  it("keeps every held role reachable without treating funders as Home membership", () => {
    fakes.gardens = [
      createMockGarden({ id: address, gardeners: [account] }),
      createMockGarden({ id: module, gardeners: [], funders: [account], communities: [account] }),
    ];
    const { result } = renderDepartureOptions();
    expect(result.current.map(({ roles }) => roles)).toEqual([
      ["gardener"],
      ["funder", "community"],
    ]);
  });
  it("keeps a known receipt reachable after membership disappears, scoped to account and chain", () => {
    fakes.gardens = [
      createMockGarden({ id: address, gardeners: [] }),
      createMockGarden({ id: module, gardeners: [] }),
    ];
    useGardenLeaveStore
      .getState()
      .record(
        { gardenAddress: address, userAddress: account, chainId: 42161 },
        { hash: "0xabc", sponsored: false }
      );
    useGardenLeaveStore
      .getState()
      .record(
        { gardenAddress: module, userAddress: account, chainId: 11155111 },
        { hash: "0xdef", sponsored: false }
      );
    useGardenLeaveStore
      .getState()
      .record(
        { gardenAddress: module, userAddress: module, chainId: 42161 },
        { hash: "0xdef", sponsored: false }
      );
    const { result } = renderDepartureOptions();
    expect(result.current).toMatchObject([
      { garden: { id: address }, roles: [], hasPendingDeparture: true },
    ]);
    act(() =>
      useGardenLeaveStore
        .getState()
        .clear(
          { gardenAddress: address, userAddress: account, chainId: 42161 },
          { hash: "0xabc", sponsored: false }
        )
    );
    expect(result.current).toEqual([]);
  });
  it("shows no other account's saved departure after sign-out", () => {
    fakes.user.mockReturnValue({ primaryAddress: null });
    const { result } = renderDepartureOptions();
    expect(result.current).toEqual([]);
  });
});
