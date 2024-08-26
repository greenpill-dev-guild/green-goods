import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { arbitrum } from "viem/chains";
import { PrivyProvider } from "@privy-io/react-auth";

import { PWAProvider } from "./providers/PWAProvider.tsx";
import { WorkProvider } from "./providers/WorkProvider.tsx";
import { GardenProvider } from "./providers/GardenProvider.tsx";
import { SmartAccountProvider } from "./providers/SmartAccountProvider.tsx";

import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <PWAProvider>
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
          <GardenProvider>
            <WorkProvider>
              <App />
            </WorkProvider>
          </GardenProvider>
        </SmartAccountProvider>
      </PrivyProvider>
    </PWAProvider>
  </StrictMode>
);
