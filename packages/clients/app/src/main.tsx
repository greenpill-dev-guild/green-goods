import React from "react";
import ReactDOM from "react-dom/client";
import { ApolloProvider } from "@apollo/client";
import { BrowserRouter } from "react-router-dom";
import { AuthCoreContextProvider } from "@particle-network/auth-core-modal";

import { contractClient } from "./modules/apollo";
import { particleConfig } from "./modules/particle";

import { AppProvider } from "./hooks/providers/app";
import { Web3Provider } from "./hooks/providers/web3";

import App from "./App.tsx";

import "./index.css";

import("buffer").then(({ Buffer }) => {
  window.Buffer = Buffer;
});

import("process").then(({ default: process }) => {
  window.process = process;
});

ReactDOM.createRoot(document.getElementById("root")!).render(
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
  </React.StrictMode>
);
