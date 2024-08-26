import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { PrivyProvider } from "@privy-io/react-auth";
import { arbitrum } from "viem/chains";

import { SmartAccountProvider } from "./hooks/SmartAccountProvider";

import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <PrivyProvider
      appId={import.meta.env.VITE_PRIVY_APP_ID as string}
      config={{
        loginMethods: ["email", "sms"],
        appearance: {
          theme: "light",
          loginMessage: "Start Bringing Biodiversity Onchain",
        },
        embeddedWallets: {
          createOnLogin: "users-without-wallets",
          noPromptOnSignature: true,
        },
        defaultChain: arbitrum,
        supportedChains: [arbitrum],
      }}
    >
      <SmartAccountProvider>
        <App />
      </SmartAccountProvider>
    </PrivyProvider>
  </StrictMode>
);
