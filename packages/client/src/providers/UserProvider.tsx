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

import React, { useState, useEffect, useContext } from "react";
import { ConnectedWallet, usePrivy, useWallets } from "@privy-io/react-auth";

import { arbitrum } from "viem/chains";
import { Chain, Transport } from "viem";
import { createPublicClient, createWalletClient, custom, http } from "viem";

interface UserInterface {
  isOnboarded: boolean;
  eoa: ConnectedWallet | undefined;
  smartAccountReady: boolean;
  smartAccountAddress: `0x${string}` | undefined;
  smartAccountClient: SmartAccountClient<
    EntryPoint,
    Transport,
    Chain,
    SmartAccount<EntryPoint, string, Transport, Chain>
  > | null;
}

const UserContext = React.createContext<UserInterface>({
  isOnboarded: false,
  eoa: undefined,
  smartAccountClient: null,
  smartAccountAddress: undefined,
  smartAccountReady: false,
});

export const useUser = () => {
  return useContext(UserContext);
};

export const UserProvider = ({ children }: { children: React.ReactNode }) => {
  // Get a list of all of the wallets (EOAs) the user has connected to your site
  const { wallets } = useWallets();
  const { ready } = usePrivy();
  // Find the embedded wallet by finding the entry in the list with a `walletClientType` of 'privy'
  const embeddedWallet = wallets.find(
    (wallet) => wallet.walletClientType === "privy"
  );

  // States to store the smart account and its status
  const [eoa, setEoa] = useState<ConnectedWallet | undefined>();
  const [smartAccountClient, setSmartAccountClient] =
    useState<SmartAccountClient<
      EntryPoint,
      Transport,
      Chain,
      SmartAccount<EntryPoint, string, Transport, Chain>
    > | null>(null);
  const [smartAccountAddress, setSmartAccountAddress] = useState<
    `0x${string}` | undefined
  >();
  const [smartAccountReady, setSmartAccountReady] = useState(false);

  useEffect(() => {
    if (!ready) return;
  }, [ready, embeddedWallet]);

  useEffect(() => {
    // Creates a smart account given a Privy `ConnectedWallet` object representing
    // the  user's EOA.
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

      console.log("smartAccountClient", smartAccountClient.account.address);
    };

    if (embeddedWallet) createSmartWallet(embeddedWallet);
  }, [embeddedWallet?.address]);

  return (
    <UserContext.Provider
      value={{
        isOnboarded: false, // Todo - implement onboard check
        smartAccountReady: smartAccountReady,
        smartAccountClient: smartAccountClient,
        smartAccountAddress: smartAccountAddress,
        eoa: eoa,
      }}
    >
      {children}
    </UserContext.Provider>
  );
};
