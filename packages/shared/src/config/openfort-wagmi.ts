import { createConnector, injected } from "@wagmi/core";
import { type EIP1193Provider, UserRejectedRequestError } from "viem";
import { createConfig, createStorage } from "wagmi";
import { hardhat } from "viem/chains";
import { walletConnect } from "wagmi/connectors";
import type { WalletConnectEvent } from "../modules/app/authWalletConnectAnalytics";
import { logger } from "../modules/app/logger";
import { boundConnectorRestores } from "../modules/auth/connector-restore-deadline";
import { type AppKitMetadata, createAppKitTransports } from "./appkit";
import { getChain, SUPPORTED_CHAINS } from "./chains";
import { DEFAULT_CHAIN_ID } from "./default-chain";
import { createRelayStorage } from "./openfort-relay-storage";

const wallets = [
  {
    id: "io.rabby",
    name: "Rabby",
    analyticsName: "rabby",
    flag: "isRabby",
    mobileUrl: "rabby://wc",
  },
  {
    id: "me.rainbow",
    name: "Rainbow",
    analyticsName: "rainbow",
    flag: "isRainbow",
    mobileUrl: "https://rnbwapp.com/wc",
  },
  {
    id: "io.metamask",
    name: "MetaMask",
    analyticsName: "metamask",
    flag: "isMetaMask",
    mobileUrl: "https://metamask.app.link/wc",
  },
] as const;

type NamedWallet = (typeof wallets)[number];
type AnnouncedProvider = CustomEvent<{ info: { rdns: string }; provider: EIP1193Provider }>;
type Pairing = { wallet: NamedWallet; uri: string };

export function isMobileWalletBrowser() {
  const { userAgent, maxTouchPoints } = window.navigator;
  return (
    /Android|iPhone|iPad|iPod/i.test(userAgent) ||
    (maxTouchPoints > 1 && /Macintosh/i.test(userAgent))
  );
}

function createNamedConnector(
  wallet: NamedWallet,
  providers: ReadonlyMap<string, EIP1193Provider>,
  projectId: string,
  metadata: AppKitMetadata,
  showPairing: (pairing: Pairing) => () => void,
  trackPairing: (cancel: () => void) => () => void,
  report: (event: WalletConnectEvent) => void
) {
  return createConnector((config) => {
    const browser = injected({
      target: () => {
        type BrowserWallet = EIP1193Provider & {
          [flag in NamedWallet["flag"] | "isBraveWallet" | "isCoinbaseWallet"]?: boolean;
        };
        const ethereum = (
          window as Window & {
            ethereum?: BrowserWallet & { providers?: BrowserWallet[] };
          }
        ).ethereum;
        return {
          id: wallet.id,
          name: wallet.name,
          provider: () =>
            providers.get(wallet.id) ??
            (ethereum?.providers ?? (ethereum ? [ethereum] : [])).find(
              (p) =>
                p[wallet.flag] &&
                (wallet.flag !== "isMetaMask" ||
                  (!p.isRabby && !p.isRainbow && !p.isBraveWallet && !p.isCoinbaseWallet))
            ),
        };
      },
    })(config);
    const prefixKey = `${wallet.id}.openfortRelayPrefix`;
    function makeRelay(prefix: string) {
      let abandoned = false;
      const emitter = Object.create(config.emitter) as typeof config.emitter;
      emitter.emit = (...args) => {
        if (!abandoned) config.emitter.emit(...args);
      };
      const connector = {
        ...walletConnect({
          projectId,
          metadata,
          showQrModal: false,
          customStoragePrefix: prefix,
          storage: createRelayStorage(prefix),
        })({
          ...config,
          emitter,
        }),
        id: prefix,
      };
      return { connector, prefix, abandon: () => (abandoned = true) };
    }
    let relayPromise: Promise<ReturnType<typeof makeRelay>> | undefined;
    const getRelay = () => {
      relayPromise ??= Promise.resolve(config.storage?.getItem(prefixKey)).then((stored) =>
        makeRelay(
          typeof stored === "string" && stored.startsWith(`${wallet.id}.`) ? stored : wallet.id
        )
      );
      return relayPromise;
    };
    let active: "browser" | "relay" | undefined;
    let manualConnection = false;

    const select = async () =>
      active === "browser"
        ? browser
        : active === "relay"
          ? (await getRelay()).connector
          : (await browser.getProvider()) || !projectId
            ? browser
            : (await getRelay()).connector;

    const reportFailure = (error: unknown) =>
      report({
        type: "failed",
        reason: error instanceof UserRejectedRequestError ? "rejected" : "connect_error",
      });

    return {
      ...browser,
      // The Openfort bridge uses this connector's getProvider and connect for both transports.
      id: wallet.id,
      name: wallet.name,
      async setup() {
        // Wagmi copies connector properties during setup. Track the transport on that copy.
        Object.defineProperty(this, "type", {
          enumerable: true,
          get: () => (active === "relay" ? walletConnect.type : injected.type),
        });
        if (await browser.getProvider()) await browser.setup?.();
      },
      async getProvider() {
        return (await select()).getProvider();
      },
      async isAuthorized() {
        if ((await browser.getProvider()) && (await browser.isAuthorized())) {
          active = "browser";
          return true;
        }
        if (projectId && (await (await getRelay()).connector.isAuthorized())) {
          active = "relay";
          return true;
        }
        return false;
      },
      async connect(params) {
        const connector = await select();
        const next = connector === browser ? "browser" : "relay";
        if (next === "browser" || params?.isReconnecting) {
          const manual = !params?.isReconnecting;
          if (manual)
            report({ type: "selected", wallet: wallet.analyticsName, platform: "browser" });
          try {
            const result = await connector.connect(params);
            active = next;
            return result;
          } catch (error) {
            if (manual) reportFailure(error);
            throw error;
          }
        }

        if (manualConnection) throw new Error("A wallet pairing is already in progress");
        manualConnection = true;
        const relay = await getRelay();
        const platform = isMobileWalletBrowser() ? "mobile" : "qrcode";
        let hidePairing: (() => void) | undefined;
        let cancelled = false;
        const rejected = () => new UserRejectedRequestError(new Error("Wallet pairing cancelled"));
        let rejectCancelled!: (error: Error) => void;
        const cancellation = new Promise<never>((_, reject) => {
          rejectCancelled = reject;
        });
        const cancel = () => {
          if (cancelled) return;
          cancelled = true;
          relay.abandon();
          // The SDK can still approve the old proposal. Isolate its provider and persistence
          // so a late approval or its cleanup cannot change the session from another attempt.
          relayPromise = Promise.resolve(makeRelay(`${wallet.id}.${crypto.randomUUID()}`));
          report({ type: "failed", reason: "cancelled" });
          rejectCancelled(rejected());
        };
        const stopTracking = trackPairing(cancel);
        report({ type: "selected", wallet: wallet.analyticsName, platform });
        const showUri = ({ type, data }: { type: string; data?: unknown }) => {
          if (
            cancelled ||
            type !== "display_uri" ||
            typeof data !== "string" ||
            !data.startsWith("wc:")
          )
            return;
          hidePairing?.();
          hidePairing = showPairing({ wallet, uri: data });
        };
        config.emitter.on("message", showUri);
        try {
          const pending = relay.connector.connect(params).then(async (connection) => {
            if (cancelled) {
              await relay.connector.disconnect().catch(() => {
                logger.warn("[Openfort] A cancelled WalletConnect session could not disconnect");
              });
              throw rejected();
            }
            return connection;
          });
          const connection = await Promise.race([pending, cancellation]);
          active = "relay";
          void Promise.resolve(config.storage?.setItem(prefixKey, relay.prefix)).catch(() => {
            logger.warn("[Openfort] The WalletConnect session could not be remembered");
          });
          return connection;
        } catch (error) {
          if (!cancelled) reportFailure(error);
          throw error;
        } finally {
          manualConnection = false;
          stopTracking();
          config.emitter.off("message", showUri);
          hidePairing?.();
        }
      },
      async disconnect() {
        await (await select()).disconnect();
        active = undefined;
      },
      async getAccounts() {
        return (await select()).getAccounts();
      },
      async getChainId() {
        return (await select()).getChainId();
      },
      async switchChain(params) {
        return (await select()).switchChain!(params);
      },
    };
  });
}

export function createOpenfortWalletRuntime(projectId: string, metadata: AppKitMetadata) {
  const listeners = new Set<() => void>();
  const connectionListeners = new Set<(event: WalletConnectEvent) => void>();
  let pairing: Pairing | null = null;
  let cancelPending: (() => void) | undefined;
  const setPairing = (next: Pairing | null) => {
    pairing = next;
    for (const listener of listeners) listener();
  };
  const providers = new Map<string, EIP1193Provider>();
  const defaultChain = DEFAULT_CHAIN_ID === hardhat.id ? hardhat : getChain(DEFAULT_CHAIN_ID);
  const chains = [
    defaultChain,
    ...Object.values(SUPPORTED_CHAINS).filter((chain) => chain.id !== DEFAULT_CHAIN_ID),
  ] as const;
  let storage: Storage | undefined;
  try {
    storage = window.localStorage;
  } catch {
    // A restricted browser can still sign in in this tab.
  }
  const config = createConfig({
    chains,
    transports: createAppKitTransports([...chains]),
    storage: createStorage({ storage, key: "gg.openfort.wagmi" }),
    multiInjectedProviderDiscovery: false,
    connectors: wallets.map((wallet) =>
      createNamedConnector(
        wallet,
        providers,
        projectId,
        metadata,
        (next) => {
          setPairing(next);
          return () => {
            if (pairing === next) setPairing(null);
          };
        },
        (cancel) => {
          cancelPending?.();
          cancelPending = cancel;
          return () => {
            if (cancelPending === cancel) cancelPending = undefined;
          };
        },
        (event) => {
          for (const listener of connectionListeners) listener(event);
        }
      )
    ),
  });
  boundConnectorRestores(config);
  return {
    config,
    announceProvider(event: Event) {
      const detail = (event as AnnouncedProvider).detail;
      if (
        typeof detail?.info?.rdns === "string" &&
        typeof detail.provider?.request === "function"
      ) {
        providers.set(detail.info.rdns, detail.provider);
      }
    },
    getPairing: () => pairing,
    subscribeConnection: (listener: (event: WalletConnectEvent) => void) => {
      connectionListeners.add(listener);
      return () => connectionListeners.delete(listener);
    },
    subscribePairing: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    cancelPairing: () => {
      cancelPending?.();
      setPairing(null);
    },
  };
}
