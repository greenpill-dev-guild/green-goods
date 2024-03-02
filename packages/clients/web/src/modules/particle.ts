import { evmWallets } from "@particle-network/connect";
import { ConnectConfig } from "@particle-network/connect";
import { BaseSepolia, Base } from "@particle-network/chains";

export const particleConfig: ConnectConfig = {
  projectId: import.meta.env.VITE_PARTICLE_PROJECT_ID ?? "",
  clientKey: import.meta.env.VITE_PARTICLE_CLIENT_KEY ?? "",
  appId: import.meta.env.VITE_PARTICLE_APP_ID ?? "",
  chains: [Base, BaseSepolia],
  particleWalletEntry: {
    customStyle: {
      supportChains: [Base, BaseSepolia],
    },
  },
  securityAccount: {
    promptSettingWhenSign: 1,
    promptMasterPasswordSettingWhenLogin: 1,
  },
  wallets: evmWallets({
    projectId: import.meta.env.VITE_WALLET_CONNECT_ID ?? "", //replace with walletconnect projectId
    showQrModal: false,
  }),
  // erc4337: {
  //   name: "SIMPLE",
  //   version: "1.0.0",
  // },
};
