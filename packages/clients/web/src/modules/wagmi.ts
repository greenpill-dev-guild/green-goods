import { createConfig, configureChains } from "wagmi";
import { base, baseGoerli, foundry } from "wagmi/chains";
import { alchemyProvider } from "wagmi/providers/alchemy";
import { jsonRpcProvider } from "wagmi/providers/jsonRpc";

const chainConfig = configureChains(
  [base, baseGoerli, foundry],
  [
    alchemyProvider({ apiKey: process.env.VITE_ALCHEMY_API_KEY! }),
    jsonRpcProvider({
      rpc: (chain) => {
        if (chain.id === foundry.id) {
          return { http: "http://localhost:8545" };
        }
        return { http: chain.rpcUrls.default.http[0] };
      },
    }),
  ]
);

const config = createConfig({
  autoConnect: true, // Should we enable auto-connection?
  // connectors,
  publicClient: chainConfig.publicClient,
  webSocketPublicClient: chainConfig.webSocketPublicClient,
});

export { chainConfig, config };
