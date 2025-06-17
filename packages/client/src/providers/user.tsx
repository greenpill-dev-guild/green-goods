import { type ConnectedWallet, type User, usePrivy, useWallets } from "@privy-io/react-auth";
import { type SmartWalletClientType, useSmartWallets } from "@privy-io/react-auth/smart-wallets";
import React, { useContext, useEffect } from "react";
import { identify } from "@/modules/posthog";

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
  const { client } = useSmartWallets();

  const eoa = wallets.find((wallet) => wallet.walletClientType === "privy");
  const smartAccount = user?.linkedAccounts.find((account) => account.type === "smart_wallet");

  useEffect(() => {
    if (user) {
      identify(user.id);
    }
  }, [user]);

  useEffect(() => {
    // Make smart account client available globally for offline sync
    if (client) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).smartAccountClient = client;
    }
  }, [client]);

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
