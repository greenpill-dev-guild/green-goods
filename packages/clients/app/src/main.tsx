import React from "react";
import ReactDOM from "react-dom/client";
import { ApolloProvider } from "@apollo/client";
import { BrowserRouter } from "react-router-dom";
import { ZeroDevProvider } from "@zerodev/privy";
import { baseSepolia, foundry } from "viem/chains";
import { PrivyProvider } from "@privy-io/react-auth";

import { contractClient } from "@/modules/apollo";

import { AppProvider } from "@/hooks/providers/app";
import { Web3Provider } from "@/hooks/providers/web3";

import App from "@/App.tsx";

import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ZeroDevProvider projectId={import.meta.env.VITE_ZERO_DEV_PROJECT_ID ?? ""}>
      <PrivyProvider
        appId={import.meta.env.VITE_PRIVY_APP_ID ?? ""}
        config={{
          loginMethods: ["email", "wallet"],
          appearance: {
            theme: "light",
          },
          embeddedWallets: {
            createOnLogin: "users-without-wallets",
          },
          defaultChain: baseSepolia,
          supportedChains: [foundry, baseSepolia],
        }}
      >
        <ApolloProvider client={contractClient}>
          <BrowserRouter>
            <AppProvider>
              <Web3Provider>
                <App />
              </Web3Provider>
            </AppProvider>
          </BrowserRouter>
        </ApolloProvider>
      </PrivyProvider>
    </ZeroDevProvider>
  </React.StrictMode>
);
