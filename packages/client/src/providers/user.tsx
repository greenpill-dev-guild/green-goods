import { type ConnectedWallet, type User, usePrivy, useWallets } from "@privy-io/react-auth";
import { type SmartWalletClientType, useSmartWallets } from "@privy-io/react-auth/smart-wallets";
import React, { useContext, useEffect } from "react";
// import { jobQueue } from "@/modules/job-queue";
import { identify } from "@/modules/posthog";
import { DEFAULT_CHAIN_ID } from "@/config";

interface UserInterface {
  ready: boolean;
  user: User | null;
  eoa?: ConnectedWallet | null;
  smartAccountAddress?: string | null;
  smartAccountClient?: SmartWalletClientType | null;
}

const UserContext = React.createContext<UserInterface>({
  ready: false,
  user: null,
});

export const useUser = () => {
  return useContext(UserContext);
};

export const UserProvider = ({ children }: { children: React.ReactNode }) => {
  const { wallets } = useWallets();
  const { ready, user } = usePrivy();
  const { client, getClientForChain } = useSmartWallets();

  const eoa = wallets.find((wallet) => wallet.walletClientType === "privy");
  const smartAccount = user?.linkedAccounts.find((account) => account.type === "smart_wallet");

  useEffect(() => {
    getClientForChain({ id: DEFAULT_CHAIN_ID })
      .then((client) => {
        console.log("client", client);
      })
      .catch((e) => {
        console.error("client error", e);
      });
    if (user) {
      identify(user.id);
    }
  }, [user]);

  return (
    <UserContext.Provider
      value={{
        user,
        ready,
        eoa,
        smartAccountAddress: smartAccount?.address,
        smartAccountClient: client,
      }}
    >
      {children}
    </UserContext.Provider>
  );
};
