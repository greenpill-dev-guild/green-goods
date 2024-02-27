import { foundry, baseGoerli } from "wagmi/chains";
import { configureChains, createConfig } from "wagmi";
import { jsonRpcProvider } from "wagmi/providers/jsonRpc";
import { alchemyProvider } from "wagmi/providers/alchemy";

export const chainConfig = configureChains(
  [baseGoerli, foundry],
  [
    alchemyProvider({ apiKey: import.meta.env.VITE_ALCHEMY_API_KEY! }),
    jsonRpcProvider({
      rpc: (chain) => {
        if (chain.id === foundry.id) {
          return { http: "http://localhost:8545" };
        }
        return { http: chain.rpcUrls.default.http[0] };
      },
    }),
  ],
);

export const config = createConfig({
  autoConnect: true,
  publicClient: chainConfig.publicClient,
  webSocketPublicClient: chainConfig.webSocketPublicClient,
});
