/** @vitest-environment happy-dom */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Hex } from "viem";
import { createOpenfortWalletRuntime } from "../../config/openfort-wagmi";

type Connection = { accounts: Hex[]; chainId: number };
type RelayStorage = {
  getKeys(): Promise<string[]>;
  getItem(key: string): Promise<unknown>;
  setItem(key: string, value: unknown): Promise<void>;
  removeItem(key: string): Promise<void>;
};

const sdkStorage = vi.hoisted(() => new Map<string, unknown>());
const relays = vi.hoisted(
  () =>
    new Map<
      string,
      {
        connect: ReturnType<typeof vi.fn>;
        disconnect: ReturnType<typeof vi.fn>;
        uri: (value: string) => void;
        approve: (value: Connection) => void;
        storage: RelayStorage;
      }
    >()
);

vi.mock("idb-keyval", () => ({
  createStore: () => undefined,
  get: async (key: string) => sdkStorage.get(key),
  keys: async () => [...sdkStorage.keys()],
  entries: async () => [...sdkStorage.entries()],
  set: async (key: string, value: unknown) => {
    sdkStorage.set(key, value);
  },
  del: async (key: string) => {
    sdkStorage.delete(key);
  },
}));

vi.mock("../../config/appkit", async () => {
  const { http } = await import("viem");
  return {
    createAppKitTransports: (chains: { id: number }[]) =>
      Object.fromEntries(chains.map(({ id }) => [id, http()])),
  };
});

vi.mock("wagmi/connectors", () => ({
  walletConnect: Object.assign(
    ({ customStoragePrefix, storage }: { customStoragePrefix: string; storage: RelayStorage }) =>
      ({
        emitter,
        chains,
        storage: wagmiStorage,
      }: {
        emitter: { emit: (name: string, event: object) => void };
        chains: readonly { id: number }[];
        storage: {
          getItem(key: string): Promise<number[] | null>;
          setItem(key: string, value: number[]): Promise<void>;
        };
      }) => {
        let approve!: (value: Connection) => void;
        const approval = new Promise<Connection>((resolve) => {
          approve = resolve;
        });
        const mock = {
          id: "walletConnect",
          get requestedChainsStorageKey() {
            return `${this.id}.requestedChains`;
          },
          connect: vi.fn(async function (this: { requestedChainsStorageKey: string }) {
            const connection = await approval;
            await wagmiStorage.setItem(
              this.requestedChainsStorageKey,
              chains.map(({ id }) => id)
            );
            return connection;
          }),
          disconnect: vi.fn(async function (this: { requestedChainsStorageKey: string }) {
            await wagmiStorage.setItem(this.requestedChainsStorageKey, []);
            for (const key of await storage.getKeys()) {
              if (key.startsWith("wc@2:universal_provider:")) await storage.removeItem(key);
            }
          }),
          async isAuthorized() {
            const session = await storage.getItem(rawSdkKey);
            const requestedChains = await wagmiStorage.getItem(this.requestedChainsStorageKey);
            return Boolean(session) && chains.every(({ id }) => requestedChains?.includes(id));
          },
          getProvider: async () => ({ prefix: customStoragePrefix }),
          uri: (value: string) => emitter.emit("message", { type: "display_uri", data: value }),
          approve,
          storage,
        };
        relays.set(customStoragePrefix, mock);
        return mock;
      },
    { type: "walletConnect" }
  ),
}));

const account: Hex = "0x0000000000000000000000000000000000000042";
const connection = { accounts: [account], chainId: 11155111 };
const rawSdkKey = "wc@2:universal_provider:session";
const createRuntime = () =>
  createOpenfortWalletRuntime("test", {
    name: "Green Goods",
    description: "Wallet fixture",
    url: "https://example.test",
    icons: [],
  });

describe("Openfort WalletConnect pairing", () => {
  beforeEach(() => {
    localStorage.clear();
    sdkStorage.clear();
    relays.clear();
  });

  it("settles cancellation while SDK approval is still pending", async () => {
    const runtime = createRuntime();
    const report = vi.fn();
    runtime.subscribeConnection(report);
    const connector = runtime.config.connectors[0];
    const failure = expect(connector.connect({})).rejects.toThrow("Wallet pairing cancelled");
    await vi.waitFor(() => expect(relays.get("io.rabby")?.connect).toHaveBeenCalled());
    relays.get("io.rabby")?.uri("wc:fixture");
    expect(runtime.getPairing()?.uri).toBe("wc:fixture");
    runtime.cancelPairing();

    await failure;
    expect(runtime.getPairing()).toBeNull();
    expect(report).toHaveBeenLastCalledWith({ type: "failed", reason: "cancelled" });
  });

  it("isolates a late approval and only disconnects the abandoned relay", async () => {
    const runtime = createRuntime();
    const connector = runtime.config.connectors[0];
    const failure = expect(connector.connect({})).rejects.toThrow("Wallet pairing cancelled");
    await vi.waitFor(() => expect(relays.get("io.rabby")?.connect).toHaveBeenCalled());
    const oldRelay = relays.get("io.rabby")!;
    runtime.cancelPairing();
    await failure;

    const retry = connector.connect({});
    const [prefix, nextRelay] = [...relays.entries()][1];
    await vi.waitFor(() => expect(nextRelay.connect).toHaveBeenCalledOnce());
    await oldRelay.storage.setItem(rawSdkKey, "old session");
    await nextRelay.storage.setItem(rawSdkKey, "new session");
    nextRelay.uri("wc:retry");
    oldRelay.uri("wc:stale");
    expect(runtime.getPairing()?.uri).toBe("wc:retry");
    nextRelay.approve(connection);
    await expect(retry).resolves.toEqual(connection);
    expect(connector.type).toBe("walletConnect");

    oldRelay.approve(connection);
    await vi.waitFor(() => expect(oldRelay.disconnect).toHaveBeenCalledOnce());
    await vi.waitFor(async () => expect(await oldRelay.storage.getItem(rawSdkKey)).toBeUndefined());
    expect(nextRelay.disconnect).not.toHaveBeenCalled();
    await expect(nextRelay.storage.getItem(rawSdkKey)).resolves.toBe("new session");
    const restored = createRuntime().config.connectors[0];
    await expect(restored.isAuthorized()).resolves.toBe(true);
    await expect(restored.getProvider()).resolves.toEqual({ prefix });
  });

  it("keeps each connector ID stable without broadening the wallet list", () => {
    expect(createRuntime().config.connectors.map(({ id }) => id)).toEqual([
      "io.rabby",
      "me.rainbow",
      "io.metamask",
    ]);
  });

  it("reports cancellation before selecting another wallet", async () => {
    const runtime = createRuntime();
    const report = vi.fn();
    runtime.subscribeConnection(report);
    const [rabby, rainbow] = runtime.config.connectors;
    const first = expect(rabby.connect({})).rejects.toThrow("Wallet pairing cancelled");
    await vi.waitFor(() => expect(relays.get("io.rabby")?.connect).toHaveBeenCalledOnce());
    const second = expect(rainbow.connect({})).rejects.toThrow("Wallet pairing cancelled");
    await vi.waitFor(() => expect(relays.get("me.rainbow")?.connect).toHaveBeenCalledOnce());
    await first;

    expect(report.mock.calls.map(([event]) => event)).toEqual([
      expect.objectContaining({ type: "selected", wallet: "rabby" }),
      { type: "failed", reason: "cancelled" },
      expect.objectContaining({ type: "selected", wallet: "rainbow" }),
    ]);
    runtime.cancelPairing();
    await second;
  });
});
