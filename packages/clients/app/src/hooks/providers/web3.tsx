import {
  usePrivy,
  useWallets,
  User,
  ConnectedWallet,
  UnsignedTransactionRequest,
  SendTransactionModalUIOptions,
} from "@privy-io/react-auth";
import { usePrivySmartAccount } from "@zerodev/privy";
import { createContext, useContext, useState } from "react";

export interface Web3Props {
  error: null | string;
  ready: boolean;
  zeroDevReady: boolean;
  address: string | null;
  user: User | null;
  activeWallet?: ConnectedWallet;
  wallets: ConnectedWallet[];
  // signer: Json
  sendTransaction: (
    data: UnsignedTransactionRequest,
    uiOptions?: SendTransactionModalUIOptions | undefined
  ) => Promise<`0x${string}`>;
  login: () => Promise<void>;
  logout: () => Promise<void>;
}

const Web3Context = createContext<Web3Props | null>(null);

type Props = {
  children: React.ReactNode;
};

export const Web3Provider = ({ children }: Props) => {
  const currentValue = useContext(Web3Context);

  if (currentValue) throw new Error("AppProvider can only be used once");

  const {
    ready,
    authenticated,
    login: privyLogin,
    logout: privyLogout,
    zeroDevReady,
    sendTransaction,
  } = usePrivySmartAccount();
  const { user } = usePrivy();
  const { wallets } = useWallets();

  const activeWallet = wallets[0];
  const address = activeWallet?.address;
  // const signer = getEthersProvider().getSigner();

  const [error, setError] = useState<null | string>(null);
  const [authenticating, setAuthenticating] = useState(false);

  async function login() {
    try {
      if (authenticated || authenticating) {
        console.log("Already authenticated...");
        return;
      }

      setAuthenticating(true);
      setError(null);

      if (!address) {
        privyLogin();
        setAuthenticating(false);

        return;
      }

      setAuthenticating(false);
    } catch (err: any) {
      setAuthenticating(false);
      err && err.message && setError(err.message);
      console.error("ERROR AUTHENTICATING", err);
    }
  }

  async function logout(): Promise<void> {
    try {
      setError(null);
      await privyLogout();
    } catch (err: any) {
      err && err.message && setError(err.message);
      console.error("ERROR DICONNECTING WALLET", err);
    }
  }

  return (
    <Web3Context.Provider
      value={{
        error,
        ready,
        zeroDevReady,
        address,
        user,
        activeWallet,
        wallets,
        sendTransaction,
        login,
        logout,
      }}
    >
      {children}
    </Web3Context.Provider>
  );
};

export const useWeb3 = (): Web3Props => {
  const value = useContext(Web3Context);
  if (!value) throw new Error("Must be used within a AppProvider");
  return value;
};
