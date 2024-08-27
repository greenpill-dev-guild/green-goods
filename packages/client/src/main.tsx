import { StrictMode } from "react";
import { IntlProvider } from "react-intl";
import { createRoot } from "react-dom/client";

import { arbitrum } from "viem/chains";
import { PrivyProvider } from "@privy-io/react-auth";

import { PWAProvider } from "./providers/PWAProvider.tsx";
import { UserProvider } from "./providers/UserProvider.tsx";

import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <PWAProvider>
      <IntlProvider locale="en">
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
          <UserProvider>
            <App />
          </UserProvider>
        </PrivyProvider>
      </IntlProvider>
    </PWAProvider>
  </StrictMode>
);
