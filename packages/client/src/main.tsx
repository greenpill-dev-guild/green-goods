import { PrivyProvider } from "@privy-io/react-auth";
import { SmartWalletsProvider } from "@privy-io/react-auth/smart-wallets";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { arbitrum, baseSepolia, celo } from "viem/chains";
import type { Chain } from "viem";
import App from "@/App.tsx";
import { APP_DESCRIPTION } from "@/constants";
import { AppProvider } from "@/providers/app";
import { UserProvider } from "@/providers/user";

import "@/index.css";

// Function to get the default chain based on environment variable
function getDefaultChain(): Chain {
  const chainId = import.meta.env.VITE_CHAIN_ID;

  switch (chainId) {
    case "42161":
      return arbitrum;
    case "42220":
      return celo;
    case "84532":
      return baseSepolia;
    default:
      // Default to Base Sepolia if no environment variable is set
      return baseSepolia;
  }
}

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
        defaultChain: getDefaultChain(),
        supportedChains: [arbitrum, celo, baseSepolia],
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
