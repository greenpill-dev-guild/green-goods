/**
 * Local fork write-safety tests.
 * @vitest-environment jsdom
 */

import { describe, expect, it, vi } from "vitest";
import {
  assertLocalArbitrumForkSmartAccountsDisabled,
  assertLocalArbitrumForkWallet,
  type EthereumProvider,
} from "../local-fork-safety";

const forkEnv = {
  VITE_DEV_CHAIN_MODE: "arbitrum_fork",
  VITE_LOCAL_FORK_RPC_URL: "http://127.0.0.1:3009",
};

function createProvider(overrides: Partial<Record<string, unknown>> = {}): EthereumProvider {
  return {
    request: vi.fn(async ({ method }) => {
      const responses: Record<string, unknown> = {
        eth_chainId: "0xa4b1",
        web3_clientVersion: "anvil/v1.0.0",
        eth_getBlockByNumber: { number: "0x1", hash: "0xabc" },
        ...overrides,
      };
      return responses[method];
    }),
  };
}

function createFetch(result: unknown) {
  return vi.fn(async () => new Response(JSON.stringify({ jsonrpc: "2.0", id: 1, result })));
}

describe("assertLocalArbitrumForkWallet", () => {
  it("does nothing outside local fork mode", async () => {
    await expect(
      assertLocalArbitrumForkWallet({
        env: {},
        provider: null,
        fetchImpl: createFetch("0x1") as unknown as typeof fetch,
      })
    ).resolves.toBeUndefined();
  });

  it("requires a browser wallet provider in local fork mode", async () => {
    await expect(
      assertLocalArbitrumForkWallet({
        env: forkEnv,
        provider: null,
        fetchImpl: createFetch("0xa4b1") as unknown as typeof fetch,
      })
    ).rejects.toThrow("No browser wallet provider");
  });

  it("requires the wallet to be on Arbitrum chain id 42161", async () => {
    await expect(
      assertLocalArbitrumForkWallet({
        env: forkEnv,
        provider: createProvider({ eth_chainId: "0x1" }),
        fetchImpl: createFetch("0xa4b1") as unknown as typeof fetch,
      })
    ).rejects.toThrow("connected wallet is on chain 1");
  });

  it("accepts an Anvil-backed provider on chain 42161", async () => {
    await expect(
      assertLocalArbitrumForkWallet({
        env: forkEnv,
        provider: createProvider(),
        fetchImpl: createFetch("0xa4b1") as unknown as typeof fetch,
      })
    ).resolves.toBeUndefined();
  });

  it("rejects same-chain wallets that are not pointed at the local fork RPC", async () => {
    const provider = createProvider({
      web3_clientVersion: "MetaMask/v1",
      eth_getBlockByNumber: { number: "0x1", hash: "0xpublic" },
    });
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ jsonrpc: "2.0", id: 1, result: "0xa4b1" }))
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            result: { number: "0x1", hash: "0xlocal" },
          })
        )
      ) as unknown as typeof fetch;

    await expect(
      assertLocalArbitrumForkWallet({
        env: forkEnv,
        provider,
        fetchImpl,
      })
    ).rejects.toThrow("not using the local fork RPC");
  });
});

describe("assertLocalArbitrumForkSmartAccountsDisabled", () => {
  it("blocks passkey/smart-account writes in fork mode", () => {
    expect(() => assertLocalArbitrumForkSmartAccountsDisabled(forkEnv)).toThrow(
      "Passkey and smart-account transactions are not enabled"
    );
  });

  it("allows smart-account writes outside fork mode", () => {
    expect(() => assertLocalArbitrumForkSmartAccountsDisabled({})).not.toThrow();
  });
});
