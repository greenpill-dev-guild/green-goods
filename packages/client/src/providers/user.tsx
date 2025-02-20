import {
  User,
  usePrivy,
  useWallets,
  ConnectedWallet,
} from "@privy-io/react-auth";
import React, { useContext } from "react";
import {
  useSmartWallets,
  SmartWalletClientTypeWithSwitchChain,
} from "@privy-io/react-auth/smart-wallets";

interface UserInterface {
  ready: boolean;
  user: User | null;
  eoa?: ConnectedWallet | null;
  smartAccountAddress?: string | null;
  smartAccountClient?: SmartWalletClientTypeWithSwitchChain | null;
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
  const smartAccount = user?.linkedAccounts.find(
    (account) => account.type === "smart_wallet"
  );

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
