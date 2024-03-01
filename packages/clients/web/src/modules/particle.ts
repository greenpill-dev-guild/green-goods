import {
  AuthCoreModalOptions,
  PromptSettingType,
} from "@particle-network/auth-core-modal";
import { AuthType } from "@particle-network/auth-core";
import { BaseSepolia, Base } from "@particle-network/chains";

export const particleConfig: AuthCoreModalOptions = {
  projectId: process.env.VITE_PARTICLE_PROJECT_ID ?? "",
  clientKey: process.env.VITE_PARTICLE_CLIENT_KEY ?? "",
  appId: process.env.VITE_PARTICLE_APP_ID ?? "",
  authTypes: [AuthType.email, AuthType.google, AuthType.apple],
  themeType: "dark",
  fiatCoin: "USD",
  language: "en",
  erc4337: {
    name: "SIMPLE",
    version: "1.0.0",
  },
  promptSettingConfig: {
    promptPaymentPasswordSettingWhenSign: PromptSettingType.first,
    promptMasterPasswordSettingWhenLogin: PromptSettingType.first,
  },
  wallet: {
    visible: true,
    customStyle: {
      supportChains: [Base, BaseSepolia],
    },
  },
};
