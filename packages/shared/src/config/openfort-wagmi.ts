import { createConnector, injected } from "@wagmi/core";
import { type EIP1193Provider, UserRejectedRequestError } from "viem";
import { createConfig, createStorage } from "wagmi";
import { hardhat } from "viem/chains";
import { walletConnect } from "wagmi/connectors";
import { boundConnectorRestores } from "../modules/auth/connector-restore-deadline";
import { type AppKitMetadata, createAppKitTransports } from "./appkit";
import { getChain, SUPPORTED_CHAINS } from "./chains";
import { DEFAULT_CHAIN_ID } from "./default-chain";

const wallets = [
  { id: "io.rabby", name: "Rabby", flag: "isRabby", mobileUrl: "rabby://wc" },
  { id: "me.rainbow", name: "Rainbow", flag: "isRainbow", mobileUrl: "https://rnbwapp.com/wc" },
  {
    id: "io.metamask",
    name: "MetaMask",
    flag: "isMetaMask",
    mobileUrl: "https://metamask.app.link/wc",
  },
] as const;

type NamedWallet = (typeof wallets)[number];
type AnnouncedProvider = CustomEvent<{ info: { rdns: string }; provider: EIP1193Provider }>;
type Pairing = { wallet: NamedWallet; uri: string };

function createNamedConnector(
  wallet: NamedWallet,
  providers: ReadonlyMap<string, EIP1193Provider>,
  projectId: string,
  metadata: AppKitMetadata,
  showPairing: (pairing: Pairing) => () => void,
  trackPairing: (cancel: () => void) => () => void
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
    const relay = {
      ...walletConnect({
        projectId,
        metadata,
        showQrModal: false,
        customStoragePrefix: wallet.id,
      })(config),
      id: wallet.id,
    };
    let active: "browser" | "relay" | undefined;
    let manualConnection = false;

    const select = async () =>
      active === "browser"
        ? browser
        : active === "relay"
          ? relay
          : (await browser.getProvider()) || !projectId
            ? browser
            : relay;

    return {
      ...browser,
      // The Openfort bridge uses this connector's getProvider and connect for both transports.
      id: wallet.id,
      name: wallet.name,
      async setup() {
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
        if (projectId && (await relay.isAuthorized())) {
          active = "relay";
          return true;
        }
        return false;
      },
      async connect(params) {
        const connector = await select();
        const next = connector === browser ? "browser" : "relay";
        if (next === "browser" || params?.isReconnecting) {
          const result = await connector.connect(params);
          active = next;
          return result;
        }

        if (manualConnection) throw new Error("A wallet pairing is already in progress");
        manualConnection = true;
        let hidePairing: (() => void) | undefined;
        let cancelled = false;
        const provider = relay.getProvider();
        const cancel = () => {
          cancelled = true;
          void provider.then(
            (current) => current?.signer.abortPairingAttempt(),
            () => undefined
          );
        };
        const stopTracking = trackPairing(cancel);
        const rejected = () => new UserRejectedRequestError(new Error("Wallet pairing cancelled"));
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
          await provider;
          if (cancelled) throw rejected();
          const connection = await relay.connect(params);
          if (cancelled) {
            await relay.disconnect();
            throw rejected();
          }
          active = "relay";
          return connection;
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
