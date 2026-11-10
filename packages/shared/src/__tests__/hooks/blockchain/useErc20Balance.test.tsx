/** @vitest-environment happy-dom */
import { QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import {
  decodeFunctionData,
  encodeAbiParameters,
  encodeFunctionResult,
  multicall3Abi,
  stringToHex,
} from "viem";
import { describe, expect, it, vi } from "vitest";
import { createConfig, custom, WagmiProvider } from "wagmi";
import { arbitrum, sepolia } from "wagmi/chains";
import { DEFAULT_CHAIN_ID } from "../../../config/default-chain";
import { useErc20Balance } from "../../../hooks/blockchain/useErc20Balance";
import { createTestQueryClient } from "../../test-utils/query-client";

const owner = "0x1111111111111111111111111111111111111111";
const token = "0x2222222222222222222222222222222222222222";

function setup({ failBalance = false, bytes32Symbol = false } = {}) {
  const request = vi.fn(async ({ method, params }: { method: string; params?: unknown[] }) => {
    if (method === "eth_chainId") return "0xaa36a7";
    if (method !== "eth_call") throw new Error(`Unexpected RPC method: ${method}`);
    const call = params?.[0] as { to: string; data: string };
    const readToken = (data: string) => {
      if (data.startsWith("0x70a08231")) {
        if (failBalance) throw new Error("Token balance unavailable");
        return encodeAbiParameters([{ type: "uint256" }], [1_234_567n]);
      }
      if (data === "0x313ce567") return encodeAbiParameters([{ type: "uint8" }], [6]);
      if (data === "0x95d89b41")
        return bytes32Symbol
          ? encodeAbiParameters([{ type: "bytes32" }], [stringToHex("USDC", { size: 32 })])
          : encodeAbiParameters([{ type: "string" }], ["USDC"]);
      throw new Error(`Unexpected token call: ${data}`);
    };
    if (call.to.toLowerCase() === token) return readToken(call.data);
    if (call.to.toLowerCase() !== sepolia.contracts.multicall3.address.toLowerCase()) {
      throw new Error(`Unexpected contract: ${call.to}`);
    }
    const decoded = decodeFunctionData({ abi: multicall3Abi, data: call.data as `0x${string}` });
    if (decoded.functionName !== "aggregate3") throw new Error("Unexpected multicall method");
    return encodeFunctionResult({
      abi: multicall3Abi,
      functionName: "aggregate3",
      result: decoded.args[0].map((item) => {
        if (item.target.toLowerCase() !== token) throw new Error("Unexpected token");
        try {
          return { success: true, returnData: readToken(item.callData) };
        } catch {
          return { success: false, returnData: "0x" as const };
        }
      }),
    });
  });
  const readChains: number[] = [];
  const config = createConfig({
    chains: [sepolia, arbitrum],
    transports: {
      [sepolia.id]: custom(
        {
          request: (...args: Parameters<typeof request>) => {
            readChains.push(sepolia.id);
            return request(...args);
          },
        },
        { retryCount: 0 }
      ),
      [arbitrum.id]: custom(
        {
          request: (...args: Parameters<typeof request>) => {
            readChains.push(arbitrum.id);
            return request(...args);
          },
        },
        { retryCount: 0 }
      ),
    },
  });
  const client = createTestQueryClient();
  const wrapper = ({ children }: PropsWithChildren) => (
    <WagmiProvider config={config}>
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
  return { request, wrapper, client, config, readChains };
}

describe("useErc20Balance", () => {
  it("reads the owner's token amount and metadata with token decimals", async () => {
    const { wrapper, request, client, readChains } = setup();
    const { result, unmount } = renderHook(
      () => useErc20Balance({ address: owner, token, chainId: sepolia.id }),
      { wrapper }
    );
    await waitFor(
      () => {
        expect(result.current.error).toBeNull();
        expect(result.current.data).toEqual({
          value: 1_234_567n,
          decimals: 6,
          symbol: "USDC",
          formatted: "1.234567",
        });
      },
      { timeout: 5000 }
    );
    expect(new Set(readChains)).toEqual(new Set([sepolia.id]));
    expect(
      request.mock.calls.some(([call]) => JSON.stringify(call.params).includes(owner.slice(2)))
    ).toBe(true);
    unmount();
    client.clear();
  });

  it("uses the application chain when the wallet selects another network", async () => {
    const { wrapper, client, config, readChains } = setup();
    const walletChain = DEFAULT_CHAIN_ID === sepolia.id ? arbitrum.id : sepolia.id;
    config.setState((state) => ({ ...state, chainId: walletChain }));
    const { result, unmount } = renderHook(() => useErc20Balance({ address: owner, token }), {
      wrapper,
    });
    await waitFor(() => expect(result.current.data?.value).toBe(1_234_567n));
    expect(readChains.length).toBeGreaterThan(0);
    expect(new Set(readChains)).toEqual(new Set([DEFAULT_CHAIN_ID]));
    unmount();
    client.clear();
  });

  it("preserves bytes32 symbols from older ERC-20 contracts", async () => {
    const { wrapper, client } = setup({ bytes32Symbol: true });
    const { result, unmount } = renderHook(() => useErc20Balance({ address: owner, token }), {
      wrapper,
    });
    await waitFor(() => expect(result.current.data?.symbol).toBe("USDC"), { timeout: 5000 });
    expect(result.current.data?.value).toBe(1_234_567n);
    expect(result.current.data?.formatted).toBe("1.234567");
    unmount();
    client.clear();
  });

  it("does not read a closed deposit form", async () => {
    const { wrapper, request, client } = setup();
    const { result, unmount } = renderHook(
      () => useErc20Balance({ address: owner, token, query: { enabled: false } }),
      { wrapper }
    );
    expect(result.current.data).toBeUndefined();
    expect(request).not.toHaveBeenCalled();
    unmount();
    client.clear();
  });

  it("does not substitute native currency when the owner or token is absent", () => {
    const { wrapper, request, client } = setup();
    const { result, rerender, unmount } = renderHook(
      (props: { address?: typeof owner; token?: typeof token }) => useErc20Balance(props),
      { wrapper, initialProps: { address: owner } }
    );
    expect(result.current.data).toBeUndefined();
    rerender({ token });
    expect(result.current.data).toBeUndefined();
    expect(request).not.toHaveBeenCalled();
    unmount();
    client.clear();
  });

  it("surfaces failed token reads without inventing a zero balance", async () => {
    const { wrapper, client } = setup({ failBalance: true });
    const { result, unmount } = renderHook(() => useErc20Balance({ address: owner, token }), {
      wrapper,
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.data).toBeUndefined();
    unmount();
    client.clear();
  });
});
