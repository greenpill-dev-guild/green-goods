import { decodeFunctionResult, encodeFunctionData, type Hex, parseAbi } from "viem";
import type { Address } from "../../types/domain";
import { getRpcUrl } from "../../utils/blockchain/chain-registry";
import { GREEN_GOODS_ISSUER_ROUTE } from "./service-issuer-live-config";
import type { ServiceIssuerRoute } from "./service-issuer-types";
import type { PassportVoucherSupply } from "./public-passport-types";

/** Vouchers and their exchange pools live on Gnosis, whichever chain the promises are on. */
const VOUCHER_CHAIN_ID = 100;
const READ_TIMEOUT_MS = 15_000;

const SUPPLY_ABI = parseAbi([
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
  "function limitOf(address,address) view returns (uint256)",
  "function have(address) view returns (bool)",
]);

/**
 * One reading of the voucher chain. Every call answers from the same block, so a balance and the
 * supply it is compared with are never from two different moments.
 */
export interface PassportVoucherChain {
  block(): Promise<{ number: bigint; timestamp: number }>;
  call(to: Address, data: Hex, block: bigint): Promise<Hex>;
}

/** Plain JSON-RPC over the chain's public endpoint: a public page carries no wallet kit. */
function publicVoucherChain(): PassportVoucherChain {
  const url = getRpcUrl(VOUCHER_CHAIN_ID);
  const request = async (method: string, params: readonly unknown[]): Promise<unknown> => {
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      signal: AbortSignal.timeout(READ_TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`Voucher chain read failed with status ${response.status}`);
    const body = (await response.json()) as { result?: unknown; error?: unknown };
    if (body.error || body.result === undefined || body.result === null) {
      throw new Error(`Voucher chain read ${method} returned no result`);
    }
    return body.result;
  };
  return {
    block: async () => {
      const block = (await request("eth_getBlockByNumber", ["latest", false])) as {
        number?: unknown;
        timestamp?: unknown;
      };
      if (typeof block.number !== "string" || typeof block.timestamp !== "string") {
        throw new Error("Voucher chain block is unreadable");
      }
      return { number: BigInt(block.number), timestamp: Number(BigInt(block.timestamp)) };
    },
    call: async (to, data, block) => {
      const result = await request("eth_call", [{ to, data }, `0x${block.toString(16)}`]);
      if (typeof result !== "string" || !result.startsWith("0x") || result === "0x") {
        throw new Error("Voucher chain call returned no data");
      }
      return result as Hex;
    },
  };
}

const same = (left: string, right: string) => left.toLowerCase() === right.toLowerCase();

/**
 * The vouchers a garden issues, as their tokens and the reviewed exchange pools hold them now:
 * what each pool holds, the most it may hold, and how many vouchers are out of the issuer's
 * reserve. A garden that issues no voucher reads nothing from the chain.
 *
 * The page cannot count the people who hold a voucher. Vouchers out of the reserve that are not
 * in a pool are with holders or in a booking, so that remainder could be one person's balance:
 * the outstanding total is published only while every outstanding voucher sits in a pool.
 */
export async function readPassportVoucherSupply(
  chainId: number,
  garden: Address,
  options: { chain?: PassportVoucherChain; route?: ServiceIssuerRoute } = {}
): Promise<{ supply: PassportVoucherSupply[]; asOf: number | null }> {
  const route = options.route ?? GREEN_GOODS_ISSUER_ROUTE;
  const issued =
    chainId === route.service.sourceChainId
      ? route.service.assets.filter((asset) => asset.garden && same(asset.garden, garden))
      : [];
  if (issued.length === 0) return { supply: [], asOf: null };

  const chain = options.chain ?? publicVoucherChain();
  const block = await chain.block();
  const read = async <T>(
    to: Address,
    functionName: "totalSupply" | "balanceOf" | "limitOf" | "have",
    args: readonly Address[] = []
  ): Promise<T> => {
    const data = encodeFunctionData({ abi: SUPPLY_ABI, functionName, args } as never);
    const result = await chain.call(to, data, block.number);
    return decodeFunctionResult({ abi: SUPPLY_ABI, functionName, data: result } as never) as T;
  };

  const supply = await Promise.all(
    issued.map(async (voucher): Promise<PassportVoucherSupply> => {
      // The reviewed issuer record names the reserve; without it nothing can be called outstanding.
      const asset = route.assets.find((entry) => same(entry.token.address, voucher.token));
      if (!asset) throw new Error("Voucher has no reviewed issuer record");
      const listedIn = route.pools.filter((pool) =>
        pool.listings.some((listing) => listing.assetId === asset.id)
      );
      const [total, reserve, pools] = await Promise.all([
        read<bigint>(voucher.token, "totalSupply"),
        read<bigint>(voucher.token, "balanceOf", [asset.ownerReserve]),
        Promise.all(
          listedIn.map(async (pool) => {
            const [holding, holdingLimit, listed] = await Promise.all([
              read<bigint>(voucher.token, "balanceOf", [pool.deployment.address]),
              read<bigint>(pool.limiter.address, "limitOf", [
                voucher.token,
                pool.deployment.address,
              ]),
              read<boolean>(pool.registry.address, "have", [voucher.token]),
            ]);
            return { name: pool.name, listed, holding, holdingLimit };
          })
        ),
      ]);
      const outstanding = total - reserve;
      const outsidePools = outstanding - pools.reduce((sum, pool) => sum + pool.holding, 0n);
      if (outstanding < 0n || outsidePools < 0n) {
        throw new Error("Voucher balances do not add up to the supply");
      }
      return {
        token: voucher.token.toLowerCase() as Address,
        symbol: voucher.symbol,
        decimals: voucher.decimals,
        pools,
        outstanding: outsidePools === 0n ? outstanding : null,
        outsidePools: outsidePools > 0n,
      };
    })
  );
  return { supply, asOf: block.timestamp };
}
