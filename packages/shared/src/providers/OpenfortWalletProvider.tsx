import { QRCodeSVG } from "qrcode.react";
import {
  lazy,
  type ReactNode,
  Suspense,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { IntlContext } from "react-intl";
import { WagmiProvider } from "wagmi";
import { activeWagmiConfig, type AppKitMetadata, setMountedWagmiConfig } from "../config/appkit";
import { getOpenfortKeys, getOpenfortWalletKey, isOpenfortSignInEnabled } from "../config/openfort";
import { createOpenfortWalletRuntime, isMobileWalletBrowser } from "../config/openfort-wagmi";
import { WalletModalContext, type WalletModalResult } from "../hooks/auth/useWalletModalOpen";
import { useEventListener } from "../hooks/utils/useEventListener";
import { getAuthMode } from "../modules/auth/session";
import { AuthGate } from "./AuthGate";

const OpenfortSignIn = lazy(() => import("./OpenfortSignIn"));

type Request = {
  screen: "providers" | "wallets" | "profile";
  onFinish?: (result: WalletModalResult) => void;
};

function createChooser() {
  const listeners = new Set<() => void>();
  let request: Request | null = null;
  const update = (next: Request | null) => {
    request = next;
    for (const listener of listeners) listener();
  };
  return {
    openProviders: (onFinish?: Request["onFinish"]) => {
      if (!request) update({ screen: "providers", onFinish });
    },
    openWallets: () => {
      if (!request) update({ screen: "wallets" });
    },
    openProfile: () => {
      if (!request) update({ screen: "profile" });
    },
    close: () => update(null),
    getRequest: () => request,
    isOpen: () => request !== null,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

type WalletRuntime = ReturnType<typeof createOpenfortWalletRuntime>;
let runtime: WalletRuntime | undefined;

export function OpenfortWalletProvider({
  children,
  projectId,
  metadata,
}: {
  children: ReactNode;
  projectId: string;
  metadata: AppKitMetadata;
}) {
  const inherited = useContext(WalletModalContext);
  if (inherited) return children;
  runtime ??= createOpenfortWalletRuntime(projectId?.trim() || "", metadata);
  setMountedWagmiConfig(runtime.config);
  return (
    <WagmiProvider
      config={activeWagmiConfig(runtime.config)}
      reconnectOnMount={getAuthMode() === "wallet"}
    >
      <OpenfortWalletSession runtime={runtime} appName={metadata.name}>
        {children}
      </OpenfortWalletSession>
    </WagmiProvider>
  );
}

function OpenfortWalletSession({
  children,
  runtime,
  appName,
}: {
  children: ReactNode;
  runtime: WalletRuntime;
  appName: string;
}) {
  const [chooser] = useState(() => {
    const modal = createChooser();
    return {
      ...modal,
      subscribeConnection: runtime.subscribeConnection,
      close: () => {
        runtime.cancelPairing();
        modal.close();
      },
    };
  });
  const request = useSyncExternalStore(chooser.subscribe, chooser.getRequest);
  const publishableKey = getOpenfortWalletKey();
  const emailKeys =
    request?.screen === "providers" && isOpenfortSignInEnabled() ? getOpenfortKeys() : null;
  const finish = (result: WalletModalResult) => {
    if (chooser.getRequest() !== request) return;
    chooser.close();
    request?.onFinish?.(result);
  };

  useEventListener<EventTarget, "eip6963:announceProvider">(
    typeof window === "undefined" ? null : window,
    "eip6963:announceProvider",
    runtime.announceProvider
  );
  useEffect(() => {
    window.dispatchEvent(new Event("eip6963:requestProvider"));
    return () => runtime.cancelPairing();
  }, [runtime]);

  return (
    <WalletModalContext value={chooser}>
      <AuthGate>
        {children}
        {request && publishableKey && (
          <Suspense fallback={null}>
            <OpenfortSignIn
              keys={emailKeys ?? { publishableKey }}
              appName={appName}
              screen={request.screen}
              isCurrent={() => chooser.getRequest() === request}
              onFinish={finish}
            />
          </Suspense>
        )}
        {request && !publishableKey && <WalletUnavailable onClose={() => finish("wallet-error")} />}
        <WalletPairing runtime={runtime} />
      </AuthGate>
    </WalletModalContext>
  );
}

function WalletUnavailable({ onClose }: { onClose: () => void }) {
  const intl = useContext(IntlContext);
  const message = {
    id: "app.wallet.openfort.unavailable",
    defaultMessage: "Wallet sign-in is unavailable right now.",
  };
  const action = { id: "app.common.close", defaultMessage: "Close" };
  return (
    <WalletHandoffDialog
      title={intl?.formatMessage(message) ?? message.defaultMessage}
      onClose={onClose}
    >
      <button className="underline" type="button" onClick={onClose}>
        {intl?.formatMessage(action) ?? action.defaultMessage}
      </button>
    </WalletHandoffDialog>
  );
}

function WalletPairing({ runtime }: { runtime: WalletRuntime }) {
  const pairing = useSyncExternalStore(runtime.subscribePairing, runtime.getPairing);
  const intl = useContext(IntlContext);
  if (!pairing) return null;

  const { wallet, uri } = pairing;
  const values = { wallet: wallet.name };
  const title = { id: "app.wallet.openfort.pairing.title", defaultMessage: "Connect to {wallet}" };
  const scan = {
    id: "app.wallet.openfort.pairing.scan",
    defaultMessage: "Scan the code with {wallet} on your phone.",
  };
  const open = { id: "app.wallet.openfort.pairing.open", defaultMessage: "Open {wallet}" };
  const cancel = { id: "app.common.cancel", defaultMessage: "Cancel" };
  const url = new URL(wallet.mobileUrl);
  url.searchParams.set("uri", uri);
  const mobile = isMobileWalletBrowser();
  return (
    <WalletHandoffDialog
      title={
        intl?.formatMessage(title, values) ?? title.defaultMessage.replace("{wallet}", wallet.name)
      }
      onClose={runtime.cancelPairing}
    >
      {mobile ? (
        <a className="underline" href={url.href} rel="noreferrer">
          {intl?.formatMessage(open, values) ??
            open.defaultMessage.replace("{wallet}", wallet.name)}
        </a>
      ) : (
        <>
          <p>
            {intl?.formatMessage(scan, values) ??
              scan.defaultMessage.replace("{wallet}", wallet.name)}
          </p>
          <div className="mx-auto w-fit rounded-lg bg-static-white p-3">
            <QRCodeSVG aria-hidden="true" level="M" size={216} value={uri} />
          </div>
        </>
      )}
      <button className="underline" type="button" onClick={runtime.cancelPairing}>
        {intl?.formatMessage(cancel) ?? cancel.defaultMessage}
      </button>
    </WalletHandoffDialog>
  );
}

function WalletHandoffDialog({
  children,
  title,
  onClose,
}: {
  children: ReactNode;
  title: string;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const element = dialog.current;
    if (element && !element.open) element.showModal();
    return () => element?.close();
  }, []);
  // The native top layer makes the pairing controls usable above Openfort's modal portal.
  return (
    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      className="m-auto max-w-[calc(100vw-2rem)] rounded-xl bg-bg-white-0 p-6 text-text-main shadow-[var(--m3-elevation-2,var(--shadow-float))] backdrop:bg-[var(--admin-modal-scrim,var(--color-scrim))]"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <div className="flex flex-col items-center gap-4 text-center">
        <h2 id={titleId} className="type-title-md">
          {title}
        </h2>
        {children}
      </div>
    </dialog>
  );
}
