import { afterEach, describe, expect, it } from "vitest";
import { NetworkManager } from "./network";

const originalAlchemyApiKey = process.env.ALCHEMY_API_KEY;
const originalLegacyAlchemyKey = process.env.ALCHEMY_KEY;
const originalViteAlchemyKey = process.env.VITE_ALCHEMY_API_KEY;
const originalCeloRpc = process.env.CELO_RPC_URL;

afterEach(() => {
  if (originalAlchemyApiKey === undefined) delete process.env.ALCHEMY_API_KEY;
  else process.env.ALCHEMY_API_KEY = originalAlchemyApiKey;
  if (originalLegacyAlchemyKey === undefined) delete process.env.ALCHEMY_KEY;
  else process.env.ALCHEMY_KEY = originalLegacyAlchemyKey;
  if (originalViteAlchemyKey === undefined) delete process.env.VITE_ALCHEMY_API_KEY;
  else process.env.VITE_ALCHEMY_API_KEY = originalViteAlchemyKey;
  if (originalCeloRpc === undefined) delete process.env.CELO_RPC_URL;
  else process.env.CELO_RPC_URL = originalCeloRpc;
});

describe("NetworkManager provider selection", () => {
  it("prefers the configured Alchemy key over the non-archive Celo default", () => {
    delete process.env.ALCHEMY_API_KEY;
    delete process.env.ALCHEMY_KEY;
    process.env.VITE_ALCHEMY_API_KEY = "test-key";
    process.env.CELO_RPC_URL = "https://forno.celo.org";

    expect(new NetworkManager().getRpcUrl("celo")).toBe("https://celo-mainnet.g.alchemy.com/v2/test-key");
  });
});
