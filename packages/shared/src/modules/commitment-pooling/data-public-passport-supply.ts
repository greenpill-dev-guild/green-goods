import { decodeFunctionResult, encodeFunctionData, type Hex, parseAbi } from "viem";
import type { Address } from "../../types/domain";
import { getRpcUrl } from "../../utils/blockchain/chain-registry";
import { type GraphQLReader, greenGoodsIndexer } from "../data/graphql-client";
import type { RawRow } from "./data-core";
import { GREEN_GOODS_ISSUER_ROUTE } from "./service-issuer-live-config";
import type { ServiceIssuerRoute } from "./service-issuer-types";
import type { PassportVoucherSupply } from "./public-passport-types";

/** Vouchers and their exchange pools live on Gnosis, whichever chain the promises are on. */
const VOUCHER_CHAIN_ID = 100;
/** One limit for the whole reading: a slow chain must not hold the rest of the passport up. */
const READ_TIMEOUT_MS = 8_000;

const SUPPLY_ABI = parseAbi([
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
  "function limitOf(address,address) view returns (uint256)",
  "function have(address) view returns (bool)",
]);

/**
 * One reading of the voucher chain. Every call answers from the same block, named by its hash, so
 * a balance and the supply it is compared with are never from two different moments.
 */
export interface PassportVoucherChain {
  block(): Promise<{ hash: Hex; timestamp: number }>;
  call(to: Address, data: Hex, blockHash: Hex): Promise<Hex>;
}

/**
 * Plain JSON-RPC over the chain's public endpoint: a public page carries no wallet kit. The
 * reading is taken at the last finalized block, a few minutes old, which cannot be reorganized
 * away and which every node behind the endpoint already has.
 */
function publicVoucherChain(deadline: AbortSignal): PassportVoucherChain {
  const url = getRpcUrl(VOUCHER_CHAIN_ID);
  const request = async (method: string, params: readonly unknown[]): Promise<unknown> => {
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      signal: deadline,
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
      const block = (await request("eth_getBlockByNumber", ["finalized", false])) as {
        hash?: unknown;
        timestamp?: unknown;
      };
      if (typeof block.hash !== "string" || typeof block.timestamp !== "string") {
        throw new Error("Voucher chain block is unreadable");
      }
      return { hash: block.hash as Hex, timestamp: Number(BigInt(block.timestamp)) };
    },
    call: async (to, data, blockHash) => {
      const result = await request("eth_call", [{ to, data }, { blockHash }]);
      if (typeof result !== "string" || !/^0x[0-9a-f]+$/i.test(result)) {
        throw new Error("Voucher chain call returned no data");
      }
      return result as Hex;
    },
  };
}

const same = (left: string, right: string) => left.toLowerCase() === right.toLowerCase();
/** An address as the index may hold it: lower case, or as the event wrote it. */
const spellings = (address: string) => [...new Set([address.toLowerCase(), address])];

/**
 * Whether the voucher has started to move: exchanged in a reviewed pool, presented for a booking,
 * or awarded to someone. One row of any kind is enough, so one row of each is all that is asked
 * for. An award does not name its voucher in the index, so any award counts for every voucher: a
 * member who puts an awarded voucher into the pool would otherwise leave no trace here.
 */
async function voucherInUse(
  sourceChainId: number,
  token: Address,
  pools: readonly Address[],
  reader: GraphQLReader,
  deadline: AbortSignal
): Promise<boolean> {
  const entities = ["VoucherPoolExchange", "VoucherServiceSetup", "EarnedVoucherDistribution"];
  const result = await reader.query<Record<string, RawRow[]>>(
    `query PublicPassportVoucherUse($chainId: Int!, $tokens: [String!]!, $pools: [String!]!) {
      VoucherPoolExchange(where: { moduleAddress: { _in: $pools }, _or: [{ tokenIn: { _in: $tokens } }, { tokenOut: { _in: $tokens } }] }, limit: 1) { id }
      VoucherServiceSetup(where: { token: { _in: $tokens } }, limit: 1) { id }
      EarnedVoucherDistribution(where: { chainId: { _eq: $chainId }, preparedSeen: { _eq: true } }, limit: 1) { id }
    }`,
    { chainId: sourceChainId, tokens: spellings(token), pools: pools.flatMap(spellings) },
    "getPublicPassportVoucherUse",
    deadline
  );
  if (result.error) throw result.error;
  const rows = entities.map((entity) => result.data?.[entity]);
  if (!rows.every(Array.isArray)) throw new Error("Passport voucher use records are unavailable");
  return rows.some((found) => (found as RawRow[]).length > 0);
}

/**
 * The vouchers a garden issues, as their tokens and the reviewed exchange pools hold them: what
 * each pool holds, the most it may hold, and how many vouchers are out of the issuer's reserve.
 * A garden that issues no voucher on the reviewed route reads nothing.
 *
 * A pool's holding moves with each person's exchange, and outstanding minus the pools is what
 * holders have. No source counts the people behind either, so a single exchange, booking or
 * award would show as one person's amount beside what the pool was seeded with. Both figures are
 * published only while the voucher has not started to move: no exchange in a reviewed pool, no
 * booking, no award, and nothing outside the pools. After that they are held back and the holding
 * limit, which is the pool's own policy, stays. A voucher one person issues is left out
 * altogether: its supply is that person's own.
 */
export async function readPassportVoucherSupply(
  chainId: number,
  garden: Address,
  options: { chain?: PassportVoucherChain; reader?: GraphQLReader; route?: ServiceIssuerRoute } = {}
): Promise<{ supply: PassportVoucherSupply[]; asOf: number | null }> {
  const route = options.route ?? GREEN_GOODS_ISSUER_ROUTE;
  const collective = (token: string) =>
    route.assets.some((asset) => same(asset.token.address, token) && asset.kind === "collective");
  const issued =
    chainId === route.service.sourceChainId
      ? route.service.assets.filter(
          (asset) => asset.garden && same(asset.garden, garden) && collective(asset.token)
        )
      : [];
  if (issued.length === 0) return { supply: [], asOf: null };

  // One limit covers the chain and the index together.
  const deadline = AbortSignal.timeout(READ_TIMEOUT_MS);
  const reader = options.reader ?? greenGoodsIndexer;
  const chain = options.chain ?? publicVoucherChain(deadline);
  const block = await chain.block();
  const call = (to: Address, data: Hex) => chain.call(to, data, block.hash);
  const totalSupply = async (token: Address) =>
    decodeFunctionResult({
      abi: SUPPLY_ABI,
      functionName: "totalSupply",
      data: await call(token, encodeFunctionData({ abi: SUPPLY_ABI, functionName: "totalSupply" })),
    });
  const balanceOf = async (token: Address, holder: Address) =>
    decodeFunctionResult({
      abi: SUPPLY_ABI,
      functionName: "balanceOf",
      data: await call(
        token,
        encodeFunctionData({ abi: SUPPLY_ABI, functionName: "balanceOf", args: [holder] })
      ),
    });
  const limitOf = async (limiter: Address, token: Address, pool: Address) =>
    decodeFunctionResult({
      abi: SUPPLY_ABI,
      functionName: "limitOf",
      data: await call(
        limiter,
        encodeFunctionData({ abi: SUPPLY_ABI, functionName: "limitOf", args: [token, pool] })
      ),
    });
  const have = async (registry: Address, token: Address) =>
    decodeFunctionResult({
      abi: SUPPLY_ABI,
      functionName: "have",
      data: await call(
        registry,
        encodeFunctionData({ abi: SUPPLY_ABI, functionName: "have", args: [token] })
      ),
    });

  const supply = await Promise.all(
    issued.map(async (voucher): Promise<PassportVoucherSupply> => {
      // The reviewed issuer record names the reserve; without it nothing can be called outstanding.
      const asset = route.assets.find((entry) => same(entry.token.address, voucher.token));
      if (!asset) throw new Error("Voucher has no reviewed issuer record");
      const listedIn = route.pools.filter((pool) =>
        pool.listings.some((listing) => listing.assetId === asset.id)
      );
      const [total, reserve, used, pools] = await Promise.all([
        totalSupply(voucher.token),
        balanceOf(voucher.token, asset.ownerReserve),
        voucherInUse(
          route.service.sourceChainId,
          voucher.token,
          listedIn.map((pool) => pool.deployment.address),
          reader,
          deadline
        ),
        Promise.all(
          listedIn.map(async (pool) => {
            const [holding, holdingLimit, listed] = await Promise.all([
              balanceOf(voucher.token, pool.deployment.address),
              limitOf(pool.limiter.address, voucher.token, pool.deployment.address),
              have(pool.registry.address, voucher.token),
            ]);
            return { id: pool.id, name: pool.name, listed, holding, holdingLimit };
          })
        ),
      ]);
      const outstanding = total - reserve;
      const outsidePools = outstanding - pools.reduce((sum, pool) => sum + pool.holding, 0n);
      if (outstanding < 0n || outsidePools < 0n) {
        throw new Error("Voucher balances do not add up to the supply");
      }
      const heldBack = used || outsidePools > 0n;
      return {
        token: voucher.token.toLowerCase() as Address,
        symbol: voucher.symbol,
        decimals: voucher.decimals,
        pools: pools.map((pool) => ({ ...pool, holding: heldBack ? null : pool.holding })),
        outstanding: heldBack ? null : outstanding,
        heldBack,
      };
    })
  );
  return { supply, asOf: block.timestamp };
}
