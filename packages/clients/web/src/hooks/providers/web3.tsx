import { ethers } from "ethers";
import {
  useAccount,
  useConnectKit,
  useConnectModal,
  useParticleProvider,
} from "@particle-network/connect-react-ui";
import { createContext, useContext, useEffect, useState } from "react";
import { Provider } from "@particle-network/connect";

export interface Web3Props {
  error: null | string;
  authenticating: boolean;
  connected: boolean;
  address: string | null;
  provider?: Provider;
  ethersProvider?: ethers.BrowserProvider;
  // user?: WalletMeta;
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

  const [authenticating, setAuthenticating] = useState(false);

  const account = useAccount();
  const provider = useParticleProvider();
  const { openConnectModal } = useConnectModal();
  const { disconnect } = useConnectKit();

  const [error, setError] = useState<null | string>(null);

  // @ts-ignore
  const ethersProvider = provider && new ethers.BrowserProvider(provider);

  async function handleConnect(): Promise<void> {
    try {
      openConnectModal && openConnectModal();
      setError(null);
    } catch (err: any) {
      err && err.message && setError(err.message);
      console.error("ERROR CONNECTING WALLET", err);
    }
  }

  async function login() {
    try {
      setAuthenticating(true);
      setError(null);

      if (!account) {
        handleConnect();

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
      await disconnect();
    } catch (err: any) {
      err && err.message && setError(err.message);
      console.error("ERROR DICONNECTING WALLET", err);
    }
  }

  useEffect(() => {
    if (account) {
      setAuthenticating(false);
    }
  }, [account]);

  return (
    <Web3Context.Provider
      value={{
        error,
        authenticating,
        connected: !!account,
        address: account ?? null,
        // user: walletMetas()[0],
        provider,
        ethersProvider,
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
