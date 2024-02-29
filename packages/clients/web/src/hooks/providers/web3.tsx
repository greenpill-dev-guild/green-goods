import { useAccount, useDisconnect, useSignMessage } from "wagmi";
import { createContext, useContext, useEffect, useState } from "react";

// TODO: Verify SIWE is working
// TODO: Add with credentials to login

export interface Web3Props {
  error: null | string;
  // ready: boolean;
  address?: `0x${string}`;
  // activeWallet?: ConnectedWallet;
  // wallets: ConnectedWallet[];
  handleConnect: () => Promise<void>;
  signMessage: (message: string) => Promise<string | void>;
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

  // const chainId = useChainId();
  const { address } = useAccount();
  const { disconnectAsync } = useDisconnect();
  const { signMessageAsync } = useSignMessage();

  const [error, setError] = useState<null | string>(null);

  async function handleConnect(): Promise<void> {
    try {
      setError(null);
    } catch (err: any) {
      err && err.message && setError(err.message);
      console.error("ERROR CONNECTING WALLET", err);
    }
  }

  async function signMessage(message: string): Promise<string | void> {
    try {
      setError(null);
      const msg = await signMessageAsync({ message });
      return msg;
    } catch (err: any) {
      err && err.message && setError(err.message);
      console.error("ERROR SIGNING MSG", err);
    }
  }

  async function login() {
    try {
      // if (authenticated || authenticating) {
      //   return;
      // }

      setAuthenticating(true);
      setError(null);

      if (!address) {
        handleConnect();
        setAuthenticating(false);

        return;
      }

      setAuthenticating(false);

      localStorage.setItem("authenticated", "true");
    } catch (err: any) {
      setAuthenticating(false);
      err && err.message && setError(err.message);
      console.error("ERROR AUTHENTICATING", err);
    }
  }

  async function logout(): Promise<void> {
    try {
      setError(null);
      await disconnectAsync();

      localStorage.setItem("authenticated", "false");
    } catch (err: any) {
      err && err.message && setError(err.message);
      console.error("ERROR DICONNECTING WALLET", err);
    }
  }

  useEffect(() => {
    if (address) {
      login();
    }
  }, [address]);

  return (
    <Web3Context.Provider
      value={{
        error,
        address,
        // ready,
        // activeWallet,
        // wallets,
        handleConnect,
        signMessage,
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
