import { mainnet } from "viem/chains";
import { createWalletClient, custom } from "viem";
import { createContext, useContext, useState } from "react";

import { useEthereum } from "@particle-network/auth-core-modal";

export interface Web3Props {
  error: null | string;
  address?: `0x${string}`;
  handleConnect: () => Promise<void>;
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

  const { provider } = useEthereum();

  const viemProvider = createWalletClient({
    chain: mainnet,
    transport: custom(provider),
  });

  const particleProvider = new ParticleProvider(particle.auth);

  // const chainId = useChainId();
  // const { address } = useAccount();
  // const { disconnectAsync } = useDisconnect();
  // const { signMessageAsync } = useSignMessage();

  const [error, setError] = useState<null | string>(null);

  async function handleConnect(): Promise<void> {
    try {
      setError(null);
    } catch (err: any) {
      err && err.message && setError(err.message);
      console.error("ERROR CONNECTING WALLET", err);
    }
  }

  async function login() {
    try {
      // if (authenticated || authenticating) {
      //   return;
      // }

      setAuthenticating(true);
      setError(null);

      // if (!address) {
      //   handleConnect();
      //   setAuthenticating(false);

      //   return;
      // }

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
      // await disconnectAsync();

      localStorage.setItem("authenticated", "false");
    } catch (err: any) {
      err && err.message && setError(err.message);
      console.error("ERROR DICONNECTING WALLET", err);
    }
  }

  // useEffect(() => {
  //   if (address) {
  //     login();
  //   }
  // }, [address]);

  return (
    <Web3Context.Provider
      value={{
        error,
        address: `0x${"address"}`,
        // ready,
        // activeWallet,
        // wallets,
        handleConnect,
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
