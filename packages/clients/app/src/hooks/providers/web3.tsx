import {
  useConnect,
  useEthereum,
  useUserInfo,
} from "@particle-network/auth-core-modal";
import { UserInfo } from "@particle-network/auth-core";
import { createContext, useContext, useState } from "react";
import { EVMProvider } from "@particle-network/auth-core-modal/dist/context/evmProvider";
import { ethers } from "ethers";

export interface Web3Props {
  error: null | string;
  authenticating: boolean;
  connected: boolean;
  address: string | null;
  provider: EVMProvider;
  ethersProvider?: ethers.BrowserProvider;
  user?: UserInfo;
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

  const { address, provider } = useEthereum();
  const { userInfo } = useUserInfo();
  const { connect, disconnect, connected } = useConnect();

  const [error, setError] = useState<null | string>(null);

  // @ts-ignore
  const ethersProvider = provider && new ethers.BrowserProvider(provider);

  // const signer = ethers.Jso

  async function handleConnect(): Promise<void> {
    try {
      await connect();
      setError(null);
    } catch (err: any) {
      err && err.message && setError(err.message);
      console.error("ERROR CONNECTING WALLET", err);
    }
  }

  async function login() {
    try {
      if (connected) {
        return;
      }

      setAuthenticating(true);
      setError(null);

      if (!address) {
        await handleConnect();
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
      await disconnect();
    } catch (err: any) {
      err && err.message && setError(err.message);
      console.error("ERROR DICONNECTING WALLET", err);
    }
  }

  return (
    <Web3Context.Provider
      value={{
        error,
        authenticating,
        connected,
        address,
        user: userInfo,
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
