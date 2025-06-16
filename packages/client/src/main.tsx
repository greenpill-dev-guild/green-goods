import { PrivyProvider } from "@privy-io/react-auth";
import { SmartWalletsProvider } from "@privy-io/react-auth/smart-wallets";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { arbitrum } from "viem/chains";
import App from "@/App.tsx";
import { APP_DESCRIPTION } from "@/constants";
import { AppProvider } from "@/providers/app";
import { UserProvider } from "@/providers/user";

import "@/index.css";

export const Root = () => (
  <AppProvider>
    <PrivyProvider
      appId={import.meta.env.VITE_PRIVY_APP_ID as string}
      config={{
        loginMethods: ["email", "sms"],
        appearance: {
          theme: "light",
          loginMessage: APP_DESCRIPTION,
          landingHeader: "",
          logo: "",
        },
        embeddedWallets: {
          createOnLogin: "users-without-wallets",
        },
        defaultChain: arbitrum,
        supportedChains: [arbitrum],
        intl: {
          defaultCountry: navigator.language === "pt-BR" ? "BR" : "US",
        },
      }}
    >
      <SmartWalletsProvider>
        <UserProvider>
          <App />
        </UserProvider>
      </SmartWalletsProvider>
    </PrivyProvider>
  </AppProvider>
);

const container = document.getElementById("root");

if (container) {
  createRoot(container).render(
    <StrictMode>
      <Root />
    </StrictMode>
  );
}
