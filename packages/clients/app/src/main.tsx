import "./index.css";

import * as React from "react";
import * as ReactDOM from "react-dom/client";

import { Provider } from "urql";
import { WagmiConfig } from "wagmi";
import { BrowserRouter } from "react-router-dom";
import { PrivyProvider } from "@privy-io/react-auth";
import { PrivyWagmiConnector } from "@privy-io/wagmi-connector";

import { graphClient } from "./modules/urql";
import { config, chainConfig } from "./modules/wagmi";

import { AppProvider } from "./hooks/providers/app";
import { Web3Provider } from "./hooks/providers/web3";

import { App } from "./App";

const root = ReactDOM.createRoot(document.getElementById("root")!);

root.render(
  <React.StrictMode>
    <WagmiConfig config={config}>
      <Provider value={graphClient}>
        <PrivyProvider
          appId={import.meta.env.VITE_PRIVY_APP_ID ?? ""}
          // onSuccess={handleLogin}
          config={{
            loginMethods: ["email", "wallet"],
            appearance: {
              theme: "light",
              accentColor: "#d6d0cb",
              // logo: "https://your-logo-url",
            },
          }}
        >
          <PrivyWagmiConnector wagmiChainsConfig={chainConfig}>
            <BrowserRouter>
              <AppProvider>
                <Web3Provider>
                  <App />
                </Web3Provider>
              </AppProvider>
            </BrowserRouter>
          </PrivyWagmiConnector>
        </PrivyProvider>
      </Provider>
    </WagmiConfig>
  </React.StrictMode>,
);
