import { decodeFunctionResult, encodeFunctionData, type Hex, parseAbi } from "viem";
import type { Address } from "../../types/domain";
import { getRpcUrl } from "../../utils/blockchain/chain-registry";
import { GREEN_GOODS_ISSUER_ROUTE } from "./service-issuer-live-config";
import type { ServiceIssuerRoute } from "./service-issuer-types";
import type { PassportVoucherSupply } from "./public-passport-types";

/** Vouchers and their exchange pools live on Gnosis, whichever chain the promises are on. */
const VOUCHER_CHAIN_ID = 100;
/** One limit for the whole reading: a slow chain must not hold the rest of the passport up. */
const READ_TIMEOUT_MS = 8_000;
/** `Transfer(address,address,uint256)`. */
const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const ZERO_ADDRESS = `0x${"0".repeat(40)}`;

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
  block(): Promise<{ hash: Hex; number: bigint; timestamp: number }>;
  call(to: Address, data: Hex, blockHash: Hex): Promise<Hex>;
  /** Both ends of every transfer of the token, from its first block to the block read. */
  transfers(
    token: Address,
    fromBlock: bigint,
    toBlock: bigint
  ): Promise<{ from: string; to: string }[]>;
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
  const quantity = (value: bigint) => `0x${value.toString(16)}`;
  return {
    block: async () => {
      const block = (await request("eth_getBlockByNumber", ["finalized", false])) as {
        hash?: unknown;
        number?: unknown;
        timestamp?: unknown;
      };
      if (
        typeof block.hash !== "string" ||
        typeof block.number !== "string" ||
        typeof block.timestamp !== "string"
      ) {
        throw new Error("Voucher chain block is unreadable");
      }
      return {
        hash: block.hash as Hex,
        number: BigInt(block.number),
        timestamp: Number(BigInt(block.timestamp)),
      };
    },
    call: async (to, data, blockHash) => {
      const result = await request("eth_call", [{ to, data }, { blockHash }]);
      if (typeof result !== "string" || !/^0x[0-9a-f]+$/i.test(result)) {
        throw new Error("Voucher chain call returned no data");
      }
      return result as Hex;
    },
    transfers: async (token, fromBlock, toBlock) => {
      const logs = await request("eth_getLogs", [
        {
          address: token,
          topics: [TRANSFER_TOPIC],
          fromBlock: quantity(fromBlock),
          toBlock: quantity(toBlock),
        },
      ]);
      if (!Array.isArray(logs)) throw new Error("Voucher transfer history is unreadable");
      return logs.map((log: { topics?: unknown }) => {
        const topics = Array.isArray(log.topics) ? log.topics : [];
        const [, from, to] = topics;
        if (
          typeof from !== "string" ||
          typeof to !== "string" ||
          from.length !== 66 ||
          to.length !== 66
        ) {
          throw new Error("Voucher transfer is unreadable");
        }
        return { from: `0x${from.slice(26)}`, to: `0x${to.slice(26)}` };
      });
    },
  };
}

const same = (left: string, right: string) => left.toLowerCase() === right.toLowerCase();

/**
 * The vouchers a garden issues, as their tokens and the reviewed exchange pools hold them: what
 * each pool holds, the most it may hold, and how many vouchers are out of the issuer's reserve.
 * A garden that issues no voucher a reviewed pool lists reads nothing.
 *
 * A pool's holding moves with each person's exchange, and outstanding minus the pools is what
 * holders have. No source counts the people behind either, so a single exchange, booking, award
 * or gift would show as one person's amount beside what the pool was seeded with. Both figures
 * are published only while the voucher's whole transfer history, from its first block, stays
 * between its issue, the garden's reserve and the reviewed pools. One transfer to or from anyone
 * else holds them back for good, and the holding limit, which is the pool's own policy, stays.
 * A voucher one person issues is left out altogether: its supply is that person's own.
 */
export async function readPassportVoucherSupply(
  chainId: number,
  garden: Address,
  options: { chain?: PassportVoucherChain; route?: ServiceIssuerRoute } = {}
): Promise<{ supply: PassportVoucherSupply[]; asOf: number | null }> {
  const route = options.route ?? GREEN_GOODS_ISSUER_ROUTE;
  // A voucher counts when a reviewed pool lists it and one person does not issue it alone. One
  // with no reviewed issuer record stays in: the read then fails, where leaving it out would say
  // the garden issues none.
  const counted = (token: string) => {
    const asset = route.assets.find((entry) => same(entry.token.address, token));
    if (!asset) return true;
    return (
      asset.kind !== "individual" &&
      route.pools.some((pool) => pool.listings.some((listing) => listing.assetId === asset.id))
    );
  };
  const issued =
    chainId === route.service.sourceChainId
      ? route.service.assets.filter(
          (asset) => asset.garden && same(asset.garden, garden) && counted(asset.token)
        )
      : [];
  if (issued.length === 0) return { supply: [], asOf: null };

  const chain = options.chain ?? publicVoucherChain(AbortSignal.timeout(READ_TIMEOUT_MS));
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
      // The only places a voucher can be without a person having touched it.
      const untouched = [
        ZERO_ADDRESS,
        asset.ownerReserve,
        ...listedIn.map((pool) => pool.deployment.address),
      ];
      const [total, reserve, history, pools] = await Promise.all([
        totalSupply(voucher.token),
        balanceOf(voucher.token, asset.ownerReserve),
        chain.transfers(voucher.token, asset.token.receipt.blockNumber, block.number),
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
      const moved = history.some((transfer) =>
        [transfer.from, transfer.to].some((end) => !untouched.some((place) => same(place, end)))
      );
      const heldBack = moved || outsidePools > 0n;
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
