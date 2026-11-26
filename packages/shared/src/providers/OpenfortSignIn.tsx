import {
  AuthProvider as OpenfortAuthMethod,
  OpenfortEvents,
  OpenfortProvider,
  useOpenfort,
  useUI,
} from "@openfort/react";
import { OpenfortWagmiBridge } from "@openfort/react/wagmi";
import { useContext, useEffect, useEffectEvent, useRef, useState } from "react";
import { IntlContext } from "react-intl";
import type { OpenfortKeys } from "../config/openfort";
import { asHexAddress } from "../modules/auth/passkey-profile-storage";
import { guardSessionCommit } from "../modules/auth/sessionSignOut";
import type { WalletModalResult } from "../hooks/auth/useWalletModalOpen";
import { useAuthActions } from "./Auth";

interface OpenfortSignInProps {
  keys: Partial<OpenfortKeys> & { publishableKey: string };
  appName: string;
  screen: "providers" | "wallets" | "profile";
  isCurrent?: () => boolean;
  onFinish: (result: WalletModalResult) => void;
}

export default function OpenfortSignIn({
  keys,
  appName,
  screen,
  onFinish,
  isCurrent,
}: OpenfortSignInProps) {
  const locale = useContext(IntlContext)?.locale.split("-")[0];
  const language = locale === "es" ? "es-ES" : locale === "pt" ? "pt-BR" : "en-US";
  // The pinned SDK reads this option but omits it from its public config type.
  const uiConfig = {
    appName,
    language,
    authProviders: keys.shieldPublishableKey
      ? [OpenfortAuthMethod.EMAIL_OTP, OpenfortAuthMethod.WALLET]
      : [OpenfortAuthMethod.WALLET],
    hideRecentBadge: true,
    embedGoogleFonts: false,
    enforceSupportedChains: false,
  };
  const [storage] = useState(() => {
    const values = new Map<string, string>();
    // A dismissed sheet cannot leave an Openfort session on a shared device.
    // The Hub takes ownership only after the email code has been verified.
    return {
      get: async (key: string) => values.get(key) ?? null,
      save: (key: string, value: string) => {
        values.set(key, value);
      },
      remove: (key: string) => {
        values.delete(key);
      },
      flush: () => values.clear(),
    };
  });
  return (
    <OpenfortWagmiBridge>
      <OpenfortProvider
        publishableKey={keys.publishableKey}
        overrides={{ storage }}
        walletConfig={
          keys.shieldPublishableKey
            ? { shieldPublishableKey: keys.shieldPublishableKey, connectOnLogin: false }
            : undefined
        }
        uiConfig={uiConfig}
      >
        <OpenfortSignInDialog screen={screen} onFinish={onFinish} isCurrent={isCurrent} />
      </OpenfortProvider>
    </OpenfortWagmiBridge>
  );
}

function OpenfortSignInDialog({
  onFinish,
  screen,
  isCurrent,
}: Pick<OpenfortSignInProps, "onFinish" | "screen" | "isCurrent">) {
  const client = useOpenfort((state) => state.client);
  const { openProviders, openWallets, openProfile, isOpen } = useUI();
  const { loginWithOpenfortSession, loginWithConnectedWallet } = useAuthActions();
  const emailAttempt = useRef(false);
  const shown = useRef(false);
  const open = useEffectEvent(() => {
    if (screen === "profile") openProfile();
    else if (screen === "wallets") openWallets();
    else openProviders();
  });
  const finish = useEffectEvent(onFinish);
  const current = useEffectEvent(() => isCurrent?.() ?? true);
  const [sessionIsCurrent] = useState(() => guardSessionCommit(new AbortController().signal));

  useEffect(() => {
    const auth = client.auth;
    const loginWithSiwe = auth.loginWithSiwe;
    const canFinish = () => {
      if (!current()) return false;
      try {
        sessionIsCurrent();
        return true;
      } catch {
        finish("dismissed");
        return false;
      }
    };
    // The SDK event does not identify the signer. Adopt the address in the verified SIWE
    // request, even if the connector reported a different address while the request was in flight.
    const verifyWallet: typeof loginWithSiwe = async (request) => {
      const response = await loginWithSiwe.call(auth, request);
      if (canFinish()) {
        const address = asHexAddress(request.address);
        finish(address && loginWithConnectedWallet?.(address) ? "dismissed" : "wallet-error");
      }
      return response;
    };
    const begin = ({ method }: { method: string }) => {
      emailAttempt.current = method === "email";
    };
    const complete = ({
      token,
      user,
    }: {
      token: string | null;
      user: { email?: string; id: string };
    }) => {
      if (!emailAttempt.current || !canFinish()) return;
      if (!token || !user.email || !loginWithOpenfortSession) {
        finish("email-error");
        return;
      }
      void loginWithOpenfortSession({ email: user.email, userId: user.id, token }).then(
        () => finish("email"),
        () => finish("email-error")
      );
    };
    auth.loginWithSiwe = verifyWallet;
    client.eventEmitter.on(OpenfortEvents.ON_AUTH_INIT, begin);
    client.eventEmitter.on(OpenfortEvents.ON_AUTH_SUCCESS, complete);
    return () => {
      auth.loginWithSiwe = loginWithSiwe;
      client.eventEmitter.off(OpenfortEvents.ON_AUTH_INIT, begin);
      client.eventEmitter.off(OpenfortEvents.ON_AUTH_SUCCESS, complete);
    };
  }, [client, loginWithConnectedWallet, loginWithOpenfortSession, sessionIsCurrent]);

  useEffect(() => open(), []);
  useEffect(() => {
    if (isOpen) shown.current = true;
    else if (shown.current) finish("dismissed");
  }, [isOpen]);

  return null;
}
