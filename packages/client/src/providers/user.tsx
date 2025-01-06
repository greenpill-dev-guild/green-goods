import React, { useState, useEffect, useContext } from "react";
import {
  User,
  useLogin,
  useLogout,
  usePrivy,
  useWallets,
  ConnectedWallet,
} from "@privy-io/react-auth";

import {
  ENTRYPOINT_ADDRESS_V07,
  type SmartAccountClient,
  createSmartAccountClient,
  walletClientToSmartAccountSigner,
} from "permissionless";
import {
  SmartAccount,
  signerToSafeSmartAccount,
} from "permissionless/accounts";
import {
  createPimlicoBundlerClient,
  createPimlicoPaymasterClient,
} from "permissionless/clients/pimlico";
import { EntryPoint } from "permissionless/types";

import { arbitrum } from "viem/chains";
import { Chain, Transport } from "viem";
import { createPublicClient, createWalletClient, custom, http } from "viem";

type SAC = SmartAccountClient<
  EntryPoint,
  Transport,
  Chain,
  SmartAccount<EntryPoint, string, Transport, Chain>
>;

interface UserInterface {
  authenticating: boolean;
  user: User | null;
  isOnboarded: boolean;
  eoa?: ConnectedWallet;
  smartAccountReady: boolean;
  smartAccountAddress?: `0x${string}`;
  smartAccountClient: SAC | null;
  login: () => void;
  logout: () => void;
}

const UserContext = React.createContext<UserInterface>({
  authenticating: true,
  user: null,
  isOnboarded: false,
  eoa: undefined,
  smartAccountClient: null,
  smartAccountAddress: undefined,
  smartAccountReady: false,
  login: () => {},
  logout: () => {},
});

export const useUser = () => {
  return useContext(UserContext);
};

export const UserProvider = ({ children }: { children: React.ReactNode }) => {
  const [authenticating, setAuthenticating] = useState(true);
  const [isOnboarded, setOnboarded] = useState(false);

  const { wallets } = useWallets();
  const { ready, user } = usePrivy();
  const { login } = useLogin({
    onComplete(isNewUser) {
      setOnboarded(!isNewUser);
    },
    onError(error) {
      console.error("Privy error logging in", error);
    },
  });
  const { logout } = useLogout();
  const embeddedWallet = wallets.find(
    (wallet) => wallet.walletClientType === "privy"
  );

  const [eoa, setEoa] = useState<ConnectedWallet | undefined>();
  const [smartAccountClient, setSmartAccountClient] = useState<SAC | null>(
    null
  );
  const [smartAccountAddress, setSmartAccountAddress] = useState<
    `0x${string}` | undefined
  >();
  const [smartAccountReady, setSmartAccountReady] = useState(false);

  useEffect(() => {
    if (!ready) return;
  }, [ready, embeddedWallet]);

  useEffect(() => {
    const createSmartWallet = async (eoa: ConnectedWallet) => {
      setEoa(eoa);
      // Get an EIP1193 provider and viem WalletClient for the EOA
      const eip1193provider = await eoa.getEthereumProvider();
      const privyClient = createWalletClient({
        account: eoa.address as `0x${string}`,
        chain: arbitrum,
        transport: custom(eip1193provider),
      });

      const customSigner = walletClientToSmartAccountSigner(privyClient);

      const publicClient = createPublicClient({
        chain: arbitrum, // Replace this with the chain of your app
        transport: http(),
      });

      const safeAccount = await signerToSafeSmartAccount(publicClient, {
        signer: customSigner,
        safeVersion: "1.4.1",
        entryPoint: ENTRYPOINT_ADDRESS_V07,
      });

      const pimlicoPaymaster = createPimlicoPaymasterClient({
        chain: arbitrum,
        transport: http(
          `https://api.pimlico.io/v2/42161/rpc?apikey=${import.meta.env.VITE_PIMLICO_API_KEY}`
        ),
        entryPoint: ENTRYPOINT_ADDRESS_V07,
      });

      const pimlicoBundler = createPimlicoBundlerClient({
        transport: http(
          `https://api.pimlico.io/v2/42161/rpc?apikey=${import.meta.env.VITE_PIMLICO_API_KEY}`
        ),
        entryPoint: ENTRYPOINT_ADDRESS_V07,
      });

      const smartAccountClient = createSmartAccountClient({
        account: safeAccount,
        entryPoint: ENTRYPOINT_ADDRESS_V07,
        name: "Green Goods Gardener Smart Account",
        chain: arbitrum, // Replace this with the chain for your app
        bundlerTransport: http(
          `https://api.pimlico.io/v2/42161/rpc?apikey=${import.meta.env.VITE_PIMLICO_API_KEY}`
        ),
        middleware: {
          sponsorUserOperation: pimlicoPaymaster.sponsorUserOperation,
          gasPrice: async () =>
            (await pimlicoBundler.getUserOperationGasPrice()).fast,
        },
      });

      const smartAccountAddress = smartAccountClient.account?.address;

      // Todo: Add test attestation to check if smart account is ready

      setSmartAccountClient(
        smartAccountClient as SmartAccountClient<
          EntryPoint,
          Transport,
          Chain,
          SmartAccount<EntryPoint, string, Transport, Chain>
        >
      );
      setSmartAccountAddress(smartAccountAddress);
      setSmartAccountReady(true);
      setAuthenticating(false);
    };

    if (embeddedWallet) createSmartWallet(embeddedWallet);
  }, [embeddedWallet?.address]);

  console.log(smartAccountAddress);

  return (
    <UserContext.Provider
      value={{
        authenticating,
        user,
        isOnboarded,
        smartAccountReady,
        smartAccountClient,
        smartAccountAddress,
        eoa,
        login,
        logout,
      }}
    >
      {children}
    </UserContext.Provider>
  );
};
