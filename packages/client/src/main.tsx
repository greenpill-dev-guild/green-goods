import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { arbitrum } from "viem/chains";
import { Toaster } from "react-hot-toast";
import { PrivyProvider } from "@privy-io/react-auth";

import { PWAProvider } from "@/providers/pwa";
import { UserProvider } from "@/providers/user";

import { APP_DESCRIPTION } from "@/constants";
import App from "@/App.tsx";
import "@/index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <PWAProvider>
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
            createOnLogin: "users-without-wallets",
            noPromptOnSignature: true,
          },
          defaultChain: arbitrum,
          supportedChains: [arbitrum],
          intl: {
            defaultCountry: navigator.language === "pt-BR" ? "BR" : "US",
          },
        }}
      >
        <UserProvider>
          <App />
          <Toaster />
        </UserProvider>
      </PrivyProvider>
    </PWAProvider>
  </StrictMode>
);
