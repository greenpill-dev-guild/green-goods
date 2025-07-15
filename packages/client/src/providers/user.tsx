import { type ConnectedWallet, type User, usePrivy, useWallets } from "@privy-io/react-auth";
import { type SmartWalletClientType, useSmartWallets } from "@privy-io/react-auth/smart-wallets";
import React, { useContext, useEffect } from "react";
import { identify } from "@/modules/posthog";
import { offlineSync } from "@/modules/offline-sync";

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
    // Provide smart account client to offline sync service
    offlineSync.setSmartAccountClient(client);
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
