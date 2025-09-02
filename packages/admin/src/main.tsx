import { PrivyProvider } from "@privy-io/react-auth";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { arbitrum, baseSepolia, celo } from "viem/chains";

import App from "@/App.tsx";
import { APP_DESCRIPTION, getDefaultChain } from "@/config";
import { UserProvider } from "@/providers/user";

import "@/index.css";

export const Root = () => (
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
        createOnLogin: "all-users",
      },
      defaultChain: getDefaultChain(),
      supportedChains: [arbitrum, celo, baseSepolia],
    }}
  >
    <UserProvider>
      <App />
    </UserProvider>
  </PrivyProvider>
);

const container = document.getElementById("root");
if (!container) throw new Error("Root container not found");

const root = createRoot(container);
root.render(
  <StrictMode>
    <Root />
  </StrictMode>
);