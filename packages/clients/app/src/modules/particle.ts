import { AuthType } from "@particle-network/auth-core";
import {
  AuthCoreModalOptions,
  PromptSettingType,
} from "@particle-network/auth-core-modal";
import { BaseSepolia, Base } from "@particle-network/chains";

export const particleConfig: AuthCoreModalOptions = {
  projectId: import.meta.env.VITE_PARTICLE_PROJECT_ID ?? "",
  clientKey: import.meta.env.VITE_PARTICLE_CLIENT_KEY ?? "",
  appId: import.meta.env.VITE_PARTICLE_APP_ID ?? "",
  authTypes: [AuthType.email, AuthType.phone, AuthType.google],
  customStyle: {},
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
