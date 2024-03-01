import "./index.css";

import * as React from "react";
import * as ReactDOM from "react-dom/client";

import { ApolloProvider } from "@apollo/client";
import { BrowserRouter } from "react-router-dom";
import { AuthCoreContextProvider } from "@particle-network/auth-core-modal";

import { contractClient } from "./modules/apollo";
import { particleConfig } from "./modules/particle";

import { AppProvider } from "./hooks/providers/app";
import { Web3Provider } from "./hooks/providers/web3";

import { App } from "./App";

const root = ReactDOM.createRoot(document.getElementById("root")!);

root.render(
  <React.StrictMode>
    <AuthCoreContextProvider options={particleConfig}>
      <ApolloProvider client={contractClient}>
        <BrowserRouter>
          <AppProvider>
            <Web3Provider>
              <App />
            </Web3Provider>
          </AppProvider>
        </BrowserRouter>
      </ApolloProvider>
    </AuthCoreContextProvider>
  </React.StrictMode>,
);
