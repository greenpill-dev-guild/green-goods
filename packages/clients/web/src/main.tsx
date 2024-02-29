import "./index.css";

import * as React from "react";
import * as ReactDOM from "react-dom/client";

import { ApolloProvider } from "@apollo/client";
import { BrowserRouter } from "react-router-dom";

import { contractClient } from "./modules/apollo";

import { AppProvider } from "./hooks/providers/app";
import { Web3Provider } from "./hooks/providers/web3";

import { App } from "./App";

const root = ReactDOM.createRoot(document.getElementById("root")!);

root.render(
  <React.StrictMode>
    <ApolloProvider client={contractClient}>
      <BrowserRouter>
        <AppProvider>
          <Web3Provider>
            <App />
          </Web3Provider>
        </AppProvider>
      </BrowserRouter>
    </ApolloProvider>
  </React.StrictMode>,
);
