import React from "react";
import ReactDOM from "react-dom/client";
import { ApolloProvider } from "@apollo/client";
import { BrowserRouter } from "react-router-dom";
import { ModalProvider } from "@particle-network/connect-react-ui"; // @particle-network/connectkit to use Auth Core

import { contractClient } from "./modules/apollo";
import { particleConfig } from "./modules/particle";

import { AppProvider } from "./hooks/providers/app";
import { Web3Provider } from "./hooks/providers/web3";

import App from "./App";

import "./index.css";
import "@particle-network/connect-react-ui/dist/index.css";

import("buffer").then(({ Buffer }) => {
  window.Buffer = Buffer;
});

import("process").then(({ default: process }) => {
  window.process = process;
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ModalProvider options={particleConfig}>
      <ApolloProvider client={contractClient}>
        <BrowserRouter>
          <AppProvider>
            <Web3Provider>
              <App />
            </Web3Provider>
          </AppProvider>
        </BrowserRouter>
      </ApolloProvider>
    </ModalProvider>
  </React.StrictMode>
);
