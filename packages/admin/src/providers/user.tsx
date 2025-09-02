import { type ConnectedWallet, type User, usePrivy, useWallets } from "@privy-io/react-auth";
import React, { useContext } from "react";
// import { DEFAULT_CHAIN_ID } from "@/config";"

interface UserInterface {
  ready: boolean;
  user: User | null;
  eoa?: ConnectedWallet | null;
  address?: string | null;
}

const UserContext = React.createContext<UserInterface>({
  ready: false,
  user: null,
  eoa: null,
  address: null,
});

export const useUser = () => {
  return useContext(UserContext);
};

export const UserProvider = ({ children }: { children: React.ReactNode }) => {
  const { wallets } = useWallets();
  const { ready, user } = usePrivy();

  const eoa = wallets.find((wallet) => wallet.walletClientType === "privy");
  const address = eoa?.address;

  return (
    <UserContext.Provider
      value={{
        user,
        ready,
        eoa,
        address,
      }}
    >
      {children}
    </UserContext.Provider>
  );
};